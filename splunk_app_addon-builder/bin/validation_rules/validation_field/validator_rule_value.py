# encoding = utf-8

import re

from aob.aob_common import logger
from tabuilder_utility import search_util, validation_utility
from validation_field.validator_rule_base import ValidateRuleBase

NAMESPACE = "validation_field"

_LOGGER = logger.get_field_extraction_validator_logger()
import logging
_LOGGER.setLevel(logging.DEBUG)


class RuleFieldValue(ValidateRuleBase):
    def __init__(self, spec):
        super(RuleFieldValue, self).__init__(spec)
        self.event = {"rule_name": self.spec['name']}

    def execute(self, validation_context):
        super(RuleFieldValue, self).execute(validation_context)

        val_confs = validation_context.get_property(NAMESPACE, "field_value")
        self.cim_batch_size = validation_context.get_property(NAMESPACE, "cim_batch_size")

        eventtypes = self.get_eventtypes()
        _LOGGER.debug("Get eventtypes for CIM value validation: {}".format(eventtypes))
        for etype in eventtypes:

            search_str = etype.get("search")
            # validate coverage
            self.validate(search_str, etype, val_confs)

        self.event["execute"] = "done"

    def validate(self, search_str, eventtype, val_confs):
        tags = eventtype.get("tags")
        name = eventtype.get("name")

        field_values = self._get_field_values(search_str, name)


        event_tags = field_values.get("tag")
        if not field_values or not event_tags:
            return

        if len(event_tags) > len(tags):
            _LOGGER.debug("Some events have multiple tags: {}".format(event_tags))

        field_restricts = self._get_tag_field_restricts(event_tags, val_confs)

        for appname, restricts in list(field_restricts.items()):
            for field, type in list(restricts.items()):
                values = field_values.get(field)
                if not values:
                    continue

                values = self.validate_values(values, type)

                if not values:
                    self.collect_validation_result("4002",
                                                   field=field,
                                                   eventtype=name,
                                                   tag = event_tags,
                                                   app=appname)
                else:
                    report_values = ",".join(values[:5])
                    if type == "number":
                        self.collect_validation_result("4000",
                                                        name=field,
                                                        app = appname,
                                                        value=report_values,
                                                        eventtype=name,
                                                        tag=",".join(event_tags))
                    elif type == "boolean":
                        self.collect_validation_result("4005",
                                                        name=field,
                                                        app=appname,
                                                        value=report_values,
                                                        eventtype=name,
                                                        tag=",".join(event_tags))
                    else:
                        self.collect_validation_result("4001",
                                                        name=field,
                                                        app=appname,
                                                        value=report_values,
                                                        regex=type,
                                                        eventtype=name,
                                                        tag=",".join(event_tags))

        return

    def validate_values(self, values, restrict):
        failed_values = []
        if restrict == "string":
            return failed_values

        if restrict == "number":
            for value in values:
                try:
                    float(value)
                except:
                    failed_values.append(value)
        elif restrict == "bool":
            for value in values:
                if not re.match(r"^0|1|true|false$", value, re.IGNORECASE):
                    failed_values.append(value)
        else:
            for value in values:
                if not re.match(r"(?:{})".format(restrict) + "$", value, re.IGNORECASE):
                    failed_values.append(value)

        return failed_values


    def _get_tag_field_restricts(self, event_tags, val_confs):
        res = {}
        for appname, models in list(val_confs.items()):
            # found out the matched children tags
            matched_tags = []
            for model in models:
                tags = model.get("tags")
                if not tags or not set(tags) <= set(event_tags):
                    continue

                tag_set = set(tags)
                for matched_tag in list(matched_tags):
                    if tag_set > matched_tag:
                        matched_tags.remove(matched_tag)

                if tag_set not in matched_tags:
                    matched_tags.append(tag_set)

            appfields = {}
            for model in models:
                tags = model.get("tags")
                if not tags:
                    continue

                for matched_tag in matched_tags:
                    if set(tags) == matched_tag:
                        appfields.update(model.get("fields"))

            res[appname] = appfields
        return res

    def _get_field_values(self, search_str, eventtype):
        search_str += " | head {} | dedup _raw | stats values() | transpose".format(self.cim_batch_size)
        _LOGGER.debug("Get field values via search: %s", search_str)

        validation_utility.wait_for_unlock_props(self.app_name)
        validation_utility.lock_props(self.app_name)

        resp = search_util.splunk_search(self.service, search_str)

        validation_utility.unlock_props(self.app_name)
        if not resp:
            msg = "Cannot get any events based on eventtype: {}".format(
                    eventtype)
            _LOGGER.warn(msg)
            self.collect_validation_result("4004", eventtype=eventtype)
            return {}

        ret = {}
        for item in resp:
            field = item.get("column").replace("values(", "").replace(")", "")
            value = item.get("row 1")
            if isinstance(value, list):
                ret[field] = value
            else:
                ret[field] = [value]
        _LOGGER.debug("Got field values: {}".format(ret))
        return ret
