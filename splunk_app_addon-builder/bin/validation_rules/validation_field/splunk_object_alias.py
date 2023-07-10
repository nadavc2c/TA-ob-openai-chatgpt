from __future__ import absolute_import
from builtins import range
import re
from .splunk_object_base import ValidateHandler
           
class AliasHandler(ValidateHandler):
    
    def __init__(self, conf_mgr):
        super(AliasHandler, self).__init__(conf_mgr, 30000)
        self.object_type = "alias"
        
    def get_obj(self, name, value, app_name):
        obj = self.compose_obj(name, value)
        for input_filed, output_field in re.findall(r"([\w\-\.]+)\s+AS\s+([\w\-\.]+)", value, re.IGNORECASE):
            obj.input_fields.append(input_filed)
            obj.output_fields.append(output_field)
        return {"objects": [obj], "errors": []}
    
    def validate_conflict(self, obj, row, out_kv):
        is_used = True
        for i in range(len(obj.input_fields)):
            input_field = obj.input_fields[i]
            output_field = obj.output_fields[i]
            value = row.get(input_field)
            if value:
                out_kv[output_field] = value
            else:
                is_used = False
        
        return super(AliasHandler, self).validate_conflict(obj, row, out_kv, is_used)


