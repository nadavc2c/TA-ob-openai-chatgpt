import re

from aob.aob_common.metric_collector import metric_util
from aob.aob_common import builder_constant
from tabuilder_utility import common_util

@metric_util.function_run_time(tags=['alias_util'])
def update_alias(tab_conf_mgr, sourcetype, input_field, output_field,
                 old_input_field=None, old_output_field=None, check_exist=False):
    """
    return: false when the alias already exists and check_exist=True
            true when create a new one
    """
    key_values = tab_conf_mgr.get_conf_stanza("props", sourcetype)
    exp = "{} AS {}".format(input_field, output_field)
    name = _get_alias_name(sourcetype, key_values)
    if old_output_field and old_input_field:
        # update existing alias
        updated_alias = get_updated_alias(old_input_field, old_output_field, key_values)
        old_key_values = updated_alias.get("old_key_values", {})
        new_key_values = updated_alias.get("new_key_values", {})
        for k, v in list(new_key_values.items()):
            new_key_values[k] = "{} {}".format(v, exp)

        if not new_key_values:
            new_key_values = {name: exp}

        return tab_conf_mgr.update_conf_stanza("props",
                                               sourcetype,
                                               old_key_values=old_key_values,
                                               new_key_values=new_key_values,
                                               remove_default_properties=True)
    else:
        # create a new alias
        return tab_conf_mgr.update_conf_stanza("props",
                                               sourcetype,
                                               old_key_values={},
                                               new_key_values={name:exp},
                                               remove_default_properties=True)


@metric_util.function_run_time(tags=['alias_util'])
def delete_alias(tab_conf_mgr, sourcetype, input_field, output_field, check_exist=False):
    """
    return: false when the name doesn't exist and check_exist=True
            true when delete successfully
    """
    key_values = tab_conf_mgr.get_conf_stanza("props", sourcetype)

    updated_alias = get_updated_alias(input_field, output_field, key_values)
    old_key_values = updated_alias.get("old_key_values", {})
    new_key_values = updated_alias.get("new_key_values", {})

    if not old_key_values:
        return

    return tab_conf_mgr.update_conf_stanza("props",
                                           sourcetype,
                                           old_key_values=old_key_values,
                                           new_key_values=new_key_values)

def _get_alias_name(sourcetype, key_values):
    index = 0
    sourcetype = re.sub(r"\W+", "_", sourcetype)
    aob_gen_alias_prefix = "FIELDALIAS-{}_{}_alias_".format(builder_constant.TAB_KO_PREFIX, sourcetype)
    for k,v in list(key_values.items()):
        if k.startswith(aob_gen_alias_prefix):
            curr_index = k.replace(aob_gen_alias_prefix, "")
            try:
                curr_index = int(curr_index)
                if curr_index > index:
                    index = curr_index
            except:
                pass

    index += 1
    name = "{}{}".format(aob_gen_alias_prefix, index)
    return name


@metric_util.function_run_time(tags=['alias_util'])
def get_updated_alias(input_field, output_field, key_values):
    exp_regex = "{} +[Aa][Ss] +{}".format(input_field, output_field)

    # search expression since legacy TA may has multiple FIELDALIAS
    for k, v in list(key_values.items()):
        if not isinstance(v, str):
            continue
        v = v.replace('\\"', '"')
        if re.match(r"^{}$".format(exp_regex), v):
            # remove the alias
            return {"old_key_values": {k: v}}
        elif re.match(r".*{}.*".format(exp_regex), v):
            # update the alias value
            new_exp = re.sub(exp_regex, "", v)
            return {"old_key_values": {k: v}, "new_key_values": {k: new_exp}}

    return {}

def get_alias_fields(alias_string):
    fields = []
    removed_quotes = common_util.replace_quotes(alias_string)
    matches = re.findall(r"([^ ]+) +AS +([^ ]+)", removed_quotes.get("data"), re.IGNORECASE)
    for match in matches:
        if len(match) != 2:
            continue

        k = common_util.restore_data(match[0], removed_quotes.get("tokens"), removed_quotes.get("prefix"))
        v = common_util.restore_data(match[1], removed_quotes.get("tokens"), removed_quotes.get("prefix"))
        fields.append((k,v))

    return fields

