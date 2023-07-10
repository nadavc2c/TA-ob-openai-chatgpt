from __future__ import absolute_import
# encoding = utf-8

import csv

from aob.aob_common import logger
from tabuilder_utility import search_util
from validation_field.validator_rule_base import ValidateRuleBase
from .regex_validator import RegexValidator
from tabuilder_utility import validation_utility

NAMESPACE = "validation_field"

_LOGGER = logger.get_field_extraction_validator_logger()
import logging
_LOGGER.setLevel(logging.DEBUG)


class RuleRegexCoverage(ValidateRuleBase):
    def __init__(self, spec):
        super(RuleRegexCoverage, self).__init__(spec)
        self.event = {"rule_name": self.spec['name']}

    def execute(self, validation_context):
        super(RuleRegexCoverage, self).execute(validation_context)

        search_result_dir = validation_context.get_property(NAMESPACE,
                                                             "search_result")

        sourcetypes = validation_context.get_property(NAMESPACE, "sourcetypes")
        coverage_threshold = validation_context.get_property(
            NAMESPACE, "event_coverage_threshold")

        object_results = validation_context.get_property(NAMESPACE,
                                                         "knowledge_objects")
        if not object_results:
            _LOGGER.error(
                'Cannot get the object results before executing "coverage" rule.')
            return

        self.regex_validator = RegexValidator()

        sourcetype_regexes, invalid_regexes = self._get_sourcetype_regexes(
            object_results)
        for regex in invalid_regexes:
            self.reporter.add_exception(
                severity="Fatal",
                description="Regex \"{}\" is invalid".format(regex),
                solution="Update the regex")

        for sourcetype in sourcetypes:
            fname = validation_utility.get_temp_csv_name(self.vid, sourcetype)
            result_path = self.temp_mgr.get_full_path(fname, search_result_dir)
            if not result_path:
                msg = "Cannot get events from temp file {}".format(result_path)
                _LOGGER.warn(msg)
                continue

            regexes = sourcetype_regexes.get(sourcetype)
            if not regexes:
                _LOGGER.info("No REGEX for sourcetype {}".format(sourcetype))
                continue

            ext_data = {"is_visible": False, "sub_category": "regex_coverage"}
            has_coverage_error = False
            with open(result_path, "r") as f:
                dict_reader = csv.DictReader(f)
                for row in dict_reader:
                    ratio = self._validate_regex_coverage(row, regexes,
                                                          coverage_threshold)
                    if ratio:
                        has_coverage_error = True
                        desc = "Not enough regex to cover event \"{}\"".format(
                            row.get("_raw"))
                        self.reporter.add_exception(description=desc,
                                                    solution="Add more regexes",
                                                    ext_data=ext_data)
            if has_coverage_error:
                desc = (
                    "Some events have low regex coverage. If the field extraction is "
                    "NOT totally based on regexes, please ignore this error; otherwise please "
                    "check the workflow_action of \"validation_id\" to see more details."
                )
                self.reporter.add_exception(description=desc,
                                            solution="Add more regexes")
            else:
                self.reporter.mark_rule_pass_by_sourcetype("Regex coverage check", sourcetype)
        self.event["execute"] = "done"

    def _get_sourcetype_regexes(self, object_results):
        st_regexes = {}
        invalid_regexes = []
        for sourcetype, values in list(object_results.items()):
            if not st_regexes.get(sourcetype):
                st_regexes[sourcetype] = []
            for sequence, objs in list(values.items()):
                for obj in objs:
                    if obj.sub_type == "regex":
                        if self.regex_validator.is_regex_valid(obj.regex):
                            st_regexes[sourcetype].append(obj.regex)
                        else:
                            invalid_regexes.append(obj.regex)
        return st_regexes, invalid_regexes

    def _validate_regex(self, sourcetype_regexes):
        invalid_regexes = []
        for sourcetype, regexes in list(sourcetype_regexes.items()):
            for regex in regexes:
                if not self.regex_validator.is_regex_valid(regex):
                    invalid_regexes.append(regex)
        return invalid_regexes

    def _validate_regex_coverage(self, row, regexes,
                                 coverage_threshold):
        raw = row.get("_raw")

        ratio = self.regex_validator.get_match_ratio(raw, regexes)
        if ratio is None or ratio < coverage_threshold:
            return ratio

        return None


class RuleFieldCoverage(ValidateRuleBase):
    def __init__(self, spec):
        super(RuleFieldCoverage, self).__init__(spec)
        self.event = {"rule_name": self.spec['name']}

    def execute(self, validation_context):
        super(RuleFieldCoverage, self).execute(validation_context)

        cov_confs = validation_context.get_property(NAMESPACE,
                                                    "field_coverage")
        self.cim_batch_size = validation_context.get_property(NAMESPACE, "cim_batch_size")
        eventtypes = self.get_eventtypes()
        for etype in eventtypes:
            # validate coverage
            self.validate_coverage(etype, cov_confs)

        self.event["execute"] = "done"

    def validate_coverage(self, etype, cov_confs):
        search_str = etype.get("search")
        tags = etype.get("tags")

        validation_utility.wait_for_unlock_props(self.app_name)
        validation_utility.lock_props(self.app_name)

        total_count = self._get_total_count(search_str)
        _LOGGER.debug("Total count=%i", total_count)
        if total_count == 0:
            _LOGGER.info(
                "Cannot get any events for this eventtype. Skip validation.")
            validation_utility.unlock_props(self.app_name)
            return

        fields = self._get_field_count(search_str, etype.get("name"))

        validation_utility.unlock_props(self.app_name)
        for tag_field, value in list(cov_confs.items()):
            field = self.get_validate_field(tags, tag_field)
            if not field:
                continue

            field_count = fields.get(field, 0)

            coverage = 1.0 * field_count / total_count
            if coverage < value:
                self.collect_validation_result("3000",
                                            field_name = tag_field,
                                            coverage = coverage,
                                            value = value,
                                            eventtype = etype.get("name"))
            else:
                self.collect_validation_result("3001",
                    field_name = tag_field, eventtype=etype.get("name"))
        return

    def _get_field_count(self, search_str, eventtype):
        search_str += " | head {} | stats count() | transpose".format(self.cim_batch_size)
        _LOGGER.debug("Get field count via search: %s", search_str)
        resp = search_util.splunk_search(self.service, search_str)

        if not resp:
            msg = "Cannot get any events based on eventtype: {}".format(
                    eventtype)
            _LOGGER.warn(msg)
            self.collect_validation_result("3002", eventtype=eventtype)
            return {}

        ret = {}
        for item in resp:
            field = item.get("column").replace("count(", "").replace(")", "")
            value = item.get("row 1")
            ret[field] = int(value)
        _LOGGER.debug("Got all the field count: {}".format(ret))
        return ret

    def _get_total_count(self, search_str):
        search_str += " | head {} | stats count(_raw) | transpose".format(self.cim_batch_size)
        _LOGGER.debug("Get total count via search: %s", search_str)
        ret = search_util.splunk_search(self.service, search_str)
        count = int(ret[0].get("row 1"))
        _LOGGER.debug("Got total count: {}".format(count))
        return count
