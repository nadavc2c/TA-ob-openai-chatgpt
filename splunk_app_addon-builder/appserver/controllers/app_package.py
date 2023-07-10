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

import os
import cherrypy
import logging
import traceback
from cherrypy.lib.static import serve_file

from tabuilder_utility import ta_project_meta
from tabuilder_utility import workspace_util
from tabuilder_utility import builder_exception
from ta_generator.builder import TABuilder
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.app_package')

class packageHandler(controllers.BaseController):
    @route('/:action=generate_link')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_package'])
    def generate_link(self, action, **params):
        uri = scc.getMgmtUri()
        session = cherrypy.session.get("sessionKey")
        appname = params[
            "app_name"] or ta_project_meta.get_current_creating_app({})
        tabuilder = TABuilder(appname, uri, session)
        package_file_name = workspace_util.package_app(tabuilder)
        return self.render_json({
            "name": os.path.basename(package_file_name),
            "link":
            "../../custom/splunk_app_addon-builder/app_package/file_download?app_name="
            + appname
        })

    @route('/:action=file_download')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_package'])
    def file_download(self, action, **params):
        appname = params["app_name"]
        download_path = workspace_util.get_package_file_path(appname)
        return serve_file(download_path, "application/x-download",
                          "attachment")

    @route('/:action=get_summary')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_package'])
    def ta_summary(self, action, **params):
        app_name = params['app_name']
        uri = scc.getMgmtUri()
        session = cherrypy.session.get("sessionKey")
        try:
            result = {'app_name': app_name}
            tabuilder = TABuilder(app_name, uri, session)
            # sourcetype_basic and input_basic should be consistent
            sourcetype_basic = tabuilder.get_sourcetype_basic_info() or {}
            input_basic = tabuilder.get_inputs_basic_info() or {}
            cim_basic = tabuilder.get_TA_cim_basic_info() or {}
            logger.debug("sourcetype basic:%s", sourcetype_basic)
            logger.debug("input basic:%s", input_basic)
            logger.debug("cim basic:%s", input_basic)
            sourcetype_summary = []
            for k, v in list(sourcetype_basic.items()):
                item = {"sourcetype": k}
                st_meta = v.get('metadata', {})
                name = st_meta.get('data_input_name', None)
                if name:
                    item['input_name'] = name
                    item['input_type'] = input_basic[k]['data_input_type']
                item['has_field_extraction'] = st_meta.get('is_parsed', False)
                item['data_format'] = st_meta.get('data_format', None)
                if k in cim_basic and (cim_basic[k]['eval_count'] + cim_basic[k]['alias_count']) > 0:
                    item['has_cimmapping'] = True
                else:
                    item['has_cimmapping'] = False
                item['event_count'] = st_meta.get('event_count', 0)
                sourcetype_summary.append(item)

            result['sourcetype_count'] = len(sourcetype_basic)
            result['input_count'] = len(input_basic)
            result['sourcetype_summary'] = sourcetype_summary
            return self.render_json(result)
        except builder_exception.CommonException as ce:
            logger.error("Can not get TA summary info. error:%s",
                         traceback.format_exc())
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})
        except Exception as e:
            logger.error("Cannot get TA summary info. error: %s",
                         traceback.format_exc())
            raise e
