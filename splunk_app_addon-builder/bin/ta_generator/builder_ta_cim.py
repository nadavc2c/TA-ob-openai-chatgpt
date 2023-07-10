from builtins import object
import os
import re
import sys
# try:
#     from compiler.ast import flatten
# except ImportError:
#     from itertools import chain as flatten
# import shutil

from ta_meta_management import meta_const
from ta_meta_management import meta_manager

from aob.aob_common import logger, builder_constant
from tabuilder_utility import tab_conf_manager, common_util, \
    search_util, path_util
from tabuilder_utility.ko_util import eventtype_util, ko_common_util, \
    sourcetype_util, cim_util, alias_util, eval_util
from tabuilder_utility.builder_exception import CommonException
from aob.aob_common.metric_collector import metric_util

'''
No metadata for CIM builder
'''

LOGGER = logger.get_cim_builder_logger()

class TACIMBuilder(object):
    @metric_util.function_run_time(tags=['cim_builder'])
    def __init__(self,
                 appname,
                 splunkd_uri,
                 session_key,
                 service_with_tab_context=None,
                 service_with_ta_context=None,
                 ):
        self.appname = appname
        self.splunkd_uri = splunkd_uri
        self.session_key = session_key

        if service_with_ta_context:
            self.service = service_with_ta_context
        else:
            self.service = common_util.create_splunk_service(session_key, splunkd_uri, appname)
        if not service_with_tab_context:
            service_with_tab_context = common_util.create_splunk_service(session_key, splunkd_uri)
        self.meta_mgr = meta_manager.create_meta_manager(session_key, splunkd_uri, meta_const.CIM_MAPPING_BUILDER, appname)
        self.conf_mgr = common_util.create_conf_mgr(session_key, splunkd_uri, self.appname)
        self.tab_conf_mgr = tab_conf_manager.create_tab_conf_manager(session_key, splunkd_uri, appname)
        self.tab_conf_mgr_with_tab_context = tab_conf_manager.create_tab_conf_manager(session_key, splunkd_uri, builder_constant.ADDON_BUILDER_APP_NAME)

    @metric_util.function_run_time(tags=['cim_builder'])
    def get_sourcetypes_from_index(self):
        rs = search_util.get_sourcetype_from_index(self.service)
        sourcetypes = [{'sourcetype': r['sourcetype']} for r in rs]
        return sourcetypes

    @metric_util.function_run_time(tags=['cim_builder'])
    def get_sourcetypes_from_eventtype_search(self, search_str, sourcetype_dict, validate_selected=True):
        # validate if the search string contains sourcetypes
        valid_search = search_util.is_splunk_search_valid(self.service, search_str)
        if not valid_search:
            raise CommonException(err_code=5027, options={"search": search_str})

        search_without_quotes = common_util.replace_quotes(search_str).get("data")
        if "|" in search_without_quotes:
            raise CommonException(err_code=5028)

        sourcetypes = eventtype_util.get_sourcetypes_from_search_str(search_str)

        if not sourcetypes:
            e = CommonException(err_code=5013, options={"search": search_str})
            raise e

        app_sourcetypes = list(sourcetype_dict.keys())

        if validate_selected:
            selected_sourcetypes = [s for s, selected in list(sourcetype_dict.items()) if selected]

            diffset = set(sourcetypes) - set(selected_sourcetypes)
            if diffset:
                raise CommonException(err_code=5025, options={'sourcetypes': "/".join(diffset)})

            diffset = set(selected_sourcetypes) - set(sourcetypes)
            if diffset:
                raise CommonException(err_code=5026, options={'sourcetypes': "/".join(diffset)})

        for sourcetype in sourcetypes:
            # throw exception when wildcard in sourcetype
            if "*" in sourcetype:
                e = CommonException(err_code=5012, options={'sourcetype': sourcetype,
                                                            'search': search_str})
                raise e

            # throw exception when search sourcetypes not in app sourcetypes
            if sourcetype not in app_sourcetypes:
                e = CommonException(err_code=5014, options={'sourcetype': sourcetype,
                                                            'search': search_str})
                raise e

        return sourcetypes

    @metric_util.function_run_time(tags=['cim_builder'])
    def validate_eventtype_name(self, name):
        if not name:
            raise CommonException(err_code=5009)

        if not re.match(r"\w+$", name):
            raise CommonException(err_code=5008, )


    @metric_util.function_run_time(tags=['cim_builder'])
    def get_eventtype_info(self):
        eventtypes = eventtype_util.get_eventtype(self.tab_conf_mgr)
        model_tree = cim_util.load_cim_models(self.service)
        app_sourcetypes = self.get_app_sourcetypes()
        sourcetype_dict = {sourcetype: True for sourcetype in app_sourcetypes}
        for eventtype in eventtypes:
            # get models
            tags = eventtype.get("tags")
            eventtype["models"] = cim_util.get_models_by_tags(model_tree, tags)

            # get sourcetype
            search = eventtype.get("search")
            try:
                sourcetypes = self.get_sourcetypes_from_eventtype_search(search,
                                                                         sourcetype_dict,
                                                                         validate_selected=False)
            except CommonException:
                sourcetypes = []

            eventtype["sourcetypes"] = sourcetypes

        return eventtypes

    @metric_util.function_run_time(tags=['cim_builder'])
    def update_eventtype(self, old_name, name, search, sourcetype_dict):
        if old_name and old_name != name:
            tags = eventtype_util.get_tags(self.tab_conf_mgr, old_name)
            self.create_eventtype(name, search, sourcetype_dict)
            eventtype_util.update_tags(self.tab_conf_mgr, name, tags)
            eventtype_util.delete_eventtype(self.tab_conf_mgr, old_name)
        else:
            self.validate_eventtype_name(name)
            self.get_sourcetypes_from_eventtype_search(search, sourcetype_dict)
            eventtype_util.update_eventtype(self.tab_conf_mgr, name, search)

    @metric_util.function_run_time(tags=['cim_builder'])
    def create_eventtype(self, name, search, sourcetype_dict):
        self.validate_eventtype_name(name)
        self.get_sourcetypes_from_eventtype_search(search, sourcetype_dict)

        success = eventtype_util.create_eventtype(self.tab_conf_mgr, name, search)
        if not success:
            raise CommonException(err_code=5007, options={"eventtype": name})

    @metric_util.function_run_time(tags=['cim_builder'])
    def delete_eventtype(self, name):
        eventtype_util.delete_eventtype(self.tab_conf_mgr, name)

    @metric_util.function_run_time(tags=['cim_builder'])
    def get_model_tree(self):
        """
        :return: a dict of all the models as a tree
        Note that it's a recursive definition
        Reserved fields: name, display_name, fields, tags, has_children
        Other fields: the children of this model
        {
            CIM: {
                Alerts: {
                    name: str,
                    display_name: str,
                    fields: list,
                    tags: list,
                    has_children: bool,
                },
                Application_State: {
                    name: str,
                    has_children: bool,
                    Ports: {
                        name: str,
                        display_name: str,
                        fields: list,
                        tags: list,
                        has_children: bool,
                    }
                },
            }
        }
        """
        models = cim_util.load_cim_models(self.service)
        return models

    @metric_util.function_run_time(tags=['cim_builder'])
    def get_field_values(self, search, fields=()):
        """
        :param search: search string of eventtype
        :param field: get all field values & groups if None;
                      otherwise only get its values
        :return: list of field summary sorted by name
        [
            {
                name: field1,
                count: int,
                distinct_count: int,
                values: [
                    {
                        value: str,
                        count, int,
                        percent: float,
                    },
                    ...
                ],
            },
            ...
        ]
        """
        fields = list(set(fields))
        field_summary = search_util.get_field_summary(self.service, search, fields)

        for item in list(field_summary):
            name = item.get("name")
            if name in ("tag", "eventtype") or name.startswith("tag:"):
                field_summary.remove(item)

            # remove the fields have values
            if name in fields:
                fields.remove(name)

        # add fields with empty values
        for f in fields:
            field_summary.append({"name": f, "values": None})

        field_summary = sorted(field_summary, key=lambda x : x["name"])
        return field_summary

    @metric_util.function_run_time(tags=['cim_builder'])
    def validate_eval(self, sourcetypes, expression, field_values, eval_functions):
        # TODO: add this to validator
        eval_function_names = list(eval_functions.keys())
        common_util.validate_brackets_and_quotes(expression)
        input_fields = eval_util.get_eval_input_fields(expression, eval_function_names)

        for values in field_values:
            name = values.get("name")
            # validate if the input fields are from another EVAL
            if name in input_fields:
                input_fields.remove(name)
                for sourcetype in sourcetypes:
                    source = values.get("source", {}).get(sourcetype, [])
                    raise CommonException(err_code=5018, options={"sourcetype": sourcetype, "field": name})

        # validate if all the input fields exist
        if input_fields:
            raise CommonException(err_code=5019, options={"fields": "/".join(input_fields)})

    @metric_util.function_run_time(tags=['cim_builder'])
    def update_eval(self, sourcetypes, output_field, expression, search,
                    old_output_field=None, old_expression=None, check_exist=False):

        output_field = output_field.strip(" ")
        # validate if the field name contains blanks
        err = ko_common_util.get_field_name_err(output_field, quote="'")
        if err:
            raise err

        if old_output_field == output_field and old_expression == expression:
            return None

        # check if eval exists for all sourcetypes
        if check_exist or output_field != old_output_field:
            stanzas = self.tab_conf_mgr.get_conf_stanza("props", curr_app_only=True)
            for stanza in stanzas:
                sourcetype = stanza.get("name")
                eval_name = "EVAL-" + output_field
                if sourcetype in sourcetypes and stanza.get(eval_name):
                    raise CommonException(err_code=5020, options={"field": output_field})

        for sourcetype in sourcetypes:
            eval_util.update_eval(self.tab_conf_mgr,
                                  sourcetype,
                                  output_field,
                                  expression,
                                  old_output_field,
                                  old_expression,
                                  check_exist=check_exist)

        res = self._get_new_values(search, output_field, old_output_field)
        return res

    @metric_util.function_run_time(tags=['cim_builder'])
    def delete_eval(self, sourcetype, output_field, search):
        eval_util.delete_eval(self.tab_conf_mgr,
                                   sourcetype,
                                   output_field)
        res = self._get_new_values(search, output_field)
        return res

    @metric_util.function_run_time(tags=['cim_builder'])
    def update_alias(self, sourcetypes, output_field, input_field, search,
                     old_output_field=None, old_input_field=None, check_exist=False):

        output_field = output_field.strip(" ")
        input_field = input_field.strip(" ")
        # validate if the field name contains blanks
        err = ko_common_util.get_field_name_err(output_field)
        if err:
            raise err
        # validate if the field name contains blanks
        err = ko_common_util.get_field_name_err(input_field)
        if err:
            raise err

        if output_field == input_field:
            raise CommonException(err_code=5023, options={"field": output_field})

        if old_output_field == output_field and old_input_field == input_field:
            return None

        # Use closure is only for performance monitor
        @metric_util.function_run_time(tags=['cim_builder'])
        def check_alias_exist():
            # check if alias exists for all sourcetypes
            if check_exist or output_field != old_output_field or input_field != old_input_field:
                stanzas = self.tab_conf_mgr.get_conf_stanza("props", curr_app_only=True)
                for stanza in stanzas:
                    sourcetype = stanza.get("name")
                    if sourcetype not in sourcetypes:
                        continue

                    alias_value_regex = r"{} +[Aa][Ss] +{}".format(input_field, output_field)
                    for k, v in list(stanza.items()):
                        if not k.startswith("FIELDALIAS-"):
                            continue

                        if re.match(alias_value_regex, v):
                            raise CommonException(err_code=5024, options={"field": output_field})

        check_alias_exist()

        for sourcetype in sourcetypes:
            alias_util.update_alias(self.tab_conf_mgr,
                                    sourcetype,
                                    input_field,
                                    output_field,
                                    old_input_field,
                                    old_output_field,
                                    check_exist=check_exist)


        res = self._get_new_values(search, output_field, old_output_field)

        return res

    @metric_util.function_run_time(tags=['cim_builder'])
    def delete_alias(self, sourcetype, output_field, input_field, search):
        alias_util.delete_alias(self.tab_conf_mgr,
                                    sourcetype,
                                    input_field,
                                    output_field)

        res = self._get_new_values(search, output_field)
        return res

    @metric_util.function_run_time(tags=['cim_builder'])
    def get_knowledge_objects(self, sourcetypes):
        """
        :param sourcetypes:
        :return: list of knowledge objects
        [
            {
                type: eval/alias,
                output_field: str,
                expression: str,
            }
        ]
        """
        res = []
        for sourcetype in sourcetypes:
            stanza = self.tab_conf_mgr.get_conf_stanza("props",
                                                           sourcetype,
                                                           curr_app_only=True)
            for k, v in list(stanza.items()):
                if k.upper().startswith("EVAL-"):
                    k = k.replace("EVAL-", "")
                    item = {
                        "type": "eval",
                        "output_field": k,
                        "expression": v,
                        "sourcetype": sourcetype,
                    }
                    res.append(item)
                elif k.upper().startswith("FIELDALIAS-"):
                    fields = alias_util.get_alias_fields(v)
                    for field in fields:
                        item = {
                            "type": "alias",
                            "output_field": field[1],
                            "input_field": field[0],
                            "sourcetype": sourcetype,
                        }
                        res.append(item)

        return res

    @metric_util.function_run_time(tags=['cim_builder'])
    def save_models(self, eventtype_name, models, old_models=None):

        tags = [x.get("tags", []) for x in models]
        old_models = old_models or []
        remove_tags = [x.get("tags", []) for x in old_models]

        tags = set(common_util.flatten(tags))
        remove_tags = set(common_util.flatten(remove_tags))
        if tags == remove_tags:
            return

        overlap = tags & remove_tags
        remove_tags = list(remove_tags - overlap)
        tags = list(tags)

        eventtype_util.update_tags(self.tab_conf_mgr, eventtype_name, tags, remove_tags)

    @metric_util.function_run_time(tags=['cim_builder'])
    def check_cim_available(self):
        return ko_common_util.check_default_conf_exist(self.appname, builder_constant.CONF_CIM_RELATED)

    @metric_util.function_run_time(tags=['cim_builder'])
    def merge_confs_from_default_to_local(self):
        ko_common_util.merge_confs_from_default_to_local(self.appname,
                                                         self.tab_conf_mgr,
                                                         builder_constant.CONF_CIM_RELATED)


    def _get_new_values(self, search, output_field, old_output_field=None):
        fields = [output_field]
        if old_output_field and old_output_field != output_field:
            fields.append(old_output_field)
        res = self.get_field_values(search, fields)

        return res

    @metric_util.function_run_time(tags=['cim_builder'])
    def get_app_sourcetypes(self):
        sourcetypes = sourcetype_util.get_app_sourcetypes(self.tab_conf_mgr)
        return sourcetypes
