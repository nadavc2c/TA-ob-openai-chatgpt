# encoding = utf-8
from builtins import map
import sys
import os
import shutil
import itertools

from aob.aob_common import builder_constant
from tabuilder_utility.path_util import get_resources_lib_dir

def get_latest_tabuilder_version(service):
    '''
    return the latest version and build
    '''
    app_list = service.apps
    for app in app_list:
        if app.name == builder_constant.ADDON_BUILDER_APP_NAME:
            return app.content.get('version', None), app.content.get('build', None)
    return (None, None)

def _parse_number(n):
    N = sys.maxsize
    try:
        N = int(n)
    except ValueError:
        pass
    return N


def compare_versions(left_version, right_version):
    '''
    return code: 0 means equal. 1 means left < right. -1 means left > right
    '''
    if left_version == right_version:
        return 0
    if left_version is None:
        return 1
    if right_version is None:
        return -1
    left_list = list(map(_parse_number, left_version.split('.')))
    right_list = list(map(_parse_number, right_version.split('.')))
    ret = 0
    for pair in itertools.zip_longest(left_list, right_list, fillvalue=0):
        if (pair[0] == pair[1]):
            continue
        elif (pair[0] < pair[1]):
            ret = 1
            break
        else:
            ret = -1
            break
    return ret

def get_upgrade_info(app_version, tab_version):
    # this feature is introduced from AoB 3.0.0
    cmp = compare_versions(app_version, tab_version)
    if cmp != 1:
        return {}

    upgrade_info = {
        ("2.2.0", "3.0.0"): 79,
    }

    code = upgrade_info.get((app_version, tab_version))
    if code:
        return {"err_code": code}
    return {}

def find_next_upgrade_version(current_version, latest_version, all_version_list):
    for v in all_version_list:
        if compare_versions(current_version, v) == 1 and compare_versions(v, latest_version) == 1:
            # current_version < v and v < latest_version
            return v
    return None

def cleanup_resources_libs():
    resources_lib_dir = get_resources_lib_dir()

    for f in os.listdir(resources_lib_dir):
        fullpath = os.path.join(resources_lib_dir, f)

        if os.path.isdir(fullpath) and f not in ("aob_py2", "aob_py3"):
            shutil.rmtree(fullpath)
        elif os.path.isfile(fullpath) and f in ("decorator.py", "six.py", "socks.py", "sockshandler.py"):
            os.unlink(fullpath)