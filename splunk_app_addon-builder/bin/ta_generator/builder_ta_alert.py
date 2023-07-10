from builtins import filter
from builtins import object
import os
import traceback
import copy
import importlib
import re
import json

from aob.aob_common import logger
from ta_generator import ta_static_asset_generator
from ta_generator import builder_ta_configuration
from ta_generator import builder_util
from ta_meta_management import meta_manager
from ta_meta_management import meta_const
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.tab_conf_manager import TabConfMgr
from tabuilder_utility import common_util
import ta_modular_alert_builder.modular_alert_builder as mab
from ta_generator.builder_ta_basic import TABasicBuilder
from ta_generator.input_meta_util import TAInputMetaMgr
from aob.aob_common.metric_collector import metric_util
from aob.aob_common.package_util import get_app_version
from aob.aob_common.builder_constant import CONVERTED_RADIO_OPTION_FROM_CHECKBOX_FALSE, CONVERTED_RADIO_OPTION_FROM_CHECKBOX_TRUE
'''
    meta data example: modular alert -- list object
    [{
        "description": "Send HipChat room notifications",
        "short_name": "hipchat",
        "icon_path": "/Users/abc/runtest/modular_alert_builder/test/arf_builder/test_files/test_icon.png",
        "label": "HipChat",
        "active_response": {
            "group": [
                "information gathering",
                "information conve"
            ],
            "task": [
                "block"
            ],
            "technology": [
                {
                    "product": "endpoint",
                    "version": [
                        "1.0"
                    ],
                    "vendor": "symantec"
                }
            ],
            "subject": [
                "router",
                "firewall"
            ]
        },
        "alert_props": {
            "payload_format": "json",
            "is_custom": 1
        },
        "parameters": [
            {
                "label": "Room",
                "required": true,
                "help_string": "Enter the name of the HipChat room to send the notification to",
                "name": "room",
                "format_type": "text"
            },
            {
                "help_link": {
                    "link_url": "{{SPLUNKWEB_URL_PREFIX}}/help?location=learnmore.alert.action.tokens",
                    "link_text": "Learn More",
                    "link_url_type": "internal",
                    "link_tip": "Splunk Help"
                },
                "name": "message",
                "required": true,
                "help_string": "Enter the chat message to send to the HipChat room.The message can include tokens that insert text based on the results of the search.",
                "label": "Message",
                "format_type": "textarea"
            },
            {
                "default_value": "message",
                "name": "notification_type",
                "required": true,
                "help_string": "Choose style of HipChat notification.",
                "possible_values": {
                    "Application Card": "card",
                    "Message": "message"
                },
                "label": "Notification Style",
                "format_type": "dropdownlist"
            },
            {
                "label": "Card Attributes",
                "required": false,
                "help_string": "Choose fields from search result to show in card notification (comma-separated list, supports wildcards).",
                "name": "card_attributes",
                "format_type": "text"
            },
            {
                "label": "Message Format",
                "required": false,
                "possible_values": {
                    "Html": "html",
                    "Plain Text": "plain"
                },
                "name": "message_format",
                "format_type": "radio"
            },
            {
                "default_value": "red",
                "name": "color",
                "required": false,
                "help_string": "Change the background of the hipchat message.",
                "possible_values": {
                    "None": " ",
                    "Purple": "purple",
                    "random": "random",
                    "Grey": "grey",
                    "Yellow": "yellow",
                    "Green": "green",
                    "Red": "red"
                },
                "label": "Message Color",
                "format_type": "dropdownlist"
            },
            {
                "label": "Notify users in the room",
                "required": false,
                "name": "notify",
                "format_type": "checkbox"
            },
            {
                "name": "auth_token",
                "required": false,
                "help_string": "Override the globally configured HipChat Auth Token for this alert (optional).",
                "label": "Auth Token",
                "ctrl_props": {
                    "placeholder": "Optional"
                },
                "format_type": "text"
            }
        ]
    },]

    Notes:
    The active_response parameter is optional.
'''


class TAAlertBuilder(object):
    INPUT_PROPERTY_NAME_PATTERN = re.compile('^[a-zA-Z]\w*$')
    INPUT_NAME_PATTERN = re.compile('^[0-9a-zA-Z][0-9a-zA-Z_-]*$')

    @metric_util.function_run_time(tags=['alert_builder'])
    def __init__(self,
                 appname,
                 uri,
                 session_key,
                 service_with_tab_context=None,
                 service_with_ta_context=None):
        self.__appname = appname
        self.__app_namespace = common_util.get_python_lib_dir_name(
            self.__appname)
        self.__logger = logger.get_alert_builder_logger()
        self.__parent_dir = os.path.split(os.path.realpath(__file__))[0]
        self.__resource_dir = os.path.join(self.__parent_dir, "resources")
        self.__resource_lib_dir = os.path.join(self.__parent_dir,
                                               "resources_lib")
        self.__splunk_home = os.environ['SPLUNK_HOME']
        self.__splunk_app_dir = os.path.join(self.__splunk_home, "etc", "apps")
        self.__current_ta_dir = os.path.join(self.__splunk_app_dir,
                                             self.__appname)
        self.__asset_generator = ta_static_asset_generator.AssetGenerator(
            self.__resource_dir,
            self.__current_ta_dir,
            self.__resource_lib_dir,
            app_name=self.__appname)
        self.__uri = uri
        self.__session_key = session_key

        if service_with_ta_context:
            self.__service_with_ta_context = service_with_ta_context
        else:
            self.__service_with_ta_context = common_util.create_splunk_service(
                session_key, uri, self.__appname)

        self.__conf_mgr = common_util.create_conf_mgr(self.__session_key,
                                                      self.__uri,
                                                      app=self.__appname)
        self.__conf_mgr_with_tab_context = common_util.create_conf_mgr(
            self.__session_key, self.__uri)

        if not service_with_tab_context:
            service_with_tab_context = common_util.create_splunk_service(
                session_key, uri)
        self.__service_with_tab_context = service_with_tab_context
        self.__meta_mgr = meta_manager.create_meta_manager(
            session_key, uri, meta_const.ALERT_ACTION_BUILER, self.__appname)
        self.required_meta_keys = ['name', 'type', 'sourcetype']
        self.__global_vars = None
        self.__basic_builder = TABasicBuilder(self.__appname, uri,
                                              session_key,
                                              self.__service_with_tab_context,
                                              self.__service_with_ta_context)

    # TODO: implement the logic
    def __validate_alert_name(self, name, all_inputs_meta):
        if TAAlertBuilder.INPUT_NAME_PATTERN.match(name) is None:
            ce = CommonException()
            ce.set_err_code(3133)
            raise ce

        loaded_modinputs = [
            i.name for i in self.__service_with_tab_context.modular_input_kinds
        ]
        modinputs_in_meta = [i['name'] for i in all_inputs_meta]
        name_exist = name in loaded_modinputs or name in modinputs_in_meta
        if name_exist:
            ce = CommonException()
            ce.set_err_code(3119)
            ce.set_option('name', name)
            raise ce
        if common_util.contain_reserved_chars(name):
            ce = CommonException()
            ce.set_err_code(3015)
            raise ce
        try:
            checked_module = importlib.import_module(name)
            if checked_module:
                ce = CommonException(e_message='Input name {} conflicts with existing python module name.'.format(
                    name), err_code=3136, options={'input_name': name})
                raise ce
        except ImportError:
            # this is expected errors.
            self.__logger.debug(
                'input name is valid. No package named %s', name)

    def __alert_exist(self, alert, modular_alerts, use_uuid=False):
        if use_uuid:
            uuid = alert.get("uuid", None)
            if uuid is None:
                raise Exception("uuid is not specifies")
            # check all uuids exist
            modular_alert_uuids = [modular_alert.get("uuid", None)
                                   for modular_alert in modular_alerts]

            return uuid in modular_alert_uuids
        else:
            name = alert.get('short_name', None)
            if name is None:
                raise Exception(
                    "name is not specifies, alert={}".format(alert))
            # check all names exist
            modular_alert_names = [modular_alert.get("short_name", None)
                                   for modular_alert in modular_alerts]
            return name in modular_alert_names

    def is_alert_exist(self, alert_name):
        alert_names = [alert['short_name'] for alert in self.get_all_TA_alerts()]
        return alert_name in alert_names

    @property
    def splunk_uri(self):
        return self.__uri

    @property
    def splunk_session_key(self):
        return self.__session_key

    def _get_alert_meta(self):
        modular_alerts = self.__meta_mgr.get_app_meta_data() or {}
        meta = modular_alerts.get("modular_alerts", [])
        # convert all the password parameter to text due to TAB-2434
        for m in meta:
            for p in m.get('parameters', []):
                if p.get('format_type') == 'password':
                    p['format_type'] = 'text'
        return meta

    def get_all_TA_alerts(self):
        if not os.path.isdir(self.__current_ta_dir):
            raise Exception("{} does not exist".format(self.__appname))
        return self._get_alert_meta()

    def get_alert_log_sourcetype(self):
        '''
        according to the DES best practice, '-' is used as the seperator of vendor and technology
        and only ':' is the valid seperator in sourcetype
        '''
        prefix = re.sub(r'\\-+', ':', self.__appname.lower())
        return re.sub(r"[^\\:\da-zA-Z]+", "", prefix) + ":log"

    def get_alert_log_source(self, alert_name):
        return "source::..." + alert_name + "_modalert.log*"

    def create_alert_log_stanza(self, alert_name):
        stanza = {"SHOULD_LINEMERGE": "true", "sourcetype": self.get_alert_log_sourcetype()}
        conf_mgr = TabConfMgr(self.__uri, self.__session_key, self.__appname, self.__service_with_tab_context)
        conf_mgr.update_conf_stanza('props', self.get_alert_log_source(alert_name), {}, stanza)
        self.__logger.debug("create the alert log props stanza in app " + self.__appname)

    def create_TA_alert(self, params):
        modular_alert = params.get("modular_alert", {})
        global_settings = params.get("global_settings", {})

        modular_alerts = self._get_alert_meta()
        if self.__alert_exist(modular_alert, modular_alerts):
            e = CommonException()
            e.set_err_code(10000)
            e.set_option('name', modular_alert.get('short_name', ''))
            raise e
        modular_alert_meta = builder_util.add_unique_identification(
            modular_alert)
        modular_alerts.append(modular_alert_meta)
        self.__meta_mgr.set_app_meta_data({"modular_alerts": modular_alerts})
        self.do_build([modular_alert],
                      global_settings,
                      output_dir=self.__splunk_app_dir)

        self.create_alert_log_stanza(modular_alert['short_name'])

        common_util.reload_splunk_apps(self.__service_with_tab_context)
        return modular_alert_meta.get("uuid")

    def delete_TA_alert(self, modular_alert):
        if not os.path.isdir(self.__current_ta_dir):
            raise Exception("{} does not exist".format(self.__appname))
        modular_alerts_existed = self._get_alert_meta()
        if not self.__alert_exist(modular_alert, modular_alerts_existed):
            raise Exception("Modular alert does not exist")

        def alert_not_equal(alert):
            return alert['short_name'] != modular_alert['short_name']
        modular_alerts = list(filter(alert_not_equal, modular_alerts_existed))
        self.delete_generated_TA_alert(copy.deepcopy(modular_alerts),
                                       copy.deepcopy(modular_alert))
        self.__meta_mgr.set_app_meta_data({"modular_alerts": modular_alerts})

        input_meta_mgr = TAInputMetaMgr(self.__appname, self.__uri, self.__session_key, self.__service_with_tab_context)
        if not modular_alerts and not input_meta_mgr.get_basic_info():
            # no inputs and alert, can delete the global configuration
            self.__logger.debug('Delete the global settings when deleting modular alert.')
            global_conf_builder = builder_ta_configuration.TAConfigurationBuilder(self.__appname, self.__service_with_tab_context, self.__service_with_ta_context)
            global_conf_builder.delete_global_settings()
        self.__asset_generator.cleanup_ta_bin_folder()

        # delete the alert log stanza
        conf_mgr = TabConfMgr(self.__uri, self.__session_key, self.__appname, self.__service_with_tab_context)
        try:
            conf_mgr.delete_conf_stanza('props', self.get_alert_log_source(modular_alert['short_name']))
            self.__logger.debug('delete the log stanza for alert ' + modular_alert['short_name'])
        except:
            self.__logger.error('fail to delete the alert log props stanza for alert %s. %s', modular_alert['short_name'], traceback.format_exc())

        common_util.reload_splunk_apps(self.__service_with_tab_context)
        return modular_alerts

    def update_TA_alert(self, params):
        modular_alert_new = params.get("modular_alert", {})
        global_settings = params.get("global_settings", {})

        if not os.path.isdir(self.__current_ta_dir):
            raise Exception("{} does not exist".format(self.__appname))
        # todo: validate new modular alert data
        modular_alerts = self._get_alert_meta()
        uuid = modular_alert_new.get("uuid", None)
        if not uuid:
            raise Exception("uuid not found in meta {0}".format(modular_alert_new))
        if not self.__alert_exist(modular_alert_new, modular_alerts, use_uuid=True):
            raise Exception("Modular alert dose not exist")

        modular_alert_old = [alert for alert in modular_alerts
                             if alert['uuid'] == uuid][0]

        modular_alerts = [one_alert for one_alert in modular_alerts if one_alert['uuid'] != uuid]
        if self.__alert_exist(modular_alert_new, modular_alerts):
            e = CommonException()
            e.set_err_code(3011)
            e.set_option('name', modular_alert_new.get('short_name', ''))
            raise e

        modular_alerts.append(modular_alert_new)
        self.__meta_mgr.set_app_meta_data({"modular_alerts": modular_alerts})
        self.do_build([modular_alert_new],
                      global_settings,
                      output_dir=self.__splunk_app_dir)
        common_util.reload_splunk_apps(self.__service_with_tab_context)
        return modular_alerts

    def test_modular_alert_code(self, params):
        try:
            params = json.loads(json.dumps(params))
        except Exception as e:
            self.__logger.error('Fail to load alert test params, params="%s", reason="%s"',
                                params, traceback.format_exc())
            raise e

        '''
            {
                "code": "python code",
                "model": {
                    "short_name": "hipchat",
                    "label": "Hipchat",
                    "description": ""
                },
                "configuration": {
                    "message": "hi, there",
                    "room": "roomx",
                    "msg_type": "message"
                }
            }
        '''
        modular_alert = params.get("model")
        build_setting = {
            "short_name": self.__appname,
            "product_id": self.__appname,
            "description": self.__appname,
            "modular_alerts": [modular_alert]
        }
        alert_name = modular_alert.get("short_name")

        pattern = re.compile(r'((http|https)?://)?([\S]+):(\d+)')
        matched = pattern.match(self.__uri)
        if not matched:
            raise Exception(
                "url {} is not with right foramt: {scheme}://{host}:{port}".format(self.__uri))

        test_setting = {
            "code": params.get("code"),
            "name": modular_alert.get("short_name"),
            "global_settings": params.get("global_settings"),
            "input_setting": {
                "configuration": params.get("configuration"),
                "stdin_fields": {
                    "session_key": self.__session_key,
                    "server_uri": self.__uri,
                    "server_host": matched.group(3),
                    "server_port": int(matched.group(4)),
                    "app": self.__appname
                }
            }
        }

        global_settings = {
            "session_key": self.__session_key,
            "server_uri": self.__uri,
            "settings": params.get("global_settings")
        }

        try:
            alert_output = mab.test(build_setting=build_setting,
                                    test_setting=test_setting,
                                    short_name=self.__appname,
                                    logger=self.__logger,
                                    version=get_app_version(self.__current_ta_dir),
                                    global_settings=global_settings,
                                    resource_dir=self.__resource_dir,
                                    resource_lib_dir=self.__resource_lib_dir,
                                    )
        except Exception:
            self.__logger.info('Fail to test alert=%s, test_setting="%s", reason="%s"',
                               alert_name, test_setting, traceback.format_exc())
            return {
                "test_framework": {
                    "status": -1,
                    "message": "{}".format(traceback.format_exc())
                },
                "alert_output": {}
            }
        else:
            return {
                "test_framework": {
                    "status": 0,
                    "message": "Successfully finished test",
                },
                "alert_output": alert_output
            }

    def do_build(self, modular_alerts, global_settings, output_dir=None):
        if output_dir:
            addon_builder_conf_path = os.path.join(self.__current_ta_dir,
                                                   "default",
                                                   "addon_builder.conf")
            if not os.path.exists(addon_builder_conf_path):
                try:
                    meta = self.__basic_builder.generate_add_on_builder_conf()
                except Exception as e:
                    self.__logger.error("Field to build addon_builder.conf, reason:%s",
                                        traceback.format_exc())
                    raise e
            else:
                self.__logger.info("addon_builder.conf already eixsts.")

        if modular_alerts and not isinstance(modular_alerts, list):
            msg = 'event="modular_alerts is not a list", modular_alerts="{}"'.format(
                modular_alerts)
            self.__logger.error(msg)
            raise Exception(msg)

        if global_settings and not isinstance(global_settings, dict):
            msg = 'event="global_settings is not a dict", global_settings="{}"'.format(
                global_settings)
            self.__logger.error(msg)
            raise Exception(msg)

        input_setting = {
            "short_name": self.__appname,
            "product_id": self.__appname,
            "description": self.__appname,
            "modular_alerts": modular_alerts
        }

        global_settings = {
            "session_key": self.__session_key,
            "server_uri": self.__uri,
            "settings": global_settings
        }

        try:
            output = mab.build(input_setting=input_setting,
                               logger=self.__logger,
                               short_name=self.__appname,
                               version=get_app_version(self.__current_ta_dir),
                               global_settings=global_settings,
                               output_dir=output_dir,
                               resource_dir=self.__resource_dir,
                               resource_lib_dir=self.__resource_lib_dir,
                               )
        except Exception as e:
            self.__logger.error('Fail to build alert. global_seting="%s", alerts="%s", input_setting="%s", reason="%s"',
                                global_settings,
                                modular_alerts,
                                input_setting,
                                traceback.format_exc())
            raise e
        return output

    def get_modular_alert_code(self, params):
        try:
            params = json.loads(json.dumps(params))
        except Exception as e:
            self.__logger.error('Fail to load alert params, params="%s", reason="%s"',
                                params, traceback.format_exc())
            raise e
        alert_name = params["model"].get("short_name")
        modular_alert = params.get("model")
        global_settings = params.get("global_settings")
        output = self.do_build([modular_alert], global_settings)

        if not output:
            self.__logger.error('Fail to get py code. alert="%s", global_settings="%s"',
                                modular_alert,
                                global_settings)
            return None
        else:
            return output["py"][alert_name][alert_name + '_helper.py']

    def delete_generated_TA_alert(self, current_modular_alerts,
                                  deleted_alert):
        alert_name = deleted_alert.get("short_name")
        build_setting = {
            "short_name": self.__appname,
            "product_id": self.__appname,
            "description": self.__appname,
            "modular_alerts": current_modular_alerts
        }
        self.__logger.info('start to delete alert=%s', deleted_alert)
        self.__logger.info('current_modular_alerts=%s', current_modular_alerts)
        try:
            mab.delete_alerts(build_setting=build_setting,
                              deleted_alerts=[deleted_alert],
                              logger=self.__logger,
                              short_name=self.__appname,
                              version=get_app_version(self.__current_ta_dir),
                              # global_settings=global_settings,
                              ta_dir=self.__splunk_app_dir
                              )
        except Exception as e:
            self.__logger.error('Fail to delete alert. alert="%s",' +
                                'deleted_alert="%s", reason="%s"',
                                alert_name,
                                deleted_alert,
                                traceback.format_exc())
            raise e
        self.__asset_generator.cleanup_ta_bin_folder()

    def upgrade_from_2_0_0_to_2_1_0(self, global_setting_meta):
        meta_updated = False
        modular_alert_meta = self._get_alert_meta()
        for meta in modular_alert_meta:
            # should update the default value of checkbox parameters
            # the default value and value of checkbox should be number 0 or 1
            for param in meta.get('parameters', []):
                if param.get('format_type') == 'checkbox':
                    if param.get('default_value') is not None:
                        default_value = 1 if common_util.is_true(param['default_value']) else 0
                        param['default_value'] = default_value
                        meta_updated = True
                    if param.get('value') is not None:
                        value = 1 if common_util.is_true(param['value']) else 0
                        param['value'] = value
                        meta_updated = True
        self.__logger.info('[upgrade] modular metas:%s', modular_alert_meta)
        if meta_updated:
            self.__meta_mgr.set_app_meta_data({"modular_alerts": modular_alert_meta})
            self.__logger.info('moduler alert meta is upgraded from 2_0_0 to 2_1_0. updated meta:%s', logger.hide_sensitive_field(modular_alert_meta))
        # regen all the modular alerts
        self.do_build(modular_alert_meta,
                      global_setting_meta,
                      output_dir=self.__splunk_app_dir)

    def upgrade_from_2_1_2_to_2_2_0(self):
        modular_alert_meta = self._get_alert_meta()
        for meta in modular_alert_meta:
            short_name = meta.get('short_name')
            if short_name:
                self.create_alert_log_stanza(short_name)
            else:
                self.__logger.error('short name not found in the alert meta.')
        self.__logger.info('upgrade all the alert to the 2.2.0 version.')

    def get_alert_meta_raw(self):
        meta = self.__meta_mgr.get_app_meta_data() or {}
        return meta.get("modular_alerts", [])

    def upgrade_from_2_2_0_to_3_0_0(self, global_settings):
        meta = self.__meta_mgr.get_app_meta_data() or {}
        modular_alert_meta = meta.get("modular_alerts", [])

        if not modular_alert_meta:
            return False

        for alert in modular_alert_meta:
            parameters = alert.get("parameters", [])
            # convert checkbox to radio button
            for param in parameters:
                if param["format_type"] == "checkbox":
                    param["format_type"] = "radio"
                    param["default_value"] = "0"
                    param["possible_values"] = {
                        CONVERTED_RADIO_OPTION_FROM_CHECKBOX_TRUE: 1,
                        CONVERTED_RADIO_OPTION_FROM_CHECKBOX_FALSE: 0,
                    }

        self.__meta_mgr.set_app_meta_data({"modular_alerts": modular_alert_meta})
        self.do_build(modular_alert_meta,
                      global_settings,
                      output_dir=self.__splunk_app_dir)
        return True
