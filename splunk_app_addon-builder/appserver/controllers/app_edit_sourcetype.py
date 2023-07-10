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

import cherrypy
import logging
import traceback
import json
import re

from tabuilder_utility.builder_exception import CommonException
import controller_util
from ta_generator.builder import TABuilder
from ta_generator.builder_ta_sourcetype import TASourcetypeBuilder
from sourcetype_builder.sourcetype_builder import SourcetypeBuilder
from aob.aob_common.metric_collector import metric_util
from aob.aob_common import builder_constant

logger = logging.getLogger('splunk.tabuilder.controllers.app_edit_sourcetype')

SOURCETYPE_NAMING_REGEX = re.compile(r'^[a-zA-Z][:_0-9a-zA-Z]*$')


class appsHandler(controllers.BaseController):
    @route('/:action=get_sourcetype_basic_info')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def get_sourcetype_basic_info(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            data = tabuilder.get_sourcetype_basic_info() or {}
            sourcetypes = []
            for k, v in list(data.items()):
                item = {"name": k}
                item.update(v)
                sourcetypes.append(item)
            sourcetypes.sort(key=lambda x: x.get("name"))
            ret = {'status': 'success', 'data': sourcetypes, }
            return self.render_json(ret)
        except CommonException as ce:
            logger.error("Can not get basic info. error:%s",
                         traceback.format_exc())
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})
        except Exception as e:
            logger.error("Cannot get basic info. error: %s",
                         traceback.format_exc())
            raise e

    @route('/:action=get_sourcetype_names')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def get_app_sourcetype_names(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = controller_util.get_current_ta_project()
        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            sourcetypes = tabuilder.get_app_sourcetypes()
            return self.render_json([{'name': s} for s in sourcetypes])
        except Exception as e:
            logger.error("Cannot get basic info. error: %s",
                         traceback.format_exc())
            raise e

    @route('/:action=indexed_sourcetypes')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def get_indexed_sourcetypes(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = controller_util.get_current_ta_project()
        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.get_import_sourcetype()

            return self.render_json({'indexed_sourcetypes': res})
        except Exception as e:
            logger.error("Cannot get sourcetype names from index. error: %s",
                         traceback.format_exc())
            raise e

    @route('/:action=get_imported_sourcetype_contents')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def get_imported_sourcetype_contents(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = controller_util.get_current_ta_project()
        sourcetype = params['sourcetype']
        try:
            builder = SourcetypeBuilder(app_name, splunk_uri, session)
            res = builder.get_sourcetype_contents(sourcetype)

            return self.render_json({'sourcetype_contents': res})
        except Exception as e:
            logger.error("Cannot get contents of sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=update_sourcetype')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def update_sourcetype(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']
        key_values = json.loads(params['key_values'])

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            success = tabuilder.update_sourcetype(sourcetype,
                                                  key_values)
            if success:
                return self.render_json({'status': 'success'})
            else:
                # one duplicated sourcetype already exists
                ret = {
                    'err_code': 8001,
                    'err_args': {"sourcetype": sourcetype},
                }
            return self.render_json(ret)
        except Exception as e:
            logger.error("Cannot update sourcetype %s. error: %s", sourcetype,
                         traceback.format_exc())
            raise e

    @route('/:action=create_sourcetype')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def create_sourcetype(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params.get('sourcetype', '').strip()
        if not sourcetype:
            return self.render_json({"err_code": 8005})
        key_values = json.loads(params['key_values'])

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)

            if not SOURCETYPE_NAMING_REGEX.match(sourcetype):
                return self.render_json({
                    'err_code': 8016,
                    'err_args': {
                        "sourcetype": sourcetype
                    },
                })
            if sourcetype in builder_constant.RESERVED_SOURCETYPES:
                return self.render_json({
                    'err_code': 8012,
                    'err_args': {
                        "sourcetype": sourcetype
                    },
                })

            # check if the sourcetype exists in splunk
            import_sourcetypes = tabuilder.get_sourcetypes_from_index()
            existing_sourcetypes = [list(st.values())[0] for st in import_sourcetypes]
            if sourcetype in existing_sourcetypes:
                return self.render_json({
                    'err_code': 8002,
                    'err_args': {
                        "sourcetype": sourcetype
                    },
                })

            success = tabuilder.create_sourcetype(sourcetype, key_values)
            if success:
                return self.render_json({'status': 'success'})
            else:
                ret = {
                    'err_code': 8002,
                    'err_args': {"sourcetype": sourcetype},
                }
            return self.render_json(ret)
        except Exception as e:
            logger.error("Cannot create sourcetype %s. error: %s", sourcetype,
                         traceback.format_exc())
            raise e

    @route('/:action=import_sourcetype')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def import_sourcetype(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        # cl = cherrypy.request.headers["Content-Length"]
        # raw_body = cherrypy.request.body.read(int(cl))
        # params = json.loads(raw_body)
        app_name = params['app_name']
        sourcetype = params.get('sourcetype', '').strip()
        source_app = params.get('source_app', '').strip()
        key_values = json.loads(params['key_values'])
        if not sourcetype:
            return self.render_json({"err_code": 8005})

        try:
            stbuilder = TASourcetypeBuilder(app_name, splunk_uri, session)

            if sourcetype in builder_constant.RESERVED_SOURCETYPES:
                return self.render_json({'err_code': 8012,
                                         'err_args': {"sourcetype": sourcetype
                                                      }, })

            # check if the sourcetype exists in current project
            if sourcetype in stbuilder.get_all_sourcetype_names():
                return self.render_json({'err_code': 8000,
                                         'err_args': {"sourcetype": sourcetype
                                                      }, })

            stbuilder.import_sourcetype(sourcetype, source_app, key_values)
            return self.render_json({'status': 'success'})

        except Exception as e:
            logger.error("Cannot create sourcetype %s. error: %s", sourcetype,
                         traceback.format_exc())
            raise e

    @route('/:action=delete_sourcetype')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_sourcetype'])
    def delete_sourcetype(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.delete_sourcetype(sourcetype)
            return self.render_json({"data": res})

        except Exception as e:
            logger.error("Cannot delete sourcetype %s. error: %s", sourcetype,
                         traceback.format_exc())
            raise e
