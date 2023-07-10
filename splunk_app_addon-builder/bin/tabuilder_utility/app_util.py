from builtins import str
import os
import time
import shutil
import re
import json
import traceback

import solnlib.server_info as server_info
import solnlib.utils as sutils
import splunklib.binding as binding

from ta_meta_management import meta_manager, meta_const, meta_manager_event
from aob.aob_common import logger, builder_constant
from tabuilder_utility import builder_exception, common_util, tab_conf_manager
from aob.aob_common.metric_collector import metric_util

common_util.initialize_apm()

app_path = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps')

APP_BLACK_LIST = [
    '_', 'alert_logevent', 'alert_webhook', 'appsbrowser', 'dmc', 'framework',
    'gettingstarted', 'introspection_generator_addon', 'launcher', 'learned',
    'legacy', 'sample_app', 'SA-Eventgen', 'search', 'splunk_6_5_overview',
    'splunk_app_addon-builder', 'splunk_archiver', 'splunk_datasets_addon',
    'splunk_httpinput', 'splunk_instrumentation', 'splunk_management_console',
    'splunk_monitoring_console', 'Splunk_SA_CIM', 'SplunkForwarder',
    'SplunkLightForwarder', 'user-prefs'
]

_logger = logger.get_builder_util_logger()


def _is_free_license_active(service):
    license_endpoint = "/services/licenser/groups"
    try:
        resp = service.get(license_endpoint, output_mode='json', count=-1).body.read()
        for license_group in json.loads(resp).get('entry'):
            group_title = license_group['name']
            if group_title == 'Free' or group_title == 'Lite_Free':
                if license_group['content']['is_active']:
                    _logger.info("Free license is active!")
                    return True
    except binding.HTTPError as e:
        _logger.error("Fail to get splunk license group. HTTPError:%s",
                      traceback.format_exc())
        return False
    return False


def _get_cluster_server_mode(service):
    mode = 'disabled'
    cluster_conf_endpoint = "/services/cluster/config"
    try:
        resp = service.get(cluster_conf_endpoint,
                           output_mode='json').body.read()
        content = json.loads(resp)
        for entry in content.get('entry', []):
            mode = entry['content']['mode']
    except binding.HTTPError as e:
        _logger.error('Cluster mode return HTTPError:%s.',
                      traceback.format_exc())
    return mode

def _get_shc_disable_flag(service):
    flag = True
    shc_conf_endpoint = "/services/shcluster/config"
    try:
        resp = service.get(shc_conf_endpoint,
                           output_mode='json').body.read()
        content = json.loads(resp)
        _logger.debug("get shc conf:%s", content)
        for entry in content.get('entry', []):
            flag = sutils.is_true(entry['content']['disabled'])
    except binding.HTTPError as e:
        _logger.error('SHC config return HTTPError:%s.',
                      traceback.format_exc())
    return flag

@metric_util.function_run_time(tags=['tab_app_util'])
def is_user_allow_to_create_ta(username, service):
    '''
    return the error code and error params object
    otherwise return None
    '''
    # check if free license is enabled
    if _is_free_license_active(service):
        _logger.info("Add-on builder is not locked in splunk free license")
        return None

    # check the role of current user, only admin can run code
    kwargs = {"sort_key": "realname", "sort_dir": "asc"}
    usrs = service.users.list(count=-1, **kwargs)
    is_admin = False
    for u in usrs:
        if u.name == username:
            roles = u.role_entities
            role_names = [r.name for r in roles]
            for r in roles:
                role_names.extend(r.content.get('imported_roles', []))
                _logger.debug("extend role_names with %s", r.content.get('imported_roles'))
            is_admin = any([n == 'admin' for n in role_names])
        if is_admin:
            break

    if is_admin is False:
        msg = 'Can not use TAB. current user is not admin. current user:{0}'.format(
            username)
        _logger.error(msg)
        return {'err_code': 3122, 'err_args': {'user': username}}
    mode = _get_cluster_server_mode(service)
    if mode == 'slave' or mode == 'master':
        _logger.error('cluster mode is %s', mode)
        return {'err_code': 3135}
    elif mode == 'searchhead':
        shc_disable = _get_shc_disable_flag(service)
        if not shc_disable:
            _logger.error('this search head is in a SHC.')
            return {'err_code': 3123}
        else:
            _logger.debug('this is a stand alone search head.')
    # check if it is shc env
    si = server_info.ServerInfo(service.token, service.scheme, service.host,
                                service.port)
    _logger.debug(
        'user allow. is-search-head:%s, is-search-head-member:%s, server-info:%s',
        si.is_search_head(), si.is_shc_member(), si._server_info())
    if si.is_shc_member():
        msg = 'Can not use TAB. current server is in a search head cluster.'
        _logger.error(msg)
        return {'err_code': 3123}
    return None


def get_local_props_conf_filename(app_name):
    return os.path.join(app_path, app_name, 'local', 'props.conf')


def is_app_loaded(service, app_id):
    for app in service.apps:
        if app.name == app_id:
            return True
    return False


def get_all_disabled_apps(service):
    disabled_apps = list()
    for app in service.apps:
        if sutils.is_true(app.disabled):
            disabled_apps.append(app.name)
    return disabled_apps


@metric_util.function_run_time(tags=['tab_app_util'])
def list_existing_solutions(service):
    solutions = list()
    candidate_list = []
    for app in service.apps:
        if app.name in APP_BLACK_LIST:
            continue
        if sutils.is_true(app.disabled):
            continue
        if not os.path.isdir(os.path.join(app_path, app.name)):
            # filter out the app whose dir does not exist.
            # when a TA is deleted without restarting splunk, we will get inconsistent data
            continue
        candidate_list.append(app)

    for app in candidate_list:
        solutions.append({'name': app.content['label'],
                          'id': app.name,
                          'author': app.content['author']
                          if app.content.get('author') else '',
                          'version': app.content['version']
                          if app.content.get('version') else '',
                          'icon': get_icon_from_name(service, app.name),
                          'visible': common_util.is_true(app.content['visible']) if 'visible' in app.content else False,
                          'last_modified': get_app_modify_time(app.name)})

    return solutions


def get_icon(service, app):
    if meta_const.LARGE_ICON_KEY in app and app.get(meta_const.LARGE_ICON_KEY):
        return "data:image/png;base64,{}".format(app.get(
            meta_const.LARGE_ICON_KEY))
    else:
        return get_icon_from_name(service, app["id"])


def get_icon_from_name(service, id):
    root_endpoint = common_util.get_root_endpoint(service.token, service.scheme + "://" + service.host + ":" + str(service.port))
    if root_endpoint is not None and len(root_endpoint) > 0 and root_endpoint[0] != '/':
        root_endpoint = '/' + root_endpoint
    else:
        root_endpoint = ''
    root_endpoint = root_endpoint.rstrip('/ ')
    icon_url = root_endpoint + "/en-US/splunkd/__raw/servicesNS/admin/{}/static/appIcon_2x.png".format(
        id)
    default_url = root_endpoint + "/en-US/splunkd/__raw/servicesNS/admin/splunk_app_addon-builder/static/icon_default_ta.png"

    icon_path = os.path.join(app_path, id, "static/appIcon_2x.png")

    if os.path.exists(icon_path):
        return icon_url
    else:
        return default_url


def get_app_modify_time(id):
    mtime = time.gmtime(os.path.getmtime(os.path.join(app_path, id)))
    return time.strftime("%Y/%m/%d", mtime)


def delete_app(service, app_name, splunk_uri, splunk_session):
    if app_name in APP_BLACK_LIST:
        emsg = "{} is in blacklist. It can not be deleted.".format(app_name)
        _logger.warning(emsg)
        raise builder_exception.CommonException(err_code=46, e_message=emsg, options={'app': app_name})

    if not meta_manager.MetaManager.is_app_created_by_aob(service, app_name):
        emsg = "{} is not created by add-on builder. It can not be deleted.".format(app_name)
        _logger.warning(emsg)
        raise builder_exception.CommonException(err_code=47, e_message=emsg, options={'app': app_name})

    app_dir = os.path.join(app_path, app_name)
    if os.path.isdir(app_dir):
        common_util.delete_app(service, app_name)
        if os.path.isdir(app_dir):
            shutil.rmtree(app_dir)
    else:
        _logger.info("app dir %s does not exist. Deleting this app just remove it from meta.", app_name)

    # remove all the events of sourcetypes
    event_mgr = meta_manager_event.EventMetaManager(splunk_uri,
            splunk_session, service=service)
    meta_mgr = meta_manager.create_meta_manager(splunk_session,
            splunk_uri, meta_const.FIELD_EXTRACT_BUILDER, app_name)
    meta = meta_mgr.get_app_meta_data() or {}

    for sourcetype in list(meta.keys()):
        event_mgr.remove_events(sourcetype)

    success = meta_manager.MetaManager.delete_app(service, app_name)
    return success


def is_cim_sa_installed(service):
    cim_sa_name = 'Splunk_SA_CIM'
    for app in service.apps:
        if app['name'] == cim_sa_name and sutils.is_false(app.disabled):
            return True
    return False

def remove_legacy_validation_rules():
    rule_dir = common_util.make_splunk_path(["etc", "apps", builder_constant.ADDON_BUILDER_APP_NAME,
                                             "bin", "validation_rules", "validation_field"])
    removed_rule_specs = ("extraction_get_events.rule",)
    for rule in removed_rule_specs:
        fullpath = os.path.join(rule_dir, rule)
        if os.path.isfile(fullpath):
            os.remove(fullpath)

def multi_key_lookup(dictionary, tuple_of_keys):
    from functools import reduce

    try:
        return reduce(dict.get, tuple_of_keys, dictionary)
    except TypeError as error:
        return None
