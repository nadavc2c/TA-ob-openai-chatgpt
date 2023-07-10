from __future__ import absolute_import


from builtins import object
class SplunkObject(object):
    def __init__(self, conf_mgr, name, value, object_type="", sequence=0):
        self.conf_mgr = conf_mgr
        self.name = name
        self.value = value
        self.object_type = object_type
        self.sub_type = ""
        self.sequence = sequence
        self.ignore_output_overwritten = False
        self.input_fields = []
        self.output_fields = []
        self.output_values = []
        self.enable = True
        self.is_used = False
        self.is_case_sensitive = True
        self.is_kv = False
        
    def to_string(self):
        ret = {
            "name": self.name,
            "value": self.value,
            "object_type": self.object_type,
            "sub_type": self.sub_type,
            "ignore_output_overwritten": self.ignore_output_overwritten,
            "sequence": self.sequence,
            "input_fields": self.input_fields,
            "output_fields": self.output_fields,
            "output_values": self.output_values,
            "enabled": self.enabled,
        }
        return ret
    
    def compose_objects(self, app_name):
        handler = self._get_handler()
        return handler.get_obj(self.name, self.value, app_name)
    
    def validate_conflict(self, row, out_kv):
        handler = self._get_handler()
        return handler.validate_conflict(self, row, out_kv)

    def _get_handler(self):
        
        from .splunk_object_alias import AliasHandler
        from .splunk_object_eval import EvalHandler
        from .splunk_object_lookup import LookupHandler
        from .splunk_object_regex import RegexHandler
        
        if self.object_type == "regex":
            handler = RegexHandler(self.conf_mgr)
        elif self.object_type == "alias":
            handler = AliasHandler(self.conf_mgr)
        elif self.object_type == "eval":
            handler = EvalHandler(self.conf_mgr)
        elif self.object_type == "lookup":
            handler = LookupHandler(self.conf_mgr)
        else:
            raise ValueError("The object_type \"{}\" is not supported!".format(self.object_type))
        return handler
    
    def disable(self):
        self.enable = False
        
    def has_used(self):
        self.is_used = True
        
class ValidateHandler(object):
    
    def __init__(self, conf_mgr, sequence):
        self.sequence = sequence
        self.conf_mgr = conf_mgr
        
    def compose_obj(self, name, value, sequence=None):
        sequence = sequence or self.sequence
        return SplunkObject(self.conf_mgr, name, value, self.object_type, sequence)
    
    def validate_conflict(self, obj, row, out_kv, is_used):
        ret = {"is_used": is_used, "output": None}
        
        # skip the output overwritten check
        if obj.ignore_output_overwritten:
            return [ret,]
        
        # validate if the output is overwritten
        for outfield in list(out_kv.keys()):
            if outfield and outfield in list(row.keys()):
                output_err = {
                    "obj": obj,
                    "field": outfield,
                }
                ret["output"] = output_err
                del out_kv[outfield]
        return [ret,]
