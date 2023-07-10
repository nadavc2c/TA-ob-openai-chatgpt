# encoding = utf-8
import os
import csv

from aob.aob_common import logger
from validation_field.validator_rule_base import ValidateRuleBase
from tabuilder_utility import validation_utility

NAMESPACE = "validation_field"

_LOGGER = logger.get_field_extraction_validator_logger()
import logging
_LOGGER.setLevel(logging.DEBUG)

class RuleFieldConflict(ValidateRuleBase):
    def __init__(self, spec):
        super(RuleFieldConflict, self).__init__(spec)
        self.event = {"rule_name": self.spec['name']}
        self.results = {} # dedup the results

    def execute(self, validation_context):
        super(RuleFieldConflict, self).execute(validation_context)

        search_result_dir = validation_context.get_property(
            NAMESPACE, "search_result")
        
        object_results = validation_context.get_property(NAMESPACE,
                                                         "knowledge_objects")
        if not object_results:
            _LOGGER.error('Cannot get the object results before executing "conflict" rule.')
            return
        
        sourcetypes = validation_context.get_property(NAMESPACE, "sourcetypes")
        for sourcetype in sourcetypes:
            self.results[sourcetype] = {}
            fname = validation_utility.get_temp_csv_name(self.vid, sourcetype)
            
            result_path = self.temp_mgr.get_full_path(fname, search_result_dir)
            if not result_path:
                msg = "Cannot get events from temp file {}".format(result_path)
                _LOGGER.warn(msg)
                continue
            
            objects = object_results[sourcetype]
            
            if not objects:
                _LOGGER.info("No knowledge objects for sourcetype {}".format(sourcetype))
                continue
            
            if not os.path.isfile(result_path):
                continue
            
            with open(result_path, "r") as f:
                dict_reader = csv.DictReader(f)
                for row in dict_reader:
                    # remove empty values
                    for k,v in list(row.items()):
                        if not v:
                            del row[k]
                    # validate one row
                    self._validate_row(row, objects)
            
            self._report_not_used_results(sourcetype, objects)
            self._report_passed_results(sourcetype, objects)
            
        self.event["execute"] = "done"

    def _report_passed_results(self, sourcetype, objects):
        for seq, objs in list(objects.items()):
            for obj in objs:
                status = self.results[sourcetype].get(obj.name)
                if obj.is_used and obj.enable and status != False:
                        # PASS
                        self.collect_validation_result("2003", 
                            object_name=obj.name, sourcetype=sourcetype)
                    
    def _report_not_used_results(self, sourcetype, objects):
        for seq, objs in list(objects.items()):
            for obj in objs:
                status = self.results[sourcetype].get(obj.name)
                if obj.is_used or status == False:
                    continue
                
                if obj.input_fields:
                    # not used warning, need check dependent field
                    self.collect_validation_result("2001", 
                        object_name=obj.name, sourcetype=sourcetype)
                    
                else:
                    # not used warning
                    self.collect_validation_result("2002", 
                        object_name=obj.name, sourcetype=sourcetype)
                
                self.results[sourcetype][obj.name] = False
        
    def _validate_row(self, row, objects):
        sourcetype = row.get("sourcetype")
        if not objects:
            _LOGGER.debug('Cannot get objects from sourcetype "{}".'.format(sourcetype))
            return

        sequences = sorted(objects.keys())
        for seq in sequences:
            objs = objects.get(seq)
            out_kv = {}
            for obj in objs:
                if not obj.enable:
                    continue
                conflict_results = obj.validate_conflict(row, out_kv)
                self._report_result(conflict_results, sourcetype, obj)
            # save the dict of field & value for next sequence
            row.update(out_kv)
            
        return
    
    def _report_result(self, conflict_results, sourcetype, obj):
        for conflict_result in conflict_results:
            if conflict_result.get("is_used"):
                obj.has_used()

            if conflict_result.get("output"):
                # skip "not used" rule when there are another failures
                obj.has_used()
                report_field = conflict_result.get("output").get("field")
                report_obj = conflict_result.get("output").get("obj")

                status = self.results[sourcetype].get(report_obj.name)
                if status != False:
                    # failed due to field overwritten
                    self.collect_validation_result("2000", field_name=report_field,
                        object_name=report_obj.name, sourcetype=sourcetype)
                    self.results[sourcetype][report_obj.name] = False
                obj.disable()
            
    def _get_obj_hash_names(self, object_results):
        names = []
        for sourcetype, obj_dict in list(object_results.items()):
            for sequence, objs in list(obj_dict.items()):
                for obj in objs:
                    hash_name = self._get_hash_name(sourcetype, obj)
                    names.append(hash_name)
        return names

    def _get_hash_name(self, sourcetype, obj):
        return "{}_{}_{}".format(sourcetype, obj.name, obj.value)


