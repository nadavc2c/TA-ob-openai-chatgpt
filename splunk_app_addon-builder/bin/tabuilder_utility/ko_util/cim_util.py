import re
import json


from splunklib import binding
from aob.aob_common import builder_constant
from aob.aob_common.metric_collector import metric_util
from tabuilder_utility.builder_exception import CommonException
from aob.aob_common.logger import get_cim_builder_logger

MODEL_BLACKLIST = ['Splunk_CIM_Validation', 'Splunk_Audit']
APP_BLACKLIST = ["search",]

logger = get_cim_builder_logger()

MODEL_ATTR_ERR = "The attribute \"%s\" is required in each data model."
OBJECT_ATTR_ERR = "The attribute \"%s\" is required in each model object."
OBJECT_COMMENT_ATTR_ERR = "The attribute \"%s\" is required in each object->comment attribute."
OBJECT_FIELDS_COMMENT_ATTR_ERR = "The attribute \"%s\" is required in each object->fields->comment attribute."
PARENT_NOT_FOUND_ERR = "The parent model \"%s\" should be defined before each child."

@metric_util.function_run_time(tags=['cim_util'])
def load_cim_models(service):
    """
    Load the installed data models and return:
    {
        root: {
            children: [
                appname: {
                    name: string,
                    children: [
                        {
                            children: [],
                            name: string,
                            display_name: string,
                            parent_model: string,
                            description: string,
                            ta_relevant: bool,
                            namespace: [
                                appname, 
                                parent_model_name,
                                ...
                                curr_model_name,
                            ],
                            tags: [],
                            constraints: [
                                {search: string},
                                ...
                            ],
                            fields: [
                                {
                                    name: string,
                                    type: string|number,
                                    description: string,
                                },
                                ...
                            ],
                        },
                    ],
                }
                appname2: {
                    name: string,
                    children: [],
                }
            ]
        }

    }
    """

    res = {"error": {}, "root": {}}
    try:
        content = _get_cim_by_rest(service)
    except:
        res["error"] = {"err_code": 5302}
        return res

    if content is None:
        res["error"] = {"err_code": 5300}
        return res

    models = []
    for appname, appcont in list(content.items()):
        if appname in APP_BLACKLIST:
            continue

        app_root = {"name": appname, "children": []}
        for base_model_name, data in list(appcont.items()):
            base_display_name = _get_model_attr(data, "displayName", MODEL_ATTR_ERR)
            base_desc = _get_model_attr(data, "description", MODEL_ATTR_ERR)

            app_parent = {
                "name": base_model_name,
                "display_name": base_display_name,
                "description": base_desc,
                "namespace": [appname, base_model_name],
                "ta_relevant": False,
                "parent_model": None, # BaseEvent or BaseSearch, will fill in later
                "children": []
            }
            app_models = []

            if base_model_name in MODEL_BLACKLIST:
                continue

            for object in data.get("objects", []):
                item, has_err = _get_object_items(object)

                if item is None:
                    app_root["error"] = {"err_code": 5303}
                    continue

                if has_err:
                    app_root["error"] = {"err_code": 5303}

                obj_name = item.get("name")
                obj_parent_name = item.get("parent_model")

                if obj_parent_name in ("BaseEvent", "BaseSearch"):
                    item["namespace"] = [appname, base_model_name, obj_name]
                    app_models.append(item)
                else:
                    parent_obj = _find_parent_model(app_models, obj_parent_name)
                    if parent_obj is None:
                        # raise CommonException(err_code=5304, options={"name": obj_parent_name})
                        msg = PARENT_NOT_FOUND_ERR % obj_parent_name
                        logger.error(msg)
                        continue
                    item["fields"] += parent_obj["fields"]
                    item["namespace"] = parent_obj["namespace"] + [obj_name,]

                    children = parent_obj.setdefault("children", [])
                    children.append(item)

            app_parent["children"] = app_models
            app_root["children"] += [app_parent,]
        models.append(app_root)

    res["root"] = {"children": models}
    return res

def _get_model_attr(json, attr, fmt=None, msg=None):
    val = json.get(attr)
    if val is None:
        if fmt is not None:
            msg = fmt % attr
        logger.error(msg)

    return val

def _get_object_items(object):

    obj_name = _get_model_attr(object, "objectName", OBJECT_ATTR_ERR)
    obj_display_name = _get_model_attr(object, "displayName", OBJECT_ATTR_ERR)
    obj_parent_name = _get_model_attr(object, "parentName", OBJECT_ATTR_ERR)
    obj_constraints = _get_model_attr(object, "constraints", OBJECT_ATTR_ERR)

    if obj_name is None:
        logger.error("Must have attribute 'objectName' in object {}".format(object))
        return None, None

    if obj_display_name is None:
        logger.error("Must have attribute 'displayName' in object {}".format(object))
        return None, None

    if obj_parent_name is None:
        logger.error("Must have attribute 'parentName' in object {}".format(object))
        return None, None

    if obj_constraints is None:
        logger.error("Must have attribute 'constraints' in object {}".format(object))
        return None, None

    obj_comment = _get_model_attr(object, "comment", OBJECT_ATTR_ERR) or {}
    ta_relevant = obj_comment.get("ta_relevant", True)
    if ta_relevant and not obj_comment:
        logger.error("Must have 'comment' attribute in object {}".format(object))
        return None, None

    tags = []
    if ta_relevant:
        tags = _get_model_attr(obj_comment, "tags", OBJECT_COMMENT_ATTR_ERR)
        if not tags:
            logger.error("Must have 'comment->tags' attribute in object {}".format(object))
            return None, None

    # merge fields & outputFields
    fields, has_err = _get_fields_by_object(object)

    item = {
        "name"        : obj_name,
        "display_name": obj_display_name,
        "parent_model": obj_parent_name,
        "constraints" : obj_constraints,
        "tags"        : tags,
        "fields"      : fields,
        "ta_relevant" : ta_relevant,
    }

    return item, has_err

def _find_parent_model(models, obj_parent_name):
    for model in models:
        if obj_parent_name == model.get("name"):
            return model

    for m in models:
        children = m.get("children")
        if children:
            return _find_parent_model(children, obj_parent_name)

    return None

def _get_cim_by_rest(service):
    url = "/services/data/models"
    try:
        resp = service.get(url, output_mode='json', count=-1).body.read()
    except binding.HTTPError as e:
        if e.status == 404:
            logger.warn("Failed to get any apps with data models installed. Please make sure there is something ")
            return None
        else:
            raise e

    content = json.loads(resp)

    res = {}
    for entry in content.get("entry", []):
        base_model_name = entry["name"]

        data = entry.get("content", {}).get("eai:data")

        appname = entry.get("acl", {}).get("app")
        models = res.setdefault(appname, {})
        data = json.loads(data)
        models[base_model_name] = data

    return res

@metric_util.function_run_time(tags=['cim_util'])
def get_models_by_tags(model_tree, tags):
    res = {}


    def _find_objects(model, tags, objs):
        curr_tags = model.get("tags")
        ta_relevant = model.get("ta_relevant", True)
        if curr_tags and ta_relevant and set(curr_tags) <= set(tags):
            # check if the parent model is matched
            for obj in list(objs):
                obj_tags = obj.get("tags", [])
                if obj_tags and set(obj_tags) < set(curr_tags):
                    objs.remove(obj)
            objs.append(model)

        for sub_model in model.get("children", []):
            _find_objects(sub_model, tags, objs)

    for app in model_tree.get("root", {}).get("children", []):
        appname = app.get("name")
        matched_objs = []
        for model in app.get("children", []):
            _find_objects(model, tags, matched_objs)

        res[appname] = matched_objs


    return res

def _get_fields_by_object(object):
    res = []
    has_err = False

    def _get_field_item(field):
        name = field["fieldName"]
        comment = _get_model_attr(field, "comment", OBJECT_FIELDS_COMMENT_ATTR_ERR) or {}
        if not name or not isinstance(comment, dict):
            return None

        if not comment.get("ta_relevant", True):
            return {}

        item = {
            "name": name,
            "type": field.get("type"),
            "description": comment.get("description")
        }
        expect_values = comment.get("expected_values", [])
        if expect_values:
            item["expected_values"] = expect_values
        return item

    for field in object.get("fields", []):
        item = _get_field_item(field)
        if item is None:
            has_err = True
        elif item:
            res.append(item)

    for calc in object.get("calculations", []):
        for field in calc.get("outputFields", []):
            item = _get_field_item(field)
            if item is None:
                has_err = True
            elif item:
                res.append(item)

    return res, has_err

# @metric_util.function_run_time(tags=['cim_util'])
# def crawl_eval_functions():
#     """
#     return: the dict of all the eval functions
#     {
#         function_name: {
#             expression: str,
#             description: str,
#             example: str,
#         }
#     }
#     """
#     import requests
#     from HTMLParser import HTMLParser
#     import cgi
#
#     url = "http://docs.splunk.com/Documentation/Splunk/latest/SearchReference/CommonEvalFunctions"
#     response = requests.get(url)
#     if response.status_code != 200:
#         return None
#
#     contents = response.content
#
#     fields = []
#
#     parser = HTMLParser()
#     for h2, table in re.findall(r"<h2([\s\S]*?)</h2>[\r\n]+<table([\s\S]*?)</table>", contents):
#         ids = re.findall(r"id=[\"']?(\w+)[\"']?", h2)
#         category = ids[-1]
#         tds = re.findall(r"<td[^>]*>([\s\S]*?)</td>", table)
#
#         while tds:
#             example = _escape_data(tds.pop(), parser)
#             desc = _escape_data(tds.pop(), parser)
#             exp = _escape_data(tds.pop(), parser)
#
#             name = re.sub(r"\(.*\)", "", exp).strip()
#             if not name:
#                 continue
#
#             item = {
#                 "name": name,
#                 "category": category,
#                 "expression": exp,
#                 "description": desc,
#                 "example": example,
#             }
#             fields.append(item)
#
#     return fields
#
# def _escape_data(data, parser):
#     data = re.sub(r"</?[^>]+>", "", data, flags=re.MULTILINE)
#     data = parser.unescape(data)
#     data = re.sub(r"[\r\n]+", " ", data)
#     return data
#
# @metric_util.function_run_time(tags=['cim_util'])
# def update_eval_functions_to_conf(conf_mgr, functions):
#     for func in functions:
#         name = func.get("name")
# #         conf_file = conf_mgr.get_conf("aob_eval_functions")
# #         conf_file.update(name, func, ["example"])
# #         tab_conf_mgr.update_conf_stanza("aob_eval_functions", name,
# #             old_key_values={}, new_key_values=func)
#
#     with open("./funcs.conf", "w") as f:
#         for func in functions:
#             name = func.get("name")
#             f.write("[{}]\n".format(name))
#             for k,v in func.items():
#                 f.write("{} = {}\n".format(k, v))
#             f.write("\n")
#
#     return
