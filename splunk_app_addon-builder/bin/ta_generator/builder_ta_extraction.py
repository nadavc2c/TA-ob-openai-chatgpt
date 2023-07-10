from builtins import range
from builtins import object
import logging
import os
import re

from field_extraction_builder.regex_loader import RegexLoader
import field_extraction_builder.regex_util
from field_extraction_builder.regex_logger import Logs
from field_extraction_builder.data_format.data_format import DataFormat
from field_extraction_builder.data_format.format_handler_table import TableHandler
from field_extraction_builder.data_format.format_handler_kv import KVHandler
from field_extraction_builder.regex_exception import InvalidRegex, CaptureGroupCountError
from tabuilder_utility.builder_exception import CommonException
from ta_generator import builder_util
from tabuilder_utility import common_util

Logs().set_parent_dir(common_util.make_splunk_path(["var", "log", "splunk"]))

from aob.aob_common import logger, builder_constant
from tabuilder_utility import tab_conf_manager, search_util
from tabuilder_utility.ko_util import ko_common_util
from ta_meta_management import meta_manager, meta_manager_event, meta_const
from aob.aob_common.metric_collector import metric_util
_LOGGER = logger.get_field_extraction_builder_logger(logging.DEBUG)

TAB_REPORT_TABLE_RESULTS_OBJ_NAME = "ta_builder_internal_use_table_format_results"
TAB_REPORT_KV_RESULTS_OBJ_NAME = "ta_builder_internal_use_kv_format_results"
TAB_GENERATED_EXTRACTION_PREFIX = "aob_gen"

class TAExtractionBuilder(object):
    """
    Data structure of the sourcetype meta:
    {
        app_name: {
            sourcetype1: {
                data_format: "table" # definied by class DataFormat
                is_parsed: bool,
                regex_results: {
                    # see details in field_extraction_builder/regex_serialize.py
                },
                table_results: {
                    delim: str,
                    header: list,
                },
                kv_results: {
                    delim_pair: str,
                    delim_kv: str,
                    regex: str,
                },
            }
            sourcetype2: {...}
        }
    }
    """
    @metric_util.function_run_time(tags=['field_extraction_builder'])
    def __init__(self,
                 splunk_uri,
                 session_key,
                 app_name,
                 service_with_tab_context=None,
                 service_with_ta_context=None):
        _LOGGER.info("Init Splunk Regex Loader...")
        self.splunk_endpoint = splunk_uri
        self.splunk_session_key = session_key
        self.app_name = app_name
        if service_with_ta_context:
            self.service = service_with_ta_context
        else:
            self.service = common_util.create_splunk_service(session_key, splunk_uri, app_name)
        if service_with_tab_context:
            self.service_with_tab_context = service_with_tab_context
        else:
            self.service_with_tab_context = common_util.create_splunk_service(session_key, splunk_uri)
        self.meta_mgr = meta_manager.create_meta_manager(session_key,
            splunk_uri, meta_const.FIELD_EXTRACT_BUILDER, app_name)

        self.tab_conf_mgr = tab_conf_manager.create_tab_conf_manager(session_key, splunk_uri, app_name)
        self.internal_conf_mgr = tab_conf_manager.create_tab_conf_manager(session_key, splunk_uri, builder_constant.ADDON_BUILDER_APP_NAME)
        self.event_mgr = meta_manager_event.EventMetaManager(self.splunk_endpoint,
            self.splunk_session_key, service=self.service_with_tab_context)

    @metric_util.function_run_time(tags=['field_extraction_builder'])
    def get_events(self, sourcetype, batch_size=None):
        """
        return: the dict of events
        {
            "_raw": raw event,
            ""
        }
        """

        if not batch_size:
            loader = RegexLoader()
            batch_size = loader.conf.batch_size

        search_str = "search index=* sourcetype=\"{}\" | fields timeendpos, timestartpos | head {}".format(
            sourcetype, batch_size)

        events = search_util.splunk_search(self.service, search_str)

        return events

    def run(self, sourcetype, progress_func=None):
        events = self.get_events(sourcetype)

        if not events:
            ce = CommonException()
            ce.set_err_code(4011)
            ce.set_option('sourcetype', sourcetype)
            raise ce

        loader = RegexLoader()
        regex_results = loader.run(events, progress_func)

        if not regex_results:
            return None

        self.event_mgr.load_all_values()
        self.event_mgr.remove_events(sourcetype)

        res = self.get_frontend_results(regex_results)

        # move the events to files rather than KV store
        for group in regex_results.get("groups"):
            group_id = group.get("group_id")
            self.event_mgr.save_events(sourcetype, group_id, group["raw_events"])
            del group["events"]
            del group["raw_events"]
            del group["regex"]["possible_values"]
            del group["seed"]["shared_str_indexes"]
            del group["seed"]["insert_str_points"]
            del group["seed"]["raw_events"]

        meta = self.meta_mgr.get_app_meta_data(sourcetype) or {}
        meta.update({"regex_results_temp": regex_results.copy()})
        try:
            self.meta_mgr.update_app_meta_data({sourcetype: meta})
        except UnicodeDecodeError:
            ce = CommonException()
            ce.set_err_code(4017)
            raise ce

        return res

    def remove_all_unstructured_data_inputs(self):
        """
        Cleanup the data inputs except the monitor data input
        """
        input_type = builder_constant.FIELD_EXTRACTION_MI
        data_inputs = self.internal_conf_mgr.get_data_input(input_type)
        checkpoint_path = common_util.make_splunk_path(["var", "lib",
            "splunk", "modinputs", builder_constant.FIELD_EXTRACTION_MI])

        for data_input in data_inputs:
            name = data_input.get("name")
            if name == builder_constant.FIELD_EXTRACTION_MONITOR_MI:
                continue
            self.tab_conf_mgr.delete_data_input(input_type, name)
            checkpoint_file = os.path.join(checkpoint_path, name)
            if os.path.isfile(checkpoint_file):
                os.remove(checkpoint_file)

    def start_parse_unstructured_data(self, sourcetype, batch_size, incremental_merge=False):
        self.check_event_count(sourcetype)

        # remove all the temp results to save storage
        meta = self.meta_mgr.get_app_meta_data() or {}
        for st, metadata in list(meta.items()):
            if metadata.get("regex_results_temp"):
                del metadata["regex_results_temp"]
        self.meta_mgr.update_app_meta_data(meta)

        input_type = builder_constant.FIELD_EXTRACTION_MI
        loader = RegexLoader()
        key_values = {
            "app_name": self.app_name,
            "batch_size": batch_size or loader.conf.batch_size,
            "incremental_merge": incremental_merge,
        }
        self.internal_conf_mgr.create_data_input(input_type, sourcetype, key_values)

    def cancel_parse_unstructured_data(self, sourcetype):
        input_type = builder_constant.FIELD_EXTRACTION_MI
        self.tab_conf_mgr.delete_data_input(input_type, sourcetype)
        checkpoint_file = common_util.make_splunk_path(["var", "lib",
            "splunk", "modinputs", builder_constant.FIELD_EXTRACTION_MI, sourcetype])
        if os.path.isfile(checkpoint_file):
            os.remove(checkpoint_file)

    def get_unstructured_data_parsing_status(self, sourcetype):
        meta = self.meta_mgr.get_app_meta_data(sourcetype) or {}
        regex_res = meta.get("regex_results_temp", {})
        err_status = regex_res.get("error", {})
        res = {}
        if err_status and err_status.get("code", 0) !=0:
            res["error"] = err_status
            return res
        res = regex_res.get("status", {})
        return res

    def load_unstructured_data_results(self, sourcetype):
        return self._get_unstructured_data_results(sourcetype)

    def get_unstructured_data_results(self, sourcetype):
        return self._get_unstructured_data_results(sourcetype, key="regex_results_temp")

    def _get_unstructured_data_results(self, sourcetype, key="regex_results"):
        meta = self.get_meta_results(sourcetype)

        self.event_mgr.load_all_values()
        if meta and meta.get(key):
            results = meta.get(key)
            for group in results.get("groups", []):
                group_id = group.get("group_id")
                events = self.event_mgr.get_events(sourcetype, group_id)
                group["events"] = events
            return self.get_frontend_results(results)

        return None

    def get_frontend_results(self, regex_results):
        ret = []
        for group in regex_results.get("groups", []):
            item = {
                "regex": group.get("regex").get("regex_with_possible_values"),
                "events": group.get("raw_events") or group.get("events"),
                "enable": group.get("regex").get("enabled"),
            }
            ret.append(item)
        return ret

    @metric_util.function_run_time(tags=['field_extraction_builder'])
    def save_regexes(self, sourcetype, regexes, meta=None):
        if meta is None:
            results = self.meta_mgr.get_app_meta_data(sourcetype)
        else:
            results = meta
        is_temp_exist = False
        if results.get("regex_results_temp", {}).get("groups"):
            groups = results.get("regex_results_temp").get("groups")
            is_temp_exist = True
        elif results.get("regex_results", {}).get("groups"):
            groups = results.get("regex_results").get("groups")
        else:
            msg = "The unstructured data parsing results of sourcetype {} doesn't exist.".format(sourcetype)
            _LOGGER.error(msg)
            raise Exception(msg)

        for i in range(len(regexes)):
            regex = regexes[i]
            group = groups[i]
            group["regex"]["regex_with_possible_values"] = regex.get("data")
            group["regex"]["enabled"] = regex.get("enable", True)

        results["is_parsed"] = True
        results["data_format"] = DataFormat.UNSTRUCTURE

        if is_temp_exist:
            results["regex_results"] = results["regex_results_temp"].copy()
            del results["regex_results_temp"]

        if meta is None:
            self.meta_mgr.update_app_meta_data({sourcetype: results})
            return None
        else:
            return results

    def get_conf_contents(self, sourcetype, regexes):
        index = 1
        props_dict = {}
        sourcetype = field_extraction_builder.regex_util.sourcetype_to_str(
            sourcetype)
        for regex in regexes:
            if not regex.get("enable"):
                continue

            stanza = "{}_{}_stanza_{}".format(TAB_GENERATED_EXTRACTION_PREFIX,
                                              sourcetype,
                                              index)
            extract = "EXTRACT-{}".format(stanza)

            regexText = regex.get("data")

            regexText = regexText.replace("\n", "\\n").replace("\r", "\\r")

            # if there is no capture group, just use the whole raw event as a
            # big capture group
            if not re.findall(r"[^\\]\(\?P<",
                              regexText) and not regexText.startswith("(?P<"):
                _LOGGER.debug('The regex "{}" doesn\'t have any capture groups. Remove it from props.conf'.format(regexText))
                continue

            props_dict[extract] = regexText

            index += 1
        return props_dict

    def get_meta_results(self, sourcetype=None):
        return self.meta_mgr.get_app_meta_data(sourcetype)

    def update_meta_results(self, sourcetype, key_values):
        self.meta_mgr.update_app_meta_data({sourcetype: key_values})

    def get_basic_info(self):
        """
        return None if there is no metadata, else
        {
            sourcetype: {
                extract_count: int,
            }
        }
        """
        ret = {}
        meta = self.meta_mgr.get_app_meta_data()
        if not meta:
            return None
        for sourcetype, results in list(meta.items()):
            regex_results = results.get("regex_results", {})
            groups = regex_results.get("groups", [])
            ret[sourcetype] = {"extract_count": len(groups)}
        return ret

    def delete_sourcetype(self, sourcetype):
        sourcetype_str = re.sub(r"\W+", "_", sourcetype)
        stanza = TAB_REPORT_TABLE_RESULTS_OBJ_NAME + "_for_" + sourcetype_str

        self.tab_conf_mgr.delete_conf_stanza("transforms", stanza)

        stanza = TAB_REPORT_KV_RESULTS_OBJ_NAME + "_for_" + sourcetype_str
        self.tab_conf_mgr.delete_conf_stanza("transforms", stanza)

        self.meta_mgr.delete_app_meta_data(sourcetype)
        self.event_mgr.remove_events(sourcetype)

    def get_sourcetypes(self):
        results = self.get_meta_results() or {}
        return list(results.keys())

    @metric_util.function_run_time(tags=['field_extraction_builder'])
    def update_props_conf(self, sourcetype, regexes):
        new_key_values = self.get_conf_contents(sourcetype, regexes)
        sourcetype_meta = self.meta_mgr.get_app_meta_data(sourcetype) or {}

        # get old extracts
        old_key_values = {}
        sourcetype_str = field_extraction_builder.regex_util.sourcetype_to_str(
            sourcetype)
        extraction_count = len(sourcetype_meta.get("regex_results", {}).get("groups", []))
        for i in range(extraction_count):
            i += 1
            stanza = "EXTRACT-{}_{}_stanza_{}".format(TAB_GENERATED_EXTRACTION_PREFIX,
                                                      sourcetype_str,
                                                      i)
            old_key_values[stanza] = i
        self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                             old_key_values, new_key_values)

    def delete_props_conf(self, sourcetype):
        new_key_values = {}
        key_values = self.tab_conf_mgr.get_conf_stanza("props", sourcetype)
        key_values = common_util.filter_eai_property(key_values)
        for k, v in list(key_values.items()):
            if k.startswith("EXTRACT-") or k.startswith("REPORT-") or k == "KV_MODE":
                continue
            new_key_values[k] = v
        new_key_values = self.tab_conf_mgr.remove_splunk_properties("props", new_key_values)
        self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                             key_values, new_key_values, check_exist=False)

    def get_table_format_results(self, sourcetype, delim=None):
        if not delim:
            meta = self.get_meta_results(sourcetype) or {}
            delim = meta.get("table_results", {}).get("delim", r" ")
        try:
            events = self.get_events(sourcetype, batch_size=1000)
            if not events:
                ce = CommonException()
                ce.set_err_code(4011)
                ce.set_option("sourcetype", sourcetype)
                raise ce

            handler = TableHandler(events, delim)
            return handler.get_table_results()
        except InvalidRegex as e:
            ex = CommonException()
            ex.set_err_code(4012)
            ex.set_option('regex', e.regex)
            raise ex

    def load_table_format_results(self, sourcetype):
        meta = self.get_meta_results(sourcetype) or {}
        table_results = meta.get("table_results", {})
        events = self.get_events(sourcetype, batch_size=1000)
        delim = table_results.get("delim", " ")
        header = table_results.get("header")
        handler = TableHandler(events, delim, header)
        return handler.get_table_results()

    def save_table_format_results(self, sourcetype, headers, delim):
        self.set_sourcetype_data_format(sourcetype, DataFormat.TABLE,
                                        table_delim=delim, table_header=headers)
        sourcetype_str = re.sub(r"\W+", "_", sourcetype)
        stanza = TAB_REPORT_TABLE_RESULTS_OBJ_NAME + "_for_" + sourcetype_str
        self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                             {stanza: "dummy"},
                                             {"REPORT-" + stanza: stanza},
                                             check_exist=False)

        self.tab_conf_mgr.update_conf_stanza("transforms", stanza,
                                             {"FIELDS": "dummy", "DELIMS": "dummy"},
                                             {"FIELDS": r",".join(
                                                 headers), "DELIMS": r'"{}"'.format(delim)},
                                             check_exist=False)

    def save_json_format_results(self, sourcetype):
        self.set_sourcetype_data_format(sourcetype, DataFormat.JSON)
        self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                             {"KV_MODE": "dummy"},
                                             {"KV_MODE": "json"},
                                             check_exist=False)

    def save_xml_format_results(self, sourcetype):
        self.set_sourcetype_data_format(sourcetype, DataFormat.XML)
        self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                             {"KV_MODE": "dummy"},
                                             {"KV_MODE": "xml"},
                                             check_exist=False)

    def get_kv_format_results(self, sourcetype, delim_pair, delim_kv, regex):
        try:
            events = self.get_events(sourcetype, batch_size=1000)
            if not events:
                ce = CommonException()
                ce.set_err_code(4011)
                ce.set_option("sourcetype", sourcetype)
                raise ce

            handler = KVHandler(events, delim_pair, delim_kv, regex)
            return handler.get_kv_results()
        except InvalidRegex as e:
            ex = CommonException()
            ex.set_err_code(4012)
            ex.set_option('regex', e.regex)
            raise ex
        except CaptureGroupCountError as e:
            ex = CommonException()
            ex.set_err_code(4013)
            ex.set_option('regex', e.regex)
            raise ex

    def load_kv_format_results(self, sourcetype):
        meta = self.get_meta_results(sourcetype) or {}
        kv_res = meta.get("kv_results", {})
        if not kv_res:
            msg = "Cannot load the KV results for sourcetype {} since the meta is broken.".format(
                sourcetype)
            _LOGGER.error(msg)
            raise Exception(msg)

        delim_pair = kv_res.get("delim_pair", None)
        delim_kv = kv_res.get("delim_kv", None)
        regex = kv_res.get("regex", None)

        return self.get_kv_format_results(sourcetype, delim_pair, delim_kv, regex)

    def save_kv_format_results(self, sourcetype, delim_pair, delim_kv, regex):
        self.set_sourcetype_data_format(sourcetype, DataFormat.KV,
                                        delim_pair=delim_pair, delim_kv=delim_kv, regex=regex)
        sourcetype_str = re.sub(r"\W+", "_", sourcetype)
        stanza = TAB_REPORT_KV_RESULTS_OBJ_NAME + "_for_" + sourcetype_str
        if not delim_pair and not delim_kv and not regex:
            # auto mode
            self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                                 {"KV_MODE": "dummy",
                                                     "REPORT-" + stanza: "dummy"},
                                                 {"KV_MODE": "auto"},
                                                 check_exist=False)
        elif delim_kv and delim_pair:
            # DELIMS
            self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                                 {"KV_MODE": "dummy",
                                                     "REPORT-" + stanza: "dummy"},
                                                 {"KV_MODE": "none",
                                                     "REPORT-" + stanza: stanza},
                                                 check_exist=False)
            self.tab_conf_mgr.update_conf_stanza("transforms", stanza,
                                                 {"DELIMS": "dummy", "REGEX": "dummy",
                                                     "FORMAT": "dummy"},
                                                 {"DELIMS": r'"{}", "{}"'.format(
                                                     delim_pair, delim_kv)},
                                                 check_exist=False)
        elif regex:
            # REGEX
            self.tab_conf_mgr.update_conf_stanza("props", sourcetype,
                                                 {"KV_MODE": "dummy",
                                                     "REPORT-" + stanza: "dummy"},
                                                 {"KV_MODE": "none",
                                                     "REPORT-" + stanza: stanza},
                                                 check_exist=False)
            self.tab_conf_mgr.update_conf_stanza("transforms", stanza,
                                                 {"REGEX": "dummy", "FORMAT": "dummy",
                                                     "DELIMS": "dummy"},
                                                 {"REGEX": regex,
                                                     "FORMAT": "$1::$2"},
                                                 check_exist=False)

    def get_kv_templates(self):
        return KVHandler.get_kv_templates()

    def detect_sample_format(self, sourcetype, except_if_no_events=True):
        meta = self.get_meta_results(sourcetype) or {}
        if meta.get("is_parsed", False):
            return {
                "data_format": meta.get("data_format", None),
                "table_results": {"delim": meta.get("table_results", {}).get("delim", None)},
                "is_parsed": True,
            }

        events = self.get_events(sourcetype, 50)

        if len(events) < 10:
            _LOGGER.warn("Skip sample format detection since the event count < 10 for sourcetype {}".format(sourcetype))
            return {}

        from field_extraction_builder.data_format.format_handler_base import DataFormatHandler
        handler = DataFormatHandler(events)
        formats = handler.get_format()

        if not formats:
            if except_if_no_events:
                ex = CommonException()
                ex.set_err_code(4011)
                ex.set_option('sourcetype', sourcetype)
                raise ex
            else:
                return {}

        table_delim = formats.get("table_delim")

        meta["data_format"] = formats.get("data_format")
        if table_delim:
            meta["table_results"] = {"delim": table_delim}

        self.update_meta_results(sourcetype, meta)
        return meta

    @metric_util.function_run_time(tags=['field_extraction_builder'])
    def set_sourcetype_parsed(self, sourcetype, is_parsed=True, meta=None):
        if meta is None:
            metadata = self.get_meta_results(sourcetype) or {}
        else:
            metadata = meta
        metadata["is_parsed"] = is_parsed

        if meta is None:
            self.update_meta_results(sourcetype, metadata)
            return None
        else:
            return metadata

    def set_sourcetype_data_format(self, sourcetype, data_format, table_header=None, table_delim=None,
                                   delim_pair=None, delim_kv=None, regex=None):
        meta = self.get_meta_results(sourcetype) or {}
        meta["data_format"] = data_format
        if data_format == DataFormat.TABLE and table_delim:
            meta["table_results"] = {"delim": table_delim, "header": table_header}

        if data_format == DataFormat.KV:
            if delim_pair and delim_kv:
                meta["kv_results"] = {
                    "delim_pair": delim_pair,
                    "delim_kv": delim_kv,
                    "regex": None,
                }
            elif regex:
                meta["kv_results"] = {
                    "delim_pair": None,
                    "delim_kv": None,
                    "regex": regex,
                }
            else:
                meta["kv_results"] = {
                    "delim_pair": None,
                    "delim_kv": None,
                    "regex": None,
                }

        self.update_meta_results(sourcetype, meta)

    @metric_util.function_run_time(tags=['field_extraction_builder'])
    def delete_extraction(self, sourcetype, delete_meta=True, meta=None):
        if meta is None:
            meta = self.get_meta_results(sourcetype) or {}
        data_format = meta.get("data_format")
        if not data_format:
            return

        self.delete_props_conf(sourcetype)

        if delete_meta:
            self.delete_sourcetype(sourcetype)

    def check_event_count(self, sourcetype):
        event_count_dict = builder_util.get_event_count(self.service)
        if event_count_dict.get(sourcetype, 0) == 0:
            ce = CommonException()
            ce.set_err_code(4011)
            ce.set_option('sourcetype', sourcetype)
            raise ce

    def upgrade_from_1_0_1_to_1_1_0(self):
        meta = self.meta_mgr.get_app_meta_data()
        if not meta:
            return
        updated_meta = {}
        for sourcetype, results in list(meta.items()):
            regex_results = results.get("regex_results", None)
            if regex_results:
                results['is_parsed'] = True
                results['data_format'] = DataFormat.UNSTRUCTURE
                updated_meta[sourcetype] = results
        self.meta_mgr.update_app_meta_data(updated_meta)

    def check_fe_available(self):
        return ko_common_util.check_default_conf_exist(self.app_name, builder_constant.CONF_FE_RELATED)

    def merge_confs_from_default_to_local(self):
        ko_common_util.merge_confs_from_default_to_local(self.app_name,
                                                         self.tab_conf_mgr,
                                                         builder_constant.CONF_FE_RELATED)

