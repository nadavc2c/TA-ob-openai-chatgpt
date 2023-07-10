import cherrypy

import datetime
from aob.aob_common.builder_constant import *

def format_response_cookie():
    cookies = {}
    cherry_cookies = cherrypy.response.cookie
    cookie_names = list(cherry_cookies.keys())
    for k in COOKIE_KEYS:
        if k in cookie_names:
            cookies[k] = {'value': cherry_cookies[k].value,
                          'expires': cherry_cookies[k]['expires'],
                          'path': cherry_cookies[k]['path']}
    return cookies


def _generate_cookie_expires():
    d = datetime.datetime.utcnow() + datetime.timedelta(
        days=COOKIE_EXPIRES_DAY)
    return d.strftime('%a, %d %b %Y %H:%M:%S GMT')


def set_current_ta_project(ta_name):
    cherrypy.response.cookie[TA_NAME] = ta_name
    cherrypy.response.cookie[TA_NAME]['expires'] = _generate_cookie_expires()
    cherrypy.response.cookie[TA_NAME]['path'] = '/'


def get_current_ta_project():
    if TA_NAME in cherrypy.request.cookie:
        return cherrypy.request.cookie[TA_NAME].value
    else:
        return None


def delete_current_ta_project():
    cherrypy.response.cookie[TA_NAME] = ""
    cherrypy.response.cookie[TA_NAME]['expires'] = 0
    cherrypy.response.cookie[TA_NAME]['path'] = '/'


def set_current_ta_display_name(name):
    cherrypy.response.cookie[TA_DISPLAY_NAME] = name
    cherrypy.response.cookie[TA_DISPLAY_NAME]['expires'] = _generate_cookie_expires()
    cherrypy.response.cookie[TA_DISPLAY_NAME]['path'] = '/'


def get_current_ta_display_name():
    if TA_DISPLAY_NAME in cherrypy.request.cookie:
        return cherrypy.request.cookie[TA_DISPLAY_NAME].value
    else:
        return None


def delete_current_ta_display_name():
    cherrypy.response.cookie[TA_DISPLAY_NAME] = ""
    cherrypy.response.cookie[TA_DISPLAY_NAME]['expires'] = 0
    cherrypy.response.cookie[TA_DISPLAY_NAME]['path'] = '/'


def set_built_flag(built):
    cherrypy.response.cookie[BUILT_FLAG] = built
    cherrypy.response.cookie[BUILT_FLAG]['expires'] = _generate_cookie_expires(
    )
    cherrypy.response.cookie[BUILT_FLAG]['path'] = '/'


def get_built_flag():
    if BUILT_FLAG in cherrypy.request.cookie:
        return cherrypy.request.cookie[BUILT_FLAG].value
    else:
        return None


def delete_built_flag():
    cherrypy.response.cookie[BUILT_FLAG] = ""
    cherrypy.response.cookie[BUILT_FLAG]['expires'] = 0
    cherrypy.response.cookie[BUILT_FLAG]['path'] = '/'

def add_aob_lib_paths():
    import sys
    from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

    bin_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'bin'])
    validation_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'bin', 'validation_rules'])
    controller_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'appserver', 'controllers'])
    res_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'bin', 'splunk_app_add_on_builder'])
    for mpath in (bin_path, validation_path, controller_path, res_path):
        if mpath not in sys.path:
            sys.path.insert(1, mpath)
