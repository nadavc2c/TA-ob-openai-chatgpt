import cherrypy
import splunk.clilib.cli_common as scc

from aob.aob_common import builder_constant
from tabuilder_utility import common_util
from solnlib.conf_manager import ConfStanzaNotExistException
from tabuilder_utility import tab_conf_manager

tabuilder_status_conf = "tabuilder_status"
create_ta_stanza = "create"
edit_ta_stanza = "edit"
cca_key = "current_creating_app"
st_key = "default_sourcetype"


def set_current_creating_appname(app_name, sourcetype):
    conf_manager = common_util.create_conf_mgr(
        cherrypy.session.get("sessionKey"), scc.getMgmtUri())
    conf_file = conf_manager.get_conf(tabuilder_status_conf)
    conf_file.update(create_ta_stanza, {cca_key: app_name,
                                        st_key: sourcetype,
                                        "action": True})
    try:
        conf_file.get(edit_ta_stanza)
        conf_file.update(edit_ta_stanza, {"action": False})
    except ConfStanzaNotExistException as e:
        # if the edit stanza exists, update it. otherwise, skip
        pass

    return app_name


def set_current_editing_appname(app_name):
    conf_manager = common_util.create_conf_mgr(
        cherrypy.session.get("sessionKey"), scc.getMgmtUri())
    conf_file = conf_manager.get_conf(tabuilder_status_conf)
    conf_file.update(edit_ta_stanza, {cca_key: app_name, "action": True})
    try:
        conf_file.get(create_ta_stanza)
        conf_file.update(create_ta_stanza, {"action": False})
    except ConfStanzaNotExistException as e:
        # update the create stanza if exist. otherwise, skip
        pass
    return app_name


def get_current_creating_app(params={}):
    if 'appname' in params:
        app_name = params['appname']
    else:
        session = cherrypy.session.get("sessionKey")
        uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session, uri)
        installed_apps = [app.name for app in service.apps if app.name]

        conf_manager = common_util.create_conf_mgr(session, uri)
        current_creating_app = conf_manager.get_conf(
            tabuilder_status_conf).get(create_ta_stanza).get(cca_key, None)

        if current_creating_app in installed_apps:
            app_name = current_creating_app
        else:
            app_name = builder_constant.ADDON_BUILDER_APP_NAME
    return app_name


def get_current_creating_app_sourcetype():
    conf_manager = common_util.create_conf_mgr(
        cherrypy.session.get("sessionKey"), scc.getMgmtUri())
    return conf_manager.get_conf(tabuilder_status_conf).get(
        create_ta_stanza).get(st_key, None)

def get_appname(params):
    if 'appname' in params:
        app_name = params['appname']
    else:
        service = common_util.create_splunk_service(cherrypy.session.get("sessionKey"), scc.getMgmtUri())
        apps = [app.name for app in service.apps if app.name]

        conf_manager = common_util.create_conf_mgr(cherrypy.session.get("sessionKey"), scc.getMgmtUri())
        conf_file = conf_manager.get_conf(tabuilder_status_conf)
        app_name_create = None
        app_name_edit = None
        if tab_conf_manager.is_stanza_exists(conf_file, create_ta_stanza):
            app_name_create = conf_file.get(create_ta_stanza).get(cca_key, None)
            create_in_action = conf_file.get(create_ta_stanza).get("action", False)
            if create_in_action and app_name_create in apps:
                return app_name_create

        if tab_conf_manager.is_stanza_exists(conf_file, edit_ta_stanza):
            app_name_edit = conf_file.get(edit_ta_stanza).get(cca_key, None)
            if app_name_edit in apps:
                return app_name_edit

        return builder_constant.ADDON_BUILDER_APP_NAME
