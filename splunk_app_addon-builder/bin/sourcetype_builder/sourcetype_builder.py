from builtins import object
import logging

from aob.aob_common import logger, builder_constant
from tabuilder_utility import tab_conf_manager, app_util, common_util
from tabuilder_utility.ko_util import sourcetype_util
from ta_meta_management import meta_manager
from ta_generator.builder_util import get_event_count, remove_search_time_extractions
from ta_meta_management.meta_const import SOURCETYPE_BUILDER

TA_BUILDER_APP_CATEGORY = builder_constant.ADDON_BUILDER_APP_CATEGORY

_LOGGER = logger.get_sourcetype_builder_logger()
_LOGGER.setLevel(logging.DEBUG)


class SourcetypeBuilder(object):
    """
    Data structure of the sourcetype meta:
    {
        app_name: {
            sourcetype1: {
                conf_data: {
                    # contents of props.conf
                    "time_prefix": "***",
                    "should_linemerge": "***",
                    ...
                },
                metadata: {
                    event_count: int,
                    data_input_name: str,
                    extractions_count: int,
                    cims_count: int,
                }
            }
        }
    }
    """

    def __init__(self,
                 app_name,
                 splunk_uri,
                 splunk_session_key,
                 service_with_tab_context=None,
                 service_with_ta_context=None):
        self.splunk_uri = splunk_uri
        self.splunk_session_key = splunk_session_key
        self.meta_mgr = meta_manager.create_meta_manager(splunk_session_key, splunk_uri, SOURCETYPE_BUILDER, app_name)
        self.tab_conf_mgr = tab_conf_manager.create_tab_conf_manager(splunk_session_key, splunk_uri, app_name)
        self._app = app_name
        if not service_with_tab_context:
            service_with_tab_context = common_util.create_splunk_service(splunk_session_key, splunk_uri)
        self.service_with_tab_context = service_with_tab_context

    def _get_props_conf_filename(self):
        return app_util.get_local_props_conf_filename(self._app)

    def get_all_sourcetype_names(self):
        meta = self.meta_mgr.get_app_meta_data() or {}
        return list(meta.keys())

    def create_sourcetype(self, sourcetype, key_values=None, fail_if_soucetype_exists=True):
        if not key_values:
            key_values = {
                "SHOULD_LINEMERGE": "0",
                "LINE_BREAKER": r"[\r\n]+"
            }
        if self.tab_conf_mgr.create_conf_stanza('props',
                                                sourcetype, key_values, fail_if_soucetype_exists):
            self.meta_mgr.update_app_meta_data({sourcetype: self._get_default_contents(key_values)})
            return True
        else:
            return False

    def import_sourcetype(self, sourcetype, source_app=None, key_values=None):
        if key_values:
            sourcetype_util.remove_sourcetype_contents(self.tab_conf_mgr, source_app, sourcetype)
        else:
            key_values = {"category": TA_BUILDER_APP_CATEGORY, "pulldown_type": 1}

        success = self.tab_conf_mgr.create_conf_stanza("props", sourcetype, key_values)
        while not success:
            stanza = self.tab_conf_mgr.get_conf_stanza("props", sourcetype)
            source_app = stanza.get("eai:access", {}).get("app", "")
            if not source_app:
                break

            if source_app == "system":
                self.tab_conf_mgr.update_conf_stanza("props",
                                                     sourcetype,
                                                     old_key_values={},
                                                     new_key_values=key_values,
                                                     delete_existing_stanza=False)
                break
            sourcetype_util.remove_sourcetype_contents(self.tab_conf_mgr, source_app, sourcetype)
            success = self.tab_conf_mgr.create_conf_stanza("props", sourcetype, key_values)

        self.meta_mgr.update_app_meta_data({sourcetype: self._get_default_contents(key_values)})

    def update_sourcetype(self,
                          sourcetype,
                          key_values=None,
                          check_exist=False):
        """
        return: False when check_exist=True and there is no such sourcetype,
                True otherwise.
        """
        if not key_values:
            key_values = {
                "SHOULD_LINEMERGE": "0",
                "LINE_BREAKER": r"[\r\n]+"
            }

        stanza = self.tab_conf_mgr.get_conf_stanza("props", sourcetype)
        for k,v in list(stanza.items()):
            if sourcetype_util.is_extraction(k):
                key_values[k] = v

        return self.tab_conf_mgr.update_conf_stanza("props", sourcetype, stanza, key_values, check_exist)

    def update_meta(self, sourcetype, metadata):
        meta = self.meta_mgr.get_app_meta_data()
        if meta.get(sourcetype):
            meta[sourcetype]["metadata"] = metadata
        else:
            meta[sourcetype] = {"metadata": metadata}
        self.meta_mgr.update_app_meta_data(meta)

    def delete_sourcetype(self, sourcetype=None):
        """
        Delete the sourcetype info in meta,
        but will NOT update the props.conf
        """
        self.meta_mgr.delete_app_meta_data(sourcetype)

    def get_sourcetype_meta(self):
        return self.meta_mgr.get_app_meta_data()

    def get_sourcetype_contents(self, sourcetype):
        """
        Get sourcetype contents from props.conf
        Extractions will be removed
        :param sourcetype:
        :return:
        {
            "name": sourcetype,
            "source_app": app_name,
            "key_values": conf stanza contents,
        }
        """

        res = {"name": sourcetype}
        stanza = self.tab_conf_mgr.get_conf_stanza("props", sourcetype)
        if not stanza:
            return None
        source_app = stanza.get("eai:access", {}).get("app", "")
        res["source_app"] = "" if source_app == "system" else source_app
        key_values = {}
        for k,v in list(stanza.items()):
            if ":" in k or sourcetype_util.is_extraction(k) or k == 'name':
                continue
            key_values[k] = v
        res["key_values"] = key_values
        return res

    def _get_default_contents(self, key_values=None):
        res = {
            "metadata": {
                "event_count": 0,
                "data_input_name": None,
                "extractions_count": 0,
                "cims_count": 0,
            }
        }

        return res

    def get_all_splunk_sourcetypes(self):
        return list(get_event_count(self.service_with_tab_context).keys())

    def get_index_time_extractions(self):
        '''
        All the props come from the rest call
        return a dict. key are the sourcetype stanza name, values are the index
        time extraction properties
        '''
        stanzas_list = self.tab_conf_mgr.get_conf_stanza('props', remove_default_properties=True)
        stanza_dict = {}
        # filter out the search time extraction
        for stanza in stanzas_list:
            stanza_name = stanza['name']
            stanza_prop = {}
            for k, v in list(stanza.items()):
                if k == 'name' or k.startswith('REPORT-') or k.startswith('FIELDALIAS-') or k.startswith('EVAL-') or k.startswith('LOOKUP-') or k.startswith('EXTRACT-'):
                    continue
                stanza_prop[k] = v
            stanza_dict[stanza_name] = stanza_prop
        _LOGGER.info("Get index time extraction dict:%s", stanza_dict)
        return stanza_dict
