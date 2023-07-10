from builtins import object
import os
import re
import threading
import traceback
import json

from aob.aob_common import logger, builder_constant, conf_parser
from tabuilder_utility import common_util

from splunklib.client import Input
from splunklib.client import Collection
from solnlib.conf_manager import ConfStanzaNotExistException, ConfManagerException
from aob.aob_common.metric_collector import metric_util

common_util.initialize_apm()

G_DEFAULT_CONF_KV = {
    "tags": {
        "disabled": "0"
    }
}

@metric_util.function_run_time(tags=['tab_conf_manager'])
def is_stanza_exists(conf_file, stanza):
    exist = True
    try:
        conf_file.reload()
        conf_file.get(stanza)
    except ConfStanzaNotExistException as e:
        exist = False
    return exist

@metric_util.function_run_time(tags=['tab_conf_manager'])
def is_conf_exists(conf_mgr, conf_name):
    try:
        conf_mgr.get_conf(conf_name, refresh=True)
        return True
    except ConfManagerException:
        return False

class TabConfMgr(object):

    @metric_util.function_run_time(tags=['tab_conf_manager', 'init'])
    def __init__(self, splunk_uri, splunk_session_key, app_name, service):
        '''
        the conf manager should be in the context of app_name!
        '''
        self.logger = logger.get_builder_util_logger()
        self.app_name = app_name
        self.conf_mgr = common_util.create_conf_mgr(
            splunk_session_key, splunk_uri,
            app_name)
        self.default_kv = {}
        self.default_value_sets = (
            {1, "1", "t", "true", 'y', 'yes'}, # true set
            {0, "0", "f", "false", "n", "no"}, # false set
            {None, "none", ""}, # None set
        )
        if service:
            self.service = service
        else:
            self.service = common_util.create_splunk_service(
                splunk_session_key, splunk_uri,
                app_name)

    @metric_util.function_run_time(tags=['tab_conf_manager'])
    def renew_token(self, session_key):
        self.service.token = session_key
        self.conf_mgr._rest_client.token = session_key
        self.conf_mgr._session_key = session_key

    def get_conf_manager(self):
        return self.conf_mgr

    @metric_util.function_run_time(tags=['tab_conf_manager', 'input_mgr'])
    def get_data_input(self, input_type, name=None):
        try:
            if name:
                data_input = Input(self.service, 'data/inputs/' + input_type + '/' + name)
                key_values = data_input.content.copy()
                key_values['name'] = data_input.name
                return key_values
            else:
                res = []
                entries = Collection(self.service, 'data/inputs/' + input_type)
                for entry in entries:
                    key_values = entry.content.copy()
                    key_values['name'] = entry.name
                    res.append(key_values)

                return res
        except Exception as ve:
            self.logger.info("Cannot get input %s:%s. %s", input_type, name, traceback.format_exc())
            raise ve

    @metric_util.function_run_time(tags=['tab_conf_manager', 'input_mgr'])
    def update_data_input(self, input_type, name, old_key_values,
                          new_key_values):
        try:
            _input = Input(self.service, 'data/inputs/' + input_type + '/' + name)
            existing_input_conf = _input.content.copy()
            for k in ['eai:acl', 'disabled', 'start_by_shell', 'interval']:
                if k in existing_input_conf:
                    # disabled and eai:acl is not supported when updating an input
                    # start_by_shell can not be updated. Error: Parameter 'start_by_shell' failed validation expression: isbool(start_by_shell).
                    # for single instance modinput, can not update interval via rest
                    del existing_input_conf[k]

            for k, v in list(old_key_values.items()):
                if k in existing_input_conf and v == existing_input_conf[k]:
                    del existing_input_conf[k]
            existing_input_conf.update(new_key_values)
            _input.update(**existing_input_conf)
        except Exception as e:
            if hasattr(e, "status") and e.status == 404:
                self.logger.error("Modular input [%s://%s] not found", input_type, name)
                raise ConfStanzaNotExistException("input [{0}://{1}] not found.".format(input_type, name))
            else:
                self.logger.error("Cannot update data input %s %s", input_type, name)
                raise e

    @metric_util.function_run_time(tags=['tab_conf_manager', 'input_mgr'])
    def create_data_input(self, input_type, name, key_values):
        try:
            Input(self.service, 'data/inputs/' + input_type + '/' + name).delete()
        except Exception as e:
            if hasattr(e, "status") and e.status == 404:
                pass
            else:
                self.logger.error("Cannot create data input %s %s", input_type, name)
                raise e

        self.service.inputs.create(name, input_type, **key_values)

    @metric_util.function_run_time(tags=['tab_conf_manager', 'input_mgr'])
    def delete_data_input(self, input_type, name):
        try:
            Input(self.service, 'data/inputs/' + input_type + '/' + name).delete()
        except Exception as e:
            if hasattr(e, "status") and e.status in (404, "404"):
                pass
            else:
                self.logger.error("Cannot delete data input %s %s", input_type, name)
                raise e

    @metric_util.function_run_time(tags=['tab_conf_manager', 'input_mgr'])
    def reload_data_input(self, input_type):
        try:
            self.service.post('data/inputs/' + input_type + '/_reload')
        except Exception as ve:
            self.logger.info("Can not reload input %s, input not found. It may be created right now. Restarting Splunk is needed. %s", input_type, traceback.format_exc())
            raise ve

    @metric_util.function_run_time(tags=['tab_conf_manager'])
    def _create_conf_if_not_exist(self, conf_name):
        '''
        return True : if the conf is newly created.
        otherwise, False
        '''
        conf_created = False
        if not is_conf_exists(self.conf_mgr, conf_name):
            self.conf_mgr._confs.create(conf_name)
            conf_created = True
        return conf_created

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def create_conf_stanza(self,
                           conf_name,
                           stanza,
                           key_values,
                           fail_if_stanza_exists=True,
                           remove_default_properties=True):
        """
        create a stanza. if the stanza exists, return false.
        If creation fails, throw an exception.
        If conf file does not exist, create the conf file.
        """
        self._create_conf_if_not_exist(conf_name)
        conf_file = self.conf_mgr.get_conf(conf_name, refresh=True)
        stanza_exist = is_stanza_exists(conf_file, stanza)
        if stanza_exist and fail_if_stanza_exists:
            return False

        return self.update_conf_stanza(conf_name,
                                       stanza,
                                       {},
                                       key_values,
                                       check_exist=False,
                                       remove_default_properties=remove_default_properties)

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def update_conf_stanza(self,
                           conf_name,
                           stanza,
                           old_key_values,
                           new_key_values,
                           check_exist=False,
                           remove_default_properties=True,
                           delete_existing_stanza=True):
        """
        check_exist: True -- check the stanza in conf, if stanza does not exist, update fails, return False.
                     False -- Do not check the stanza.
        this function will create the stanza if the stanza does not exists. If stanza exists, update the stanza.
        """

        # remove the 'name' property when it equals stanza name
        # it will cause REST errors
        if stanza == new_key_values.get('name', ""):
            del new_key_values['name']

        self._create_conf_if_not_exist(conf_name)
        key_values = {}
        conf_file = self.conf_mgr.get_conf(conf_name, refresh=True)
        stanza_exist = is_stanza_exists(conf_file, stanza)
        if not stanza_exist and check_exist:
            return False

        if not stanza_exist:
            new_key_values = common_util.filter_eai_property(new_key_values)
            conf_file.update(stanza, new_key_values)
            return True

        conf_dict = conf_file.get(stanza)
        old_keys = list(old_key_values.keys())
        for k, v in list(conf_dict.items()):
            if k in old_keys:
                continue
            key_values[k] = v

        key_values.update(new_key_values)

        if remove_default_properties:
            key_values = self.remove_splunk_properties(conf_name, key_values)
        if stanza_exist and delete_existing_stanza:
            conf_file.delete(stanza)
        key_values = common_util.filter_eai_property(key_values)
        if stanza == key_values.get('name', ""):
            del key_values['name']

        if key_values:
            conf_file.update(stanza, key_values)
        return True

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def get_conf_stanza(self,
                        conf_name,
                        stanza=None,
                        curr_app_only=False,
                        remove_default_properties=True):
        backup_app_name = self.app_name

        if stanza:
            res = {}
            try:
                conf = self.conf_mgr.get_conf(conf_name)
                conf.reload()
                key_values = conf.get(stanza, curr_app_only)
                if remove_default_properties:
                    key_values =  self.remove_splunk_properties(conf_name, key_values)
                res = key_values
            except ConfManagerException as cme:
                self.logger.warn("Get conf stanza fails. %s", traceback.format_exc())
                return dict()
            except ConfStanzaNotExistException as cnee:
                self.logger.warn("Stanza %s doens't exist. %s", stanza, traceback.format_exc())
                return {}
            except Exception:
                msg = traceback.format_exc()
                self.logger.error("Cannot get %s conf %s stanza: %s", conf_name, stanza, msg)
            finally:
                self.app_name = backup_app_name
                res["name"] = stanza
                return res
        else:
            res = []
            try:
                conf = self.conf_mgr.get_conf(conf_name)
                conf.reload()
                all_stanzas = conf.get_all(curr_app_only)
                # in order to keep the backward compatable, have to do the trick
                for k, stanza in list(all_stanzas.items()):
                    stanza['name'] = k

                for k, stanza in list(all_stanzas.items()):
                    key_values = stanza
                    if remove_default_properties:
                        key_values = self.remove_splunk_properties(conf_name, stanza)
                    if key_values:
                        res.append(key_values)
                return res
            except ConfManagerException as cme:
                self.logger.warn("Get all conf stanzas fails. %s", traceback.format_exc())
            except Exception:
                msg = traceback.format_exc()
                self.logger.error("Cannot get %s conf: %s", conf_name, msg)
            finally:
                self.app_name = backup_app_name
                return res

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def delete_conf_stanza(self, conf_name, stanza):
        try:
            # try to remove the stanza
            self.conf_mgr.get_conf(conf_name).delete(stanza)
        except:
            # if the conf file in default folder has same stanza,
            # REST cannot remove it, so we just remove the stanza in local/conf
            local_props_path = os.path.join(os.environ['SPLUNK_HOME'], "etc",
                                            "apps", self.app_name, "local",
                                            "{}.conf".format(conf_name))

            if not os.path.isfile(local_props_path):
                return

            lines = []
            with open(local_props_path, "r") as f:
                in_stanza = False
                for line in f.readlines():
                    line = line.strip()
                    if line.startswith("["):
                        if re.match(r"\[{}\][\s\r\n]*".format(stanza), line):
                            in_stanza = True
                        else:
                            in_stanza = False

                    if not in_stanza:
                        lines.append(line)

            with open(local_props_path, "w") as f:
                f.write("\n".join(lines))

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def remove_splunk_properties(self, conf_name, key_values):
        remove_properties = ("appName", "userName")

        default_key_values = self.default_kv.get(conf_name)
        if not default_key_values:
            default_key_values = self.get_splunk_default_kv(conf_name)
            self.default_kv[conf_name] = default_key_values

        for k, v in list(key_values.copy().items()):
            default_value = default_key_values.get(k)
            if k in remove_properties or \
                    (default_value is not None and self.is_splunk_value_equals(default_value, v)):
                del key_values[k]

        return key_values

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def get_splunk_default_kv(self, conf_name):
        tab_default_kv = G_DEFAULT_CONF_KV.get(conf_name, {})

        if tab_default_kv:
            return tab_default_kv


        url = "/servicesNS/nobody/{}/configs/conf-{}/_new".format(self.app_name, conf_name)
        resp = self.service.get(url, output_mode='json', count=-1).body.read()

        contents = json.loads(resp)
        default_kv = contents.get("entry", [{}])[0].get("content", {})

        # add disabled = 0 as default field, in order to filter it out
        disabled = default_kv.get("disabled")
        if disabled is None or not common_util.is_true(disabled):
            default_kv["disabled"] = '0'

        G_DEFAULT_CONF_KV[conf_name] = default_kv
        return default_kv

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def is_splunk_value_equals(self, v1, v2):
        v1 = "" if not v1 else v1
        v2 = "" if not v2 else v2

        v1 = v1.lower()
        v2 = v2.lower()

        if v1 == v2:
            return True

        for myset in self.default_value_sets:
            if v1 in myset and v2 in myset:
                return True

        return False

    @metric_util.function_run_time(tags=['tab_conf_manager', 'conf_mgr'])
    def get_app_only_stanzas(self, key_values, appname):
        if key_values.get("eai:appName", "") == appname:
            return key_values
        return {}

    def is_stanza_exist(self, conf_name, stanza_name):
        conf_file = self.conf_mgr.get_conf(conf_name)
        return is_stanza_exists(conf_file, stanza_name)


_logger = logger.get_builder_util_logger()
@metric_util.function_run_time(tags=['tab_conf_manager'])
def create_tab_conf_manager(session_key, uri, appname, max_pool_len=1):
    s = common_util.create_splunk_service(session_key, uri, appname)
    m = TabConfMgr(uri, session_key, appname, s)
    return m
