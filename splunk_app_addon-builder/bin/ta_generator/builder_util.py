import os
import uuid
import re
import shutil
import time
import random

from aob.aob_common import builder_constant
from tabuilder_utility import search_util


def generate_code_test_id():
    ts = int(time.time())
    rid = random.randint(0, 1000)
    return 'test_{}_{}'.format(ts, rid)


def add_unique_identification(meta):
    # uuid4 have but very small collision probobility
    if not isinstance(meta, dict):
        raise Exception("metadata type is not dict")
    if 'uuid' in meta:
        raise Exception("uuid already exists")
    meta['uuid'] = uuid.uuid4().hex
    return meta


def get_target_folder(current_ta_dir, folder):
    target_folder = os.path.join(current_ta_dir, folder)
    if not os.path.isdir(target_folder):
        raise Exception("{} folder does not exist".format(folder))
    return target_folder


def get_event_count(service):
    counts = search_util.get_sourcetype_from_index(service)
    ret = {}
    for count in counts:
        ret[count.get("sourcetype")] = count.get("totalCount")
    return ret


def escape_character(text):
    return text.replace('\'', '\\\'').replace('"', '\\"')


def remove_search_time_extractions(key_values):
    res = {}
    for k, v in list(key_values.items()):
        if re.match(
                r"REPORT|EXTRACT|FIELDALIAS|EVAL|LOOKUP|KV_MODE|TRANSFORMS",
                k):
            continue
        res[k] = v
    return res


def copy_tree(src, dst, ignore_pattern, force=False):
    """
    ignore_patterns is a regex
    """
    if not os.path.exists(dst):
        os.makedirs(dst)
    if isinstance(ignore_pattern, str):
        ignore_pattern = re.compile(ignore_pattern)
    for item in os.listdir(src):
        if not ignore_pattern.match(item):
            src_ele = os.path.join(src, item)
            dst_ele = os.path.join(dst, item)
            if os.path.isdir(src_ele):
                if os.path.isfile(dst_ele):
                    if force:
                        # delete the file and copy
                        os.remove(dst_ele)
                    else:
                        raise Exception(
                            'Can not copy dir {} to {}. {} is a existing file.'.format(
                                src_ele, dst_ele, dst_ele))
                copy_tree(src_ele, dst_ele, ignore_pattern, force)
            elif os.path.isfile(src_ele):
                if os.path.isfile(dst_ele):
                    if force:
                        os.remove(dst_ele)
                    else:
                        raise Exception(
                            'Can not copy file {} to {}. {} is an existing file.'.format(
                                src_ele, dst_ele, dst_ele))
                shutil.copy(src_ele, dst_ele)


def generate_global_setting_schema(global_settings):
    '''
    global_settings is the meta data in globalsetting builder
    generate the meta data for setup builder
    '''
    schema = []
    if builder_constant.USR_CREDENTIAL_SETTING in global_settings:
        schema.append({
            'name': 'tab_default_account_username',
            'title': 'Username',
            'description': 'Account Username',
            'type': builder_constant.CREDENTIAL_SCHEMA
        })
        schema.append({
            'name': 'tab_default_account_password',
            'title': 'Password',
            'description': 'Account Password',
            'type': builder_constant.CREDENTIAL_SCHEMA
        })
    if builder_constant.PROXY_SETTING in global_settings:
        schema.append({
            'name': 'proxy',
            'title': 'Proxy',
            'description': 'Proxy Schema',
            'type': builder_constant.PROXY_SCHEMA
        })
    if builder_constant.LOG_SETTINGS in global_settings:
        schema.append({
            'name': 'log_level',
            'title': 'Log Level',
            'description': 'Log level schema',
            'type': builder_constant.LOG_SCHEMA
        })
    customized_settings = global_settings.get(
        builder_constant.CUSTOMIZED_SETTINGS, [])
    for setting in customized_settings:
        schema.append({
            'name': setting.get('name', ''),
            'title': setting.get('label', ''),
            'description': setting.get('help_string', ''),
            'type': builder_constant.CUSTOMIZED_TYPE_MAP.get(setting.get('format_type'), 'text'),
            'default_value': setting.get('default_value', '')
        })
    return schema
