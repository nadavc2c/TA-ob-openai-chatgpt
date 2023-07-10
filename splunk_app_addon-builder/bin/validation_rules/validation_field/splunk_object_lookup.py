from __future__ import absolute_import
import re
import os
from .splunk_object_base import ValidateHandler
from solnlib.conf_manager import ConfManagerException

class LookupHandler(ValidateHandler):
    
    def __init__(self, conf_mgr):
        super(LookupHandler, self).__init__(conf_mgr, 50000)
        self.object_type = "lookup"
        
    def get_obj(self, name, value, app_name):
        obj = self.compose_obj(name, value)
        errors = []
        lookup_stanza = re.split(r"\s+", value)[0]
        
        try:
            transforms_cont = self.conf_mgr.get_conf_stanza("transforms", 
                lookup_stanza, curr_app_only=True)
            if not transforms_cont:
                raise ConfManagerException()
        except ConfManagerException:
            error = {
                "name": name,
                "stanza": lookup_stanza,
            }
            errors.append(error)
            return {"objects": [], "errors": errors}
        
        
        # remove the stanza name
        value = re.sub(r"^\S+", "", value).strip()
        
        # outputnew will NOT overwrite fields
        if "OUTPUTNEW" in value.upper():
            obj.ignore_output_overwritten = True
            
        items = re.split(r"\s+(?:OUTPUTNEW|OUTPUT)\s+", value, flags=re.IGNORECASE)
        inputs = re.split(r"\s*,\s*", items[0])
        need_remove_input_field = False
        if len(items) == 1:
            need_remove_input_field = True
            filename = transforms_cont.get("filename")
            splunk_home = os.environ["SPLUNK_HOME"]
            lookup_path = os.path.join(splunk_home, "etc", "apps", app_name, "lookups", filename)
            with open(lookup_path, "r") as f:
                line = f.readline().strip()
                outputs = re.split(r"\s*,\s*", line)
        else:
            outputs = re.split(r"\s*,\s*", items[1])
            
        
        for inp in inputs:
            input_field = re.split(r"\s+as\s+", inp, flags=re.IGNORECASE)
            obj.input_fields.append(input_field[-1])
            
            if need_remove_input_field:
                if input_field[0] in outputs:
                    outputs.remove(input_field[0])
            
        for output in outputs:
            outp = re.split(r"\s+as\s+", output, flags=re.IGNORECASE)[-1]
            obj.output_fields.append(outp)
        return {"objects": [obj], "errors": []}
    
    def validate_conflict(self, obj, row, out_kv):
        out_kv = {}
        for out in obj.output_fields:
            # don't care the values since lookup is the last one
            out_kv[out] = None
        
        is_used = True
        for field in obj.input_fields:
            if field not in row:
                is_used = False
                break
        return super(LookupHandler, self).validate_conflict(obj, row, out_kv, is_used)
