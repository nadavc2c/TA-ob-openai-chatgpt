import re
import json

from splunklib import binding

UNWANTED_CIM = ['Splunk_CIM_Validation','internal_audit_logs','internal_server']
SA_CIM = 'Splunk_SA_CIM'


def cim_obj_get_tags(obj):
    tags = []
    possible_tags = []
    tag_matcher = re.compile(r'tag\s*=\s*"?(?P<tag>\w+)')
    or_matcher = re.compile(r"OR.+tag\s*=")
    for line in obj["constraints"]:
        temp_tags = []
        match = tag_matcher.search(line["search"])
        while match:
            temp_tags.append(match.group("tag"))
            match = tag_matcher.search(line["search"], match.end())
        if or_matcher.search(line["search"]):
            possible_tags.extend(temp_tags)
        else:
            tags.extend(temp_tags)
    return tags, possible_tags

def cim_obj_get_fields(obj):
    fields, descriptions = [], {}
    if obj.get("fields"):
        for field in obj["fields"]:
            try:
                fields.append(field["fieldName"])
                field_type, field_comment = field.get("type",""), field.get("comment","")
                if field_type or field_comment:
                    descriptions[field["fieldName"]] = {
                        "field_type": field_type,
                        "field_comment": field_comment
                    }
            except KeyError:
                pass
    if obj.get("calculations"):
        for calc in obj["calculations"]:
            if calc.get("outputFields"):
                for field in calc["outputFields"]:
                    try:
                        fields.append(field["fieldName"])
                        field_type, field_comment = field.get("type",""), field.get("comment","")
                        if field_type or field_comment:
                            descriptions[field["fieldName"]] = {
                                "field_type": field_type,
                                "field_comment": field_comment
                            }
                    except KeyError:
                        pass
    return fields, descriptions

def load_cim_models(service, ret_descriptions = False):
    url = "/services/data/models"
    try:
        resp = service.get(url, output_mode='json', count=-1).body.read()
    except binding.HTTPError as e:
        if e.status != 404:
            raise
        resp = "{}"
    content = json.loads(resp)

    result, fields_descriptions_dict = {}, {}

    if content.get('entry'):
        for model in content['entry']:
            if model['acl'].get('app') != SA_CIM:
                continue
            model_name = model["name"]
            if model_name in UNWANTED_CIM:
                continue
            try:
                model_json = json.loads(model['content']["eai:data"])
            except Exception:
                try:
                    model_json = eval(model['content']["eai:data"], {},
                                      {"false": False,
                                       "true": True})
                except Exception:
                    raise
            result[model_name] = {
                "objects": {},
                "fields": {},
                "displayName": model_json["displayName"]
            }
            for obj in model_json["objects"]:
                if all((obj.get("constraints"), (obj.get("fields") or obj.get(
                    "calculations")), obj.get("parentName") != "BaseSearch")):
                    tags, possible_tags = cim_obj_get_tags(obj)
                    result[model_name]["objects"][obj["objectName"]] = {
                        "parent": obj.get("parentName"),
                        "tags": tags,
                        "possible_tags": possible_tags,
                    }
                    fields, fields_descriptions = cim_obj_get_fields(obj)
                    fields_descriptions_dict.update(fields_descriptions)
                    for field in fields:
                        result[model_name]["fields"][field] = obj["objectName"]

    if not ret_descriptions:
        return result
    else:
        return result, fields_descriptions_dict
