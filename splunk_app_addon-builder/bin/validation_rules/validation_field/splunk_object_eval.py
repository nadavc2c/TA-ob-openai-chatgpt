from __future__ import absolute_import
from .splunk_object_base import ValidateHandler
      
class EvalHandler(ValidateHandler):
    
    def __init__(self, conf_mgr):
        super(EvalHandler, self).__init__(conf_mgr, 40000)
        self.object_type = "eval"
        
    def get_obj(self, name, value, app_name):
        #TODO: check input of eval
        obj = self.compose_obj(name, value)
        obj.output_fields = [name.replace("EVAL-", "")]
        return {"objects": [obj], "errors": []}
    
    def validate_conflict(self, obj, row, out_kv):
        ret = [{"is_used": True, "output": {}}]
        output_field = obj.output_fields[0]
        if output_field not in obj.value:
            # TODO: get the value of the output field
            out_kv[output_field] = None
            ret = super(EvalHandler, self).validate_conflict(obj, row, out_kv, True)
        return ret
    
    
