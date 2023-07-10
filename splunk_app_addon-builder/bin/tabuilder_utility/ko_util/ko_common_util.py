import re
import os
import shutil

from tabuilder_utility import common_util, path_util
from tabuilder_utility.ko_util import sourcetype_util

from aob.aob_common.metric_collector import metric_util
from tabuilder_utility.common_util import CommonException
from aob.aob_common import builder_constant

@metric_util.function_run_time(tags=['ko_common_util'])
def get_field_source(tab_conf_mgr, sourcetypes):
    """
    return: dict of where fields come from
    {
        field1: {
            sourcetype1: ['eval'],
            sourcetype2: ['alias', 'eval'],
            ...
        },
        ...
    }
    """
    res = {}
    for sourcetype in sourcetypes:
        key_values = tab_conf_mgr.get_conf_stanza("props", sourcetype)

        for k,v in list(key_values.items()):
            if k.upper().startswith("FIELDALIAS-"):
                alias = re.findall(r"([\w\-\.]+)\s+AS\s+[\w\-\.]+", v, re.IGNORECASE)
                for field in alias:
                    _add_field_source(res, field, sourcetype, "alias")
            elif k.upper().startswith("EVAL-"):
                field = k.replace("EVAL-", "").strip()
                _add_field_source(res, field, sourcetype, "eval")

    return res

@metric_util.function_run_time(tags=['ko_common_util'])
def _add_field_source(fields, field, sourcetype, source):
    if fields.get(field):
        sources = fields.get(field).get(sourcetype)
        if sources:
            sources.append(source)
        else:
            fields[field][sourcetype] = [source]
    else:
        fields[field] = {sourcetype: [source]}


@metric_util.function_run_time(tags=['ko_common_util'])
def remove_extractions_from_props(app_stanzas, appname):
    """
    Make sure you already backup local/props.conf,
    and restore it after calling this method!
    """
    app_root = path_util.get_app_root(appname)

    lines = []

    for stanza in app_stanzas:
        name = stanza.get("name")
        if sourcetype_util.is_sourcetype(name):
            lines.append("[{}]\n".format(name))
            for k, v in list(stanza.items()):
                if ":" in k:
                    continue
                # remove v for extractions
                if sourcetype_util.is_search_time_extraction(k):
                    lines.append("{} = ".format(k))
                else: # skip non-extractions
                    lines.append("{} = {}".format(k, v))
            lines.append("\n")

    local_prop_dir = os.path.join(app_root, "local")
    local_prop_path = os.path.join(local_prop_dir, "props.conf")
    if not os.path.isdir(local_prop_dir):
        os.mkdir(local_prop_dir)

    with open(local_prop_path, "w") as f:
        f.write("\n".join(lines))

def get_field_name_err(name, quote='"'):
    """
    return the error dict if the field name is invalid,
    otherwise return None
    """
    if not name:
        return CommonException(err_code=5060)

    if " " in name and (not name.startswith(quote) or not name.endswith(quote)):
        if quote == '"':
            err_code = 5061
        else:
            err_code = 5062
        return CommonException(err_code=err_code, options={"field": name})

    trim_quotes = name
    if " " in name:
        trim_quotes = name.strip(quote)
    remove_quotes = trim_quotes.replace('\{}'.format(quote), "")
    if quote in remove_quotes:
        if quote == '"':
            err_code = 5063
        else:
            err_code = 5064
        return CommonException(err_code=err_code, options={"field": name})

    return None

def check_default_conf_exist(appname, confs):
    # check if the default folder contains some confs
    app_root = path_util.get_app_root(appname)
    default_path = os.path.join(app_root, "default")

    names = []
    for conf in confs:
        fullpath = os.path.join(default_path, conf)
        if os.path.isfile(fullpath):
            names.append(conf)

    return names


def merge_confs_from_default_to_local(appname, tab_conf_mgr, confs):
    app_root = path_util.get_app_root(appname)
    default_path = os.path.join(app_root, "default")
    local_path = os.path.join(app_root, "local")
    if not os.path.isdir(local_path):
        os.makedirs(local_path)

    for conf in confs:
        conf_name = conf.replace(".conf", "")
        conf_local_path = os.path.join(local_path, conf)
        conf_default_path = os.path.join(default_path, conf)

        if not os.path.isfile(conf_default_path):
            continue

        # default conf doesn't exist
        if not os.path.isfile(conf_default_path):
            continue

        # local conf doesn't exist, just copy default to local
        if not os.path.isfile(conf_local_path):
            shutil.copy(conf_default_path, conf_local_path)
            os.remove(conf_default_path)
            continue

        # merge default & local
        stanzas = tab_conf_mgr.get_conf_stanza(conf_name,
                                                    curr_app_only=True,
                                                    remove_default_properties=True)
        # write files to local folder
        with open(conf_local_path, "w") as f:
            for key_values in stanzas:
                name = key_values.get("name")
                f.write("[{}]\n".format(name))
                del key_values["name"]

                keys = sorted(key_values.keys())
                for k in keys:
                    if ":" in k:
                        continue
                    f.write("{} = {}\n".format(k, key_values[k]))
                f.write("\n")

        os.remove(conf_default_path)