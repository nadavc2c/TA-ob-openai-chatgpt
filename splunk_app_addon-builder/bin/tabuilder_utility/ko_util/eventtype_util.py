import re

from tabuilder_utility import common_util
from aob.aob_common.metric_collector import metric_util

@metric_util.function_run_time(tags=['eventtype_util'])
def get_eventtype(tab_conf_mgr, stanza=None, with_tags=True):
    res = []
    eventtypes = tab_conf_mgr.get_conf_stanza("eventtypes", stanza=stanza, curr_app_only=True)

    if stanza:
        eventtypes = [eventtypes]

    # filter the eventtypes don't have "search" field
    eventtypes = [e for e in eventtypes if e.get("search")]

    if not with_tags:
        return eventtypes

    for eventtype in eventtypes:
        name = eventtype.get("name")
        search = eventtype.get("search")

        # get tags if exists
        tag_values = get_tags(tab_conf_mgr, name)

        eventtype_item = {
            "name": name,
            "search": search,
            "tags": tag_values,
        }

        res.append(eventtype_item)

    if stanza:
        res = res[0]
    return res

@metric_util.function_run_time(tags=['eventtype_util'])
def create_eventtype(tab_conf_mgr, name, search):
    return tab_conf_mgr.create_conf_stanza("eventtypes",
                name, {'search': search}, fail_if_stanza_exists=True)

@metric_util.function_run_time(tags=['eventtype_util'])
def update_eventtype(tab_conf_mgr, name, search, check_exist=False):
    return tab_conf_mgr.update_conf_stanza("eventtypes",
                                           name,
                                           old_key_values={},
                                           new_key_values={'search': search},
                                           check_exist=check_exist,
                                           remove_default_properties=True)

@metric_util.function_run_time(tags=['eventtype_util'])
def update_tags(tab_conf_mgr, eventtype_name, tags, old_tags=None):
    tag_kv = {}
    for tag in tags:
        tag_kv[tag] = "enabled"

    old_tag_kv = {}
    if old_tags:
        for tag in old_tags:
            old_tag_kv[tag] = "enabled"

    name = "eventtype=" + eventtype_name
    tab_conf_mgr.update_conf_stanza("tags",
                                    name,
                                    old_key_values=old_tag_kv,
                                    new_key_values=tag_kv,
                                    remove_default_properties=True)

@metric_util.function_run_time(tags=['eventtype_util'])
def get_tags(tab_conf_mgr, eventtype_name):
    name = "eventtype={}".format(eventtype_name)
    key_values = tab_conf_mgr.get_conf_stanza("tags", name, curr_app_only=True)
    tags = [k for k, v in list(key_values.items()) if v == "enabled"]
    return tags

@metric_util.function_run_time(tags=['eventtype_util'])
def delete_eventtype(tab_conf_mgr, name):
    tab_conf_mgr.delete_conf_stanza("eventtypes", name)
    tag_stanza = "eventtype=" + name
    tab_conf_mgr.delete_conf_stanza("tags", tag_stanza)

@metric_util.function_run_time(tags=['eventtype_util'])
def delete_tag(tab_conf_manager, eventtype_name):
    tag_stanza = "eventtype=" + eventtype_name
    tab_conf_manager.delete_conf_stanza("tags", tag_stanza)

@metric_util.function_run_time(tags=['eventtype_util'])
def get_sourcetypes_from_search_str(search_str):
    res = []

    search = re.sub(r" *= *", "=", search_str)
    search_res = common_util.replace_quotes(search)
    search_without_quotes = search_res.get("data")
    bracket_res = common_util.get_bracket_blocks(search_without_quotes)
    search_without_brackets = bracket_res.get("data")
    sourcetypes_without_quotes = _get_sourcetypes_from_search(search_without_brackets, bracket_res)

    sourcetypes = []
    for st in sourcetypes_without_quotes:
        st_origin = common_util.restore_data(st,
                                             search_res.get("tokens"),
                                             search_res.get("prefix"))
        st_origin = st_origin.strip("'\"")
        sourcetypes.append(st_origin)
    return sourcetypes

@metric_util.function_run_time(tags=['eventtype_util'])
def _get_sourcetypes_from_search(data, bracket_res):

    statements = re.split(r"\s*OR\s*", data)
    is_or_op = True
    if len(statements) == 1:
        statements = re.split(r" +", data)
        is_or_op = False

    res = []
    for statement in statements:
        sourcetypes = re.findall(r"sourcetype\s*=\s*([^\s\\)]+)", statement)

        restore_statement = common_util.restore_data(statement,
                                                     bracket_res.get("tokens"),
                                                     bracket_res.get("prefix"))
        if statement != restore_statement:
            new_sourcetypes = _get_sourcetypes_from_search(restore_statement, bracket_res)
            # if new_sourcetypes is None and is_or_op:
            #     return []
            sourcetypes += new_sourcetypes

        if not sourcetypes and is_or_op:
            # One statement doesn't contain sourcetype
            return []
        res += sourcetypes

    return res
