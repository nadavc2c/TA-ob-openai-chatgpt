# encoding = utf-8
import copy
from ta_meta_management import meta_const
from ta_meta_management import meta_manager

from aob.aob_common import logger, builder_constant
from tabuilder_utility import common_util


_logger = logger.get_meta_manager_logger()


def app_meta_exist(splunk_uri, session_key, app_name):
    mgr = meta_manager.create_meta_manager(session_key, splunk_uri, meta_const.BASIC_BUILDER, app_name)
    meta = mgr.get_app_meta_data()
    return meta is not None


def is_app_created_by_aob(service, app):
    return meta_manager.MetaManager.is_app_created_by_aob(service, app)

def _extract_project_brief_meta(app_name, project_meta):
    '''
    :parameter project_meta: a dict like
    {
        last_modify_time: 1234,
        wizard_step: step1,
        basic_builder: {...},
        cim_builder: {...},
    }
    :return breif meta. a dict like
    {
        id: example_ta_id,
        name: example_ta, // the ui displayed name
        author: mike,
        version: 1.0,
        visible:True/Fasle,
        last_modify_time: 123456,
        built_by_tabuilder: True,
        large_icon: base64_string
    }
    '''
    brief_meta = {
        meta_const.ID_KEY: app_name,
        meta_const.LAST_MODIFY_TIME_KEY: project_meta[meta_const.LAST_MODIFY_TIME_KEY]
    }
    if meta_const.BASIC_BUILDER in project_meta:
        basic_builder_meta = project_meta[meta_const.BASIC_BUILDER]
        brief_meta.update({
            meta_const.NAME_KEY: basic_builder_meta.get(meta_const.FRIENDLY_NAME_KEY, app_name),
            meta_const.AUTHOR_KEY: basic_builder_meta.get(meta_const.AUTHOR_KEY),
            meta_const.VERSION_KEY: basic_builder_meta.get(meta_const.VERSION_KEY),
            meta_const.VISIBLE_KEY: basic_builder_meta.get(meta_const.VISIBLE_KEY, False),
            meta_const.BUILT_KEY: True,
            meta_const.LARGE_ICON_KEY: basic_builder_meta.get(meta_const.LARGE_ICON_KEY),
        })
    else:
        brief_meta[meta_const.BUILT_KEY] = False
    _logger.debug('[App:%s] Get brief meta: %s from project meta:%s', app_name, brief_meta, project_meta)
    return brief_meta

def get_all_project_brief_meta(service, disabled_apps=[]):
    """
        :return: a list of brief meta. format is like
        [
            {
                id: example_ta_id,
                name: example_ta, // the ui displayed name
                author: mike,
                version: 1.0,
                visible:True/Fasle,
                last_modify_time: 123456,
                built_by_tabuilder: True,
                large_icon: base64_string
            }
        ]
    """
    all_metas = meta_manager.MetaManager.get_metas(service)
    brief_meta_list = []
    for app in list(all_metas.keys()):
        if app in disabled_apps:
            # do not show disabled apps
            continue
        brief_meta_list.append(_extract_project_brief_meta(app, all_metas[app]))
    return brief_meta_list

def get_project_brief_meta(service, app):
    meta = meta_manager.MetaManager.get_metas(service, app_names=[app])
    if app not in meta:
        raise ValueError('Can not get project meta for app:' + app)
    return _extract_project_brief_meta(app, meta[app])

def is_ta_project_edited(service, app):
    '''
    check the meta for this app, if this app is edited by AoB return True
    If this project is only validated, return False.
    If this project is clean, return False
    '''
    all_metas = meta_manager.MetaManager.get_metas(service, [app])
    project_meta = all_metas.get(app, {})
    if meta_const.TA_VALIDATION_NS in project_meta:
        del project_meta[meta_const.TA_VALIDATION_NS]
    return len(project_meta) > 0

def remove_user_credential_in_meta(meta):
    '''
    :param meta: Meta object for the project. Its format is
                 the same as the return value of get_app_all_meta
    :return: return a copy of meta, all the credential information is removed
    '''
    meta = copy.deepcopy(meta)
    data_input_list = meta.get(meta_const.DATA_INPUT_BUILDER, {}).get('datainputs')
    if data_input_list:
        for _input in data_input_list:
            password_param_names = []
            for p in _input.get('data_inputs_options', []):
                if p.get('type') == 'customized_var' and p.get('format_type') == 'password':
                    password_param_names.append(p.get('name'))
            options = _input.get('customized_options')
            if options:
                _input['customized_options'] = [x for x in options if x.get('name') not in password_param_names]

    global_setting_meta = meta.get(meta_const.GLOBAL_SETTINGS_BUILDER, {}).get('global_settings')
    if global_setting_meta:
        if 'credential_settings' in global_setting_meta:
            global_setting_meta['credential_settings'] = list()
        if 'proxy_settings' in global_setting_meta:
            proxy = global_setting_meta['proxy_settings']
            if 'proxy_password' in proxy:
                del proxy['proxy_password']
        global_vars = global_setting_meta.get('customized_settings', [])
        if global_vars:
            for var in global_vars:
                if var.get('type') == 'password':
                    var['value'] = ''
    return meta
