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
from ta_generator import builder
from tabuilder_utility.builder_exception import CommonException
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.app_edit_setup')


class appsHandler(controllers.BaseController):
    @route('/:resource=global_settings')
    @expose_page(must_login=True, methods=['GET', 'POST'])
    @metric_util.function_run_time(tags=['tab_edit_globalsettings'])
    def global_settings(self, resource, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        tabuilder = builder.TABuilder(
            controller_util.get_current_ta_project(), splunkd_uri, session_key)
        if cherrypy.request.method == 'GET':
            global_settings = tabuilder.get_global_settings()
            if global_settings is None:
                global_settings = {}
            return self.render_json(global_settings)
        elif cherrypy.request.method == 'POST':
            cl = cherrypy.request.headers["Content-Length"]
            raw_body = cherrypy.request.body.read(int(cl))
            params = json.loads(raw_body)
            try:
                # did some clean up in case frontend does not clean it up
                if 'customized_settings' in params and len(params['customized_settings']) == 0:
                    del params['customized_settings']
                logger.info("global settings params are : %s", params)
                tabuilder.update_global_settings(params)
                return self.render_json({"status": "success"})
            except CommonException as e:
                logger.error("fail to save global settings. Error: %s",
                             traceback.format_exc())
                return self.render_json({'err_code': e.get_err_code(),
                                         'err_args': e.get_options()})
            except Exception as e:
                logger.error("fail to save global settings. Error: %s",
                             traceback.format_exc())
                raise e
