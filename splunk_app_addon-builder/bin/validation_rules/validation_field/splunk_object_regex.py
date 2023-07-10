from __future__ import absolute_import
from builtins import range
import re
from .splunk_object_base import ValidateHandler
from solnlib.conf_manager import ConfManagerException
from tabuilder_utility import common_util
   
class RegexHandler(ValidateHandler):
    
    def __init__(self, conf_mgr):
        super(RegexHandler, self).__init__(conf_mgr, 20000)
        self.object_type = "regex"
        self._internal_quote_escape = r'__TAB_INTERNAL_QUOTE_ESCAPE__'
        
    def get_obj(self, name, value, app_name):
        objs = []
        errors = []
        
        if name.startswith("EXTRACT"):
            obj = self.compose_obj(name, value)
            obj = self._compose_extract_item(value, obj)
            objs.append(obj)
        else:
            stanzas = re.split(r"\s*,\s*", value)
            
            for i in range(len(stanzas)):
                sequence = self.sequence + i
                    
                stanza = stanzas[i]
                
                try:
                    transform_cont = self.conf_mgr.get_conf_stanza("transforms", stanza)
                    if not transform_cont:
                        raise ConfManagerException()
                except ConfManagerException:
                    error = {
                        "name": name,
                        "stanza": stanza,
                        "category": "cannot_find_stanza"
                    }
                    errors.append(error)
                    continue
                obj = self.compose_obj(name, stanza, sequence)
                
                disabled = transform_cont.get("disabled")
                if disabled == 1:
                    continue
                
                regex = transform_cont.get("REGEX")
                regex = self._replace_modular_regex(regex)
                formats = transform_cont.get("FORMAT")
                delims = transform_cont.get("DELIMS")
                fields = transform_cont.get("FIELDS")
                
                if formats or regex:
                    source_key = transform_cont.get("SOURCE_KEY")
                    if source_key and source_key != "_raw":
                        source_key = re.sub(r"MetaData:", "", source_key, re.IGNORECASE)
                        obj.input_fields = [source_key]
                    
                    if formats:
                        is_malformed_format = False
                        for item in re.split(r"\s+", formats):
                            splits = item.split("::")
                            if len(splits) != 2 or not splits[0] or not splits[1]:
                                error = {
                                    "name": name,
                                    "stanza": stanza,
                                    "format": formats,
                                    "category": "format_error"
                                }
                                errors.append(error)
                                is_malformed_format = True
                                continue
                            
                            field, val = splits
                            obj.output_fields.append(field)
                            obj.output_values.append(val)
    
                        if is_malformed_format:
                            continue
                        
                        obj.sub_type = "regex"
                        
                        if regex.startswith("(?!)"):
                            obj.is_case_sensitive = False
                            regex = regex[4:]
                        obj.regex = regex
                        
                        obj.formats = formats
                    
                    elif regex:
                        obj = self._compose_extract_item(regex, obj)
                        obj.sequence = sequence
                        obj.sub_type = "regex"
                elif fields:
                    if not delims:
                        error = {
                            "name": name,
                            "stanza": stanza,
                            "category": "delims_missing"
                        }
                        errors.append(error)
                        continue
                    delim_1 = delims.strip()[1:-1]
                    splitter = r"[{}]".format(delim_1)
                    obj.output_fields = re.split(r"\s*,\s*", fields)
                    obj.regex = splitter
                    obj.sub_type = "fields"
                elif delims:
                    delim_regex = r'^[ ]*"([^"]+)"[ ]*,[ ]*"([^"]+)"[ ]*$'
                    match = re.match(delim_regex, delims)
                    if not match:
                        # replace \" as text and try again
                        transform_delims = self._replace_quote(delims)
                        match = re.match(delim_regex, transform_delims)
                    if not match:
                        error = {
                            "name": name,
                            "stanza": stanza,
                            "category": "delims_length"
                        }
                        errors.append(error)
                        continue
                    
                    obj.regex = [r"[{}]".format(self._recover_quote(delim)) for delim in (match.group(1), match.group(2))]
                    obj.sub_type = "delims"
                else:
                    continue
                
                objs.append(obj)
        return {"objects": objs, "errors": errors}
    
    def validate_conflict(self, obj, row, out_kv):
        raw = row.get("_raw")
        sub_type = obj.sub_type
        is_used = False
        overwritten_errors = []
        if sub_type == "regex":
            
            # if has input_fields, only match the input value
            if obj.input_fields:
                input_field = obj.input_fields[0]
                if row.get(input_field):
                    raw = row.get(input_field)
                else:
                    return [{
                        "input": {"obj": obj, "field": input_field}, 
                        "output": {}
                    }]
                
            flag = 0
            if not obj.is_case_sensitive:
                flag = re.IGNORECASE

            for find in re.findall(obj.regex, raw, flags=flag):
                is_used = True
                mfields = self._replace_splunk_capture_group(find, obj.output_fields)
                mvalues = self._replace_splunk_capture_group(find, obj.output_values)

                for i in range(len(mfields)):
                    field = mfields[i]
                    value = mvalues[i]
                    if value and field:
                        renamed_field = common_util.rename_search_time_field(field)
                        if renamed_field in list(out_kv.keys()):
                            err = self._output_field_overwrite(obj, renamed_field, out_kv)
                            overwritten_errors.append(err)
                            continue
                        out_kv[renamed_field] = value

        elif sub_type == "fields":
            index = 0
            field_len = len(obj.output_fields)
            for match in re.split(obj.regex, raw):
                if index >= field_len:
                    continue
                name = obj.output_fields[index]
                name = name.strip('"').strip("'")
                name = common_util.rename_search_time_field(name)
                if name in list(out_kv.keys()):
                    err = self._output_field_overwrite(obj, name, out_kv)
                    overwritten_errors.append(err)
                    continue
                out_kv[name] = match.strip()
                index += 1
        elif sub_type == "delims":
            # self._update_delims_out_kv(obj, raw, out_kv)
            delim1, delim2 = obj.regex

            # find a replacement of the delims
            for rd in ("@", "#", "&", "~"):
                if rd not in delim1 and rd not in delim2:
                    replace_delim = rd
                    break
            if replace_delim:
                # replace the contents within ""
                replaces = {}
                index = 0
                for find in re.findall(r'"([^"]+)"', raw):
                    replacement = "{0}{1}{0}".format(replace_delim, index)
                    raw = raw.replace(find, replacement)
                    replaces[replacement] = find
                    index += 1

                for kv_pair in re.split(delim1, raw):
                    splits = re.split(delim2, kv_pair)
                    if len(splits) == 2:
                        is_used = True
                        val = splits[1]
                        if val.startswith('"') and val.endswith('"'):
                            val = val[1:-1]

                        for k, v in list(replaces.items()):
                            if k in val:
                                val = val.replace(val, v)
                        field = common_util.rename_search_time_field(splits[0])
                        if field in list(out_kv.keys()):
                            err = self._output_field_overwrite(obj, field, out_kv)
                            overwritten_errors.append(err)
                            continue
                        out_kv[field] = val
        
        if overwritten_errors:
            return overwritten_errors
        return super(RegexHandler, self).validate_conflict(obj, row, out_kv, is_used)

    def _output_field_overwrite(self, obj, outfield, out_kv):
        ret = {"is_used": True, "output": None}
        output_err = {
            "obj"  : obj,
            "field": outfield,
        }
        ret["output"] = output_err
        del out_kv[outfield]
        return ret

    def _replace_quote(self, input_str):
        return input_str.replace(r'\"', self._internal_quote_escape)

    def _recover_quote(self, input_str):
        return input_str.replace(self._internal_quote_escape, r'"')
                
    def _replace_modular_regex(self, value):
        if not value:
            return None
        matches = set(re.findall(r"\[\[[^\[\]]+\]\]", value))
        for match in matches:
            modular_regex_name = re.sub(r"[\[\]]+", "", match)
            try:
                transform_cont = self.conf_mgr.get_conf("transforms", modular_regex_name, curr_app_only=True)
                if not transform_cont:
                    raise ConfManagerException()
            except ConfManagerException:
                continue
            if not transform_cont.get("REGEX"):
                continue
            regex = transform_cont.get("REGEX")
            value = value.replace(match, regex)
        return value
            
    def _compose_extract_item(self, value, obj):
        if re.search(r" in \w+$", value, re.IGNORECASE):
            value, src_key = re.split(r"\s+in\s+", value)
            obj.input_fields = [src_key]
        obj.output_fields = re.findall(r"\(\?[pP]?<(\w+)>", value)
        
        # if it's KV
#         if len(obj.output_fields) == 2 and re.match("_KEY_\d+", obj.output_fields[0]) \
#             and re.match("_VAL_\d+", obj.output_fields[1]):
        
        for i in range(len(obj.output_fields)):
            obj.output_values.append("${}".format(i+1))
        
        obj.regex = re.sub(r"\?[pP]?<\w+>", "", value)
        obj.sub_type = "regex"
        
        return obj
                        
    def _replace_splunk_capture_group(self, find, mlist):
        ret = []
        for m in mlist:
            if not m:
                ret.append(m)
                continue
            
            match = re.match(r"\$(\d+)$", m)
            if match:
                index = int(match.group(1)) - 1
                if index >= 0 and index < len(find):
                    m = find[index]
                else:
                    m = None
                    
            ret.append(m)
        return ret
            
            
