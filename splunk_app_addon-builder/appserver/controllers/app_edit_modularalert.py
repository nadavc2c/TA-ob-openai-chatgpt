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
import traceback
import logging

import controller_util
from tabuilder_utility.builder_exception import CommonException
from ta_generator import builder
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.app_edit_datainputs')


class appsHandler(controllers.BaseController):
    @route('/:action=get_modular_alerts_summary')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_modularalert'])
    def get_modular_alerts_summary(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        tabuilder = builder.TAAlertBuilder(controller_util.get_current_ta_project(),
                                      splunkd_uri, session_key)
        all_modular_alerts = tabuilder.get_all_TA_alerts() or []
        return self.render_json(all_modular_alerts)

    @route('/:action=add_modular_alert')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_modularalert'])
    def add_modular_alert(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TAAlertBuilder(appname, splunkd_uri, session_key)
            meta = tabuilder.create_TA_alert(params)
            return self.render_json({"status": "success", 'meta': meta})
        except CommonException as e:
            logger.error(
                'Get CommonException when create modular alert. meta:%s, error:%s',
                params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error('fail to create modular alert, meta:%s, error: %s',
                         params, traceback.format_exc())
            raise e

    @route('/:action=delete_modular_alert')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_modularalert'])
    def delete_modular_alert(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TAAlertBuilder(appname, splunkd_uri, session_key)
            tabuilder.delete_TA_alert(params)
            return self.render_json({"status": "success"})
        except CommonException as e:
            logger.error('Fail to delete modular alert. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error('Fail to delete modular alert. meta:%s, error:%s',
                         params, traceback.format_exc())
            raise e

    @route('/:action=fetch_modular_alert_code')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_modularalert'])
    def fetch_modular_alert_code(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TAAlertBuilder(appname, splunkd_uri, session_key)
            meta = tabuilder.fetch_modular_alert_code(params)
            logger.info('fetch modular alert code:%s', meta)
            return self.render_json(meta)
        except Exception as e:
            logger.error('generate modular alert code error. %s',
                         traceback.format_exc())
            raise e

    @route('/:action=update_modular_alert')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_modularalert'])
    def update_modular_alert(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TAAlertBuilder(appname, splunkd_uri, session_key)
            tabuilder.update_TA_alert(params)
            return self.render_json({"status": "success", "meta": params})
        except CommonException as e:
            logger.error(
                'Get CommonException when update modular alert. meta:%s, error:%s',
                params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error(
                'Get exception when update modular alert. meta:%s, error:%s',
                params, traceback.format_exc())
            raise e

    @route('/:action=code_get')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_modularalert'])
    def code_get(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        tabuilder = builder.TAAlertBuilder(appname, splunk_uri, session)
        code = tabuilder.get_modular_alert_code(params)
        return self.render_json({"code": code})

    @route('/:action=code_test')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_modularalert'])
    def code_test(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        tabuilder = builder.TAAlertBuilder(appname, splunk_uri, session)
        output = tabuilder.test_modular_alert_code(params)
        return self.render_json(output)
