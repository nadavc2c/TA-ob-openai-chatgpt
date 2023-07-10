import re
import os

from aob.aob_common.metric_collector import metric_util
from tabuilder_utility import data_input_util
from tabuilder_utility.common_util import make_splunk_path

@metric_util.function_run_time(tags=['sourcetype_util'])
def get_app_sourcetypes(tab_conf_mgr):
    sourcetypes = []
    stanzas = tab_conf_mgr.get_conf_stanza("props", curr_app_only=True)
    data_input_log_stanza_names = (data_input_util.get_input_log_source_stanza(tab_conf_mgr.app_name),
                                   data_input_util.get_cce_log_source_stanza(tab_conf_mgr.app_name))
    for stanza in stanzas:
        # skip the renamed sourcetypes
        if stanza.get("rename"):
            continue
        name = stanza.get("name")
        if name in data_input_log_stanza_names:
            continue
        sourcetype = stanza.get("sourcetype") or stanza.get("SOURCETYPE")
        if is_sourcetype(name):
            sourcetypes.append(name)
        elif sourcetype:
            sourcetypes.append(sourcetype)

    return sourcetypes

@metric_util.function_run_time(tags=['sourcetype_util'])
def is_sourcetype(stanza_name):
    return not re.match(r"host::|source::|rule::|delayedrule::", stanza_name)

@metric_util.function_run_time(tags=['sourcetype_util'])
def is_search_time_extraction(name):
    if not name:
        return False
    name = name.strip()
    return re.match(r"(REPORT|EXTRACT|FIELDALIAS|EVAL|LOOKUP)-", name) or name == "KV_MODE"

@metric_util.function_run_time(tags=['sourcetype_util'])
def is_index_time_extraction(name):
    if not name:
        return False
    name = name.strip()
    return re.match(r"TRANSFORMS-", name)

@metric_util.function_run_time(tags=['sourcetype_util'])
def is_extraction(name):
    return is_index_time_extraction(name) or is_search_time_extraction(name)

@metric_util.function_run_time(tags=['sourcetype_util'])
def is_sourcetype_valid(name):
    return re.match(r"[\w:]+$", name)

@metric_util.function_run_time(tags=['sourcetype_util'])
def remove_sourcetype_contents(tab_conf_mgr, source_app, sourcetype):
    # remove sourcetype stanza from source_app
    app_home = make_splunk_path(['etc', 'apps'])
    default_props = os.path.join(app_home, source_app, "default", "props.conf")
    local_props = os.path.join(app_home, source_app, "local", "props.conf")

    remove_stanza_in_conf(default_props, sourcetype)
    remove_stanza_in_conf(local_props, sourcetype)

@metric_util.function_run_time(tags=['sourcetype_util'])
def remove_stanza_in_conf(conf_path, stanza_name):
    if not os.path.isfile(conf_path):
        return

    new_lines = []
    with open(conf_path, "r") as f:
        stanza = "[{}]".format(stanza_name)
        in_stanza = False
        for line in f.readlines():
            if line.strip() == stanza:
                in_stanza = True
            elif in_stanza and line.startswith("["):
                in_stanza = False

            if not in_stanza:
                new_lines.append(line)

    with open(conf_path, "w") as f:
        f.write("".join(new_lines))