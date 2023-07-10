import sys
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
controller_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'appserver', 'controllers'])
if controller_path not in sys.path:
    sys.path.insert(1, controller_path)
import sys_path_checker

import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
import splunk.clilib.cli_common as scc

import json
import cherrypy
import logging
import traceback
import time
import random

import controller_util
from aob.aob_common import builder_constant
from tabuilder_utility import temp_manager, app_util, common_util

from ta_meta_management import meta_manager, meta_const
from ta_generator import builder
from ta_generator import app
from validation_app_cert.app_cert import AppCert
from tabuilder_utility.builder_exception import CommonException
from solnlib.utils import is_true
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.apps_manage')


class appsHandler(controllers.BaseController):
    @route('/:action=user_allow')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def is_user_allow_to_user_tabuilder(self, action, **params):
        username = cherrypy.session.get('user').get('name')
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session_key, splunkd_uri)
        r = app_util.is_user_allow_to_create_ta(username, service)
        if r:
            return self.render_json(r)
        else:
            return self.render_json({})

    @route('/:action=loglevels')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def get_all_loglevels(self, action, **params):
        levels = [{"name": "Error"}, {"name": "Warn"}, {"name": "Info"},
                  {"name": "Debug"}]
        return self.render_json(levels)

    @route('/:action=is_app_loaded')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def is_loaded(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session, splunk_uri)
        app_name = params['app_name']
        is_loaded = False
        if app_name:
            is_loaded = app_util.is_app_loaded(service, app_name)
        return self.render_json({'loaded': is_loaded})

    @route('/:action=upgrade_app')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def upgrade_app_project(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        app_context = json.loads(raw_body)
        app_name = app_context.get('app_name', '')
        try:
            service = common_util.create_splunk_service(session, splunkd_uri, builder_constant.ADDON_BUILDER_APP_NAME)
            app_project = app.App(app_name, service)
            ta_builder = builder.TABuilder(app_name,
                                           uri=splunkd_uri,
                                           session_key=session)
            app_project.upgrade(ta_builder)
            return self.render_json({})
        except CommonException as ce:
            logger.error("Fail to upgrade app. %s", traceback.format_exc())
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})
        except Exception as e:
            logger.error("Fail to upgrade app. %s", traceback.format_exc())
            return self.render_json({'err_code': 19})

    @route("/:action=current_app")
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def current_creating_app(self, action, **params):
        # POST
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        app_context = json.loads(raw_body)
        app_name = app_context.get('app_name', '')
        if app_name:
            controller_util.set_current_ta_project(app_name)
        else:
            controller_util.delete_current_ta_project()

        app_display_name = app_context.get('app_display_name', '')
        controller_util.set_current_ta_display_name(app_display_name)

        # default is built by tabuilder
        built = app_context.get('built', 'yes')
        controller_util.set_built_flag(built)

        if app_name:
            mgr = meta_manager.create_meta_manager(cherrypy.session.get("sessionKey"), scc.getMgmtUri(), meta_const.APP_CONTEXT, app_name)
        return self.render_json({'app_name': app_name,
                                 'app_display_name': app_display_name,
                                 'built': built,
                                 'cookies': controller_util.format_response_cookie()})

    @route('/:action=sourcetypes')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def get_sourcetypes(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        try:
            tabuilder = builder.TABuilder(
                controller_util.get_current_ta_project(), splunkd_uri,
                session_key)
            return self.render_json([{'name': _sourcetype}
                                     for _sourcetype in
                                     tabuilder.get_all_sourcetypes()])
        except CommonException as ce:
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})

    @route("/:action=upload_sample")
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def upload_sample_file(self, action, **params):
        try:
            sample_file = params['sample_file']
            sample_source_name = sample_file.filename
            sample_sourcetype = params['sourcetype']
            # put the sample file to the tmp directory
            temp_mgr = temp_manager.TempManager()
            ts = int(time.time())
            rn = random.randint(0, 100)
            sample_file_name = 'sample_{}_{}.txt'.format(ts, rn)
            temp_mgr.create_temp_file(sample_file_name)
            with open(temp_mgr.get_full_path(sample_file_name), 'w') as sf:
                while True:
                    data = sample_file.file.read(8192)
                    if not data:
                        break
                    sf.write(data.decode())

            # upload the events to index
            service = common_util.create_splunk_service(cherrypy.session.get("sessionKey"), scc.getMgmtUri())
            main_idx = service.indexes['add_on_builder_index']
            upload_args = {'sourcetype': sample_sourcetype,
                           'rename-source': sample_source_name}
            main_idx.upload(
                temp_mgr.get_full_path(sample_file_name), **upload_args)
            logger.info(
                'upload sample file: {0} to index: {1}, sourcetype: {2}, source:{3}'.format(
                    temp_mgr.get_full_path(sample_file_name), 'main',
                    sample_sourcetype, sample_source_name))
            return self.render_json({
                'temp_sample_file': sample_file_name,
                'sample_source_name': sample_source_name,
                'status': 'success'
            })
        except Exception as e:
            logger.error('fail to upload sample:' + traceback.format_exc())
            return self.render_json({'err_code': 1001,
                                     'err_args': {'err_msg':
                                                  traceback.format_exc()}})
            # return self.render_json({'error': "Exception: {}".format(e)})

    @route('/:action=get_global_settings')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_manage'])
    def get_tab_global_settings(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        try:
            conf_mgr = common_util.create_conf_mgr(session_key, splunkd_uri)
            conf = conf_mgr.get_conf(builder_constant.GLOBAL_SETTING_CONF_NAME)
            settings = conf.get_all()

            app_cert_conf = settings.get("app_cert")
            app_cert_conf["proxy_enabled"] = is_true(app_cert_conf["proxy_enabled"])

            return self.render_json({"data": settings})
        except CommonException as ce:
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})

    @route('/:action=set_global_settings')
    @expose_page(must_login=True, methods=['POST'])
    def set_tab_global_settings(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        settings = json.loads(params['settings'])

        try:
            encrypt_keys = ("password", "username", "proxy_username", "proxy_password")
            conf_mgr = common_util.create_conf_mgr(session_key, splunkd_uri)
            conf = conf_mgr.get_conf(builder_constant.GLOBAL_SETTING_CONF_NAME)
            conf_settings = conf.get_all()

            app_cert = AppCert(splunkd_uri, session_key, builder_constant.ADDON_BUILDER_APP_NAME)
            app_cert_settings = conf_settings.get("app_cert", {}).copy()
            app_cert_settings.update(settings.get("app_cert"))
            app_cert.validate_settings(app_cert_settings)

            for stanza, key_values in list(settings.items()):
                conf.update(stanza, key_values, encrypt_keys)

            return self.render_json({"data": settings})
        except CommonException as ce:
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})
