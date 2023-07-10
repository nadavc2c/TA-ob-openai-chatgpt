import re

from tabuilder_utility import common_util

def update_eval(tab_conf_mgr, sourcetype, output_field, expression,
                old_output_field=None, old_expression=None, check_exist=False):
    """
    return: false when the alias already exists and check_exist=True
            true when create a new one
    """
    key_values = tab_conf_mgr.get_conf_stanza("props", sourcetype)
    name = "EVAL-{}".format(output_field)
    if check_exist and name in key_values:
        return False

    old_key_values = {}
    if old_output_field:
        old_key_values["EVAL-" + old_output_field] = "dummy"
    return tab_conf_mgr.update_conf_stanza("props",
                                           sourcetype,
                                           old_key_values=old_key_values,
                                           new_key_values={name: expression},
                                           remove_default_properties=True)

def delete_eval(tab_conf_mgr, sourcetype, dst_field, check_exist=False):
    """
    return: false when the name doesn't exist and check_exist=True
            true when delete successfully
    """
    name = "EVAL-{}".format(dst_field)
    key_values = tab_conf_mgr.get_conf_stanza("props", sourcetype)
    if check_exist and name not in key_values:
        return False

    return tab_conf_mgr.update_conf_stanza("props",
                                           sourcetype,
                                           old_key_values={name: "dummy"},
                                           new_key_values={})

def get_eval_input_fields(expression, eval_function_names):
    # replace the quotes to empty
    replacement = common_util.replace_quotes(expression)
    exp = replacement.get("data")
    quote_regex = "[\"']?{}_\d+[\"']?".format(replacement.get("prefix"))
    exp = re.sub(quote_regex, "", exp)

    # replace all the eval functions
    eval_regex = "|".join(["\s*{}\s*\(".format(func) for func in eval_function_names])
    exp = re.sub(eval_regex, "", exp)

    # get all the dedup words
    words = [w for w in re.split(r"[^\w\-]+", exp) if w]

    fields = list(set(words))
    return fields