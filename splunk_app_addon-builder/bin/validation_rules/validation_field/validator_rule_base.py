from __future__ import absolute_import
# encoding = utf-8
import validation_engine.base_rule as brule
from tabuilder_utility.temp_manager import TempManager
from .splunk_object_base import SplunkObject
from aob.aob_common import logger, builder_constant
from tabuilder_utility import validation_utility, common_util, tab_conf_manager
from tabuilder_utility.ko_util import cim_util

import re
import os
import time
from solnlib.conf_manager import ConfManagerException

NAMESPACE = "validation_field"
TA_BUILDER_APP_NAME = builder_constant.ADDON_BUILDER_APP_NAME

_LOGGER = logger.get_field_extraction_validator_logger()
import logging
_LOGGER.setLevel(logging.DEBUG)


class ValidateRuleBase(brule.BaseRule):
    def __init__(self, spec):
        super(ValidateRuleBase, self).__init__(spec)

    def execute(self, validation_context):
        self.splunk_endpoint = validation_context.get_splunk_endpoint()
        self.splunk_session_key = validation_context.get_splunk_session_key()
        self.service = common_util.create_splunk_service(self.splunk_session_key, self.splunk_endpoint)

        self.app_name = validation_context.get_global_property("app_name")
#         self.conf_mgr = common_util.create_conf_mgr(self.splunk_session_key, self.splunk_endpoint, self.app_name)
        self.tab_conf_mgr = tab_conf_manager.TabConfMgr(self.splunk_endpoint,
            self.splunk_session_key, self.app_name, service=None)

        self.ta_builder_conf_mgr = common_util.create_conf_mgr(
            self.splunk_session_key,
            self.splunk_endpoint,
            app=TA_BUILDER_APP_NAME)

        self.vid = validation_context.get_job_id()
        self.temp_mgr = TempManager()

        validation_utility.unlock_props(self.app_name)

    def get_eventtypes(self):
        ret = []
        conf_mgr = common_util.create_conf_mgr(
            self.splunk_session_key, self.splunk_endpoint, "-")
        eventtypes = validation_utility.get_app_stanzas(
            conf_mgr, "eventtypes", self.app_name)
        tag_list = validation_utility.get_app_stanzas(
            conf_mgr, "tags", self.app_name)
        for eventtype in eventtypes:
            etype = {}
            tags = []
            stanza = eventtype.get("name")
            for tag_dict in tag_list:
                if tag_dict.get("name") == "eventtype={}".format(stanza):
                    for k, v in list(tag_dict.items()):
                        if v == "enabled":
                            tags.append(k.strip())
                    break
            _LOGGER.debug("Get tags: {}".format(tags))

            search = eventtype.get("search")
            if not search:
                continue

            search_prefix = "search index=* "
            etype["search"] = search_prefix + search
            etype["tags"] = tags
            etype["name"] = stanza
            ret.append(etype)

        return ret

    def get_validate_field(self, tags, key):
        if "." not in key:
            return key

        m = re.match(r"\{([^\}]+)\}\.([\w\-\.]+)", key)
        if not m:
            msg = "Field name '{}' is incorrect.".format(key)
            _LOGGER.error(msg)
            return None

        restrict_tags = re.split(r"\s*,\s*", m.group(1))
        for tag in restrict_tags:
            if tag not in tags:
                return None

        return m.group(2)

class PreCondition(ValidateRuleBase):
    def __init__(self, spec):
        super(PreCondition, self).__init__(spec)
        self.event = {"rule_name": self.spec['name']}

    def execute(self, validation_context):
        super(PreCondition, self).execute(validation_context)

        _LOGGER.info("Check errors in context.")
        errors = validation_context.get_property(NAMESPACE, "errors")
        for err in errors:
            self.collect_validation_result(err.get("message_id"), **(err.get("options")))

        self.event["execute"] = "done"

class RuleGetConf(ValidateRuleBase):
    def __init__(self, spec):
        super(RuleGetConf, self).__init__(spec)
        self.event = {"rule_name": self.spec['name']}

    def execute(self, validation_context):
        super(RuleGetConf, self).execute(validation_context)

        _LOGGER.info("Read field_validator.conf...")
        self.config = self._read_conf(self.vid)

        _LOGGER.info("Set validator configurations to context.")
        for k, v in list(self.config.items()):
            validation_context.set_property(NAMESPACE, k, v)

        self.event["execute"] = "done"

    def _read_conf(self, vid):
        conf = self.ta_builder_conf_mgr.get_conf("field_validator")
        stanzas = conf.get_all()

        _LOGGER.debug("Contents of field_validator.conf: {}".format(stanzas))

        search_result_dir = "search_results_{}".format(self.vid)

        config = {
            "search_result": search_result_dir
        }

        for name, stanza in list(stanzas.items()):
            if name == "common":
                try:
                    batch_size = int(stanza.get("cim_batch_size", 100000))
                except:
                    batch_size = 100000
                config["cim_batch_size"] = batch_size
            elif name == "regex":
                try:
                    threshold = float(stanza.get("event_coverage_threshold", 0.5))
                except:
                    threshold = 0.5
                config["event_coverage_threshold"] = threshold
            elif name == "field_coverage":
                coverage_conf = validation_utility.remove_splunk_fields(stanza)
                key_values = {}
                for k, v in list(coverage_conf.items()):
                    try:
                        key_values[k] = float(v)
                    except:
                        pass

                config["field_coverage"] = key_values
                config["field_value"] = self._get_validate_field_values()

        _LOGGER.debug("Contents of field validator builder: {}".format(config))
        return config

    def _get_validate_field_values(self):
        model_tree = cim_util.load_cim_models(self.service)

        res = {}
        def get_restrict(models):
            res = []
            for base_models in models:
                for model in base_models.get("children", []):
                    tags = model.get("tags", [])
                    name = model.get("name")
                    ta_relevant = model.get("ta_relevant", True)
                    if not ta_relevant or not tags:
                        continue

                    fields = {}
                    for field in model.get("fields", []):
                        expect_values = field.get("expected_values", [])
                        type = field.get("type")
                        if expect_values:
                            type=  "|".join(expect_values)
                        fields[field.get("name")] = type

                    res.append({"name":name, "tags": tags, "fields": fields})

                    children = model.get("children")
                    if children:
                        res += get_restrict(children)
            return res


        for app in model_tree.get("root", {}).get("children", []):
            appname = app.get("name")
            appres = get_restrict(app.get("children", []))
            res[appname] = appres
        return res


class RuleGetObjects(ValidateRuleBase):
    def __init__(self, spec):
        super(RuleGetObjects, self).__init__(spec)
        self.event = {"rule_name": self.spec['name']}

    def execute(self, validation_context):
        super(RuleGetObjects, self).execute(validation_context)

        _LOGGER.info("Get sourcetypes within app_name: %s", self.app_name)
        sourcetypes = self._get_sourcetypes(self.app_name)
        validation_context.set_property(NAMESPACE, "sourcetypes", sourcetypes)
        if not sourcetypes:
            _LOGGER.info("Cannot get any sourcetypes.")
            return
        _LOGGER.debug("Got sourcetypes: {}".format(sourcetypes))

        _LOGGER.info("Get the knowledge objects.")
        object_results = {}
        for sourcetype in sourcetypes:
            object_result = self._get_objects_by_sourcetype(sourcetype)
            object_results[sourcetype] = object_result

        _LOGGER.debug("Got knowledge objects: {}".format(object_results))
        _LOGGER.info("Set the knowledge objects to context.")
        validation_context.set_property(NAMESPACE, "knowledge_objects",
                                        object_results)

        self.event["execute"] = "done"

    def _get_sourcetypes(self, app_name):
        splunk_home = os.environ["SPLUNK_HOME"]
        ta_path = os.path.join(splunk_home, "etc", "apps", app_name)
        props_default_path = os.path.join(ta_path, "default", "props.conf")
        props_local_path = os.path.join(ta_path, "local", "props.conf")

        stanzas = []
        for props_path in (props_default_path, props_local_path):

            if not os.path.isfile(props_path):
                continue

            with open(props_path, "r") as f:
                for line in f.readlines():
                    stanza = re.findall(r"^\[([^\[\]]+)\]$", line.strip())
                    if stanza:
                        stanzas.append(stanza[0])

        _LOGGER.debug("Get all the stanzas in app {}: {}".format(app_name,
                                                                 stanzas))

        sourcetypes = []
        for stanza in stanzas:
            if re.match(r"host::|source::|rule::|delayedrule::", stanza):
                continue
            sourcetypes.append(stanza)

        return sourcetypes

    def _get_objects_by_sourcetype(self, sourcetype):
        """
        return: {
            10000: [objs],
            20000: [objs],
            ...
        }
        """

        props_cont = self.tab_conf_mgr.get_conf_stanza("props", sourcetype)
        results = {}
        for name, value in list(props_cont.items()):
            if not value and re.match(r"REPORT|EXTRACT|FIELDALIAS|EVAL|LOOKUP",
                                      name):
                self.collect_validation_result("1000", object_name=name, staza=sourcetype)
                continue

            if name.startswith("REPORT") or name.startswith("EXTRACT"):
                obj = SplunkObject(self.tab_conf_mgr, name, value, "regex")
            elif name.startswith("FIELDALIAS"):
                obj = SplunkObject(self.tab_conf_mgr, name, value, "alias")
            elif name.startswith("EVAL"):
                obj = SplunkObject(self.tab_conf_mgr, name, value, "eval")
            elif name.startswith("LOOKUP"):
                obj = SplunkObject(self.tab_conf_mgr, name, value, "lookup")
            else:
                continue

            object_result = obj.compose_objects(self.app_name)
            objects = object_result.get("objects")
            for error in object_result.get("errors"):
                name = error.get("name")
                stanza = error.get("stanza")
                fmt = error.get("format")
                category = error.get("category")

                if category == "format_error":
                    self.collect_validation_result("1001",
                        object_name=name, stanza=stanza, format=fmt)
                elif category == "cannot_find_stanza":
                    self.collect_validation_result("1002", stanza=stanza, object_name=name)
                elif category == "delims_missing":
                    self.collect_validation_result("1003", stanza=stanza, object_name=name)
                elif category == "delims_length":
                    self.collect_validation_result("1004", stanza=stanza, object_name=name)

            self._append_obj_by_sequence(results, objects)

        return results

    def _append_obj_by_sequence(self, results, objs):
        for obj in objs:
            sequence = obj.sequence
            if results.get(sequence):
                results[sequence].append(obj)
            else:
                results[sequence] = [obj]
        return
