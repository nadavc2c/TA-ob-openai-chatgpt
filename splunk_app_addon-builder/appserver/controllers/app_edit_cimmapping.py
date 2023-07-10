import sys
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
controller_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'appserver', 'controllers'])
if controller_path not in sys.path:
    sys.path.insert(1, controller_path)
import sys_path_checker

import json
import logging
import traceback

import cherrypy
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.clilib.cli_common as scc
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route

import controller_util
from ta_generator.builder import TACIMBuilder
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.ko_util import eventtype_util
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.app_edit_cimmapping')

class cimmappingHandler(controllers.BaseController):
    @route('/:action=get_eventtype_info')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_cimmapping'])
    def get_eventtype_info(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.get_eventtype_info()
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting eventtype results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get eventtype info for app %s. error: %s",
                         appname, traceback.format_exc())
            raise e

    @route('/:action=create_eventtype')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_cimmapping'])
    def create_eventtype(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        name = params['name']
        search = params['search']
        sourcetype_dict = params['sourcetypes']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            builder.create_eventtype(name, search, sourcetype_dict)
            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error('Get CommonException when creating eventtype. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot create eventtype %s. error: %s",
                         name, traceback.format_exc())
            raise e

    @route('/:action=get_eventtypes')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_cimmapping'])
    def get_eventtypes(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = params['app_name']
        name = params['name']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = eventtype_util.get_eventtype(builder.tab_conf_mgr,
                                               stanza=None, with_tags=False)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting eventtype. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get eventtype %s. error: %s",
                         name, traceback.format_exc())
            raise e

    @route('/:action=update_eventtype')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_cimmapping'])
    def update_eventtype(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        old_name = params['old_name']
        name = params['name']
        search = params['search']
        sourcetype_dict = params['sourcetypes']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            builder.update_eventtype(old_name, name, search, sourcetype_dict)
            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error('Get CommonException when updating eventtype. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot update eventtype %s. error: %s",
                         name, traceback.format_exc())
            raise e

    @route('/:action=delete_eventtype')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_cimmapping'])
    def delete_eventtype(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        name = params['name']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            builder.delete_eventtype(name)
            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error('Get CommonException when deleting eventtype. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot delete eventtype %s. error: %s",
                         name, traceback.format_exc())
            raise e

    @route('/:action=get_model_tree')
    @expose_page(must_login=True, methods=['GET'])
    def get_model_tree(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.get_model_tree()
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting model tree. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get model tree. error: %s",
                         traceback.format_exc())
            raise e

    @route('/:action=get_field_values')
    @expose_page(must_login=True, methods=['POST'])
    def get_field_values(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        search = params['search']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.get_field_values(search)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting field values. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get field values. error: %s", traceback.format_exc())
            raise e

    @route('/:action=update_eval')
    @expose_page(must_login=True, methods=['POST'])
    def update_eval(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        sourcetype = params['sourcetype']
        old_output_field = params['old_output_field']
        old_expression = params['old_expression']
        output_field = params['output_field']
        expression = params['expression']
        search = params['search']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.update_eval((sourcetype,),
                                      output_field,
                                      expression,
                                      search,
                                      old_output_field,
                                      old_expression)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when updating eval. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot update eval %s. error: %s",
                         expression, traceback.format_exc())
            raise e

    @route('/:action=create_eval')
    @expose_page(must_login=True, methods=['POST'])
    def create_eval(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        sourcetypes = params['sourcetypes']
        output_field = params['output_field']
        expression = params['expression']
        search = params['search']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.update_eval(sourcetypes,
                                      output_field,
                                      expression,
                                      search,
                                      check_exist=True)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when creating eval. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot create eval %s. error: %s",
                         expression, traceback.format_exc())
            raise e

    @route('/:action=delete_eval')
    @expose_page(must_login=True, methods=['POST'])
    def delete_eval(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        sourcetype = params['sourcetype']
        output_field = params['output_field']
        search = params["search"]
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.delete_eval(sourcetype, output_field, search)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when deleting eval. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot delete eval %s. error: %s",
                         output_field, traceback.format_exc())
            raise e

    @route('/:action=update_alias')
    @expose_page(must_login=True, methods=['POST'])
    def update_alias(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        sourcetype = params['sourcetype']
        old_output_field = params['old_output_field']
        old_input_field = params['old_input_field']
        output_field = params['output_field']
        input_field = params['input_field']
        search = params["search"]
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.update_alias((sourcetype,),
                                       output_field,
                                       input_field,
                                       search,
                                       old_output_field,
                                       old_input_field)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when updating field alias. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot update field alias %s. error: %s",
                         output_field, traceback.format_exc())
            raise e

    @route('/:action=create_alias')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['app_edit_cimmapping'])
    def create_alias(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)

        @metric_util.function_run_time(tags=['app_edit_cimmapping'])
        def cherrypy_session_get():
            return cherrypy.session.get("sessionKey")
        session = cherrypy_session_get()

        @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
        def scc_getMgmtUri():
            return scc.getMgmtUri()
        splunk_uri = scc_getMgmtUri()
        appname = controller_util.get_current_ta_project()
        sourcetypes = params['sourcetypes']
        output_field = params['output_field']
        input_field = params['input_field']
        search = params["search"]
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.update_alias(sourcetypes,
                                       output_field,
                                       input_field,
                                       search,
                                       check_exist=True)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when creating field alias. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot create field alias %s. error: %s",
                         output_field, traceback.format_exc())
            raise e

    @route('/:action=delete_alias')
    @expose_page(must_login=True, methods=['POST'])
    def delete_alias(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        sourcetype = params['sourcetype']
        input_field = params['input_field']
        output_field = params['output_field']
        search = params["search"]
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.delete_alias(sourcetype, output_field, input_field, search)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when deleting alias. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot delete alias %s. error: %s",
                         output_field, traceback.format_exc())
            raise e

    @route('/:action=get_knowledge_objects')
    @expose_page(must_login=True, methods=['POST'])
    def get_knowledge_objects(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        sourcetypes = params['sourcetypes']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.get_knowledge_objects(sourcetypes)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting knowledge objects for app %s. meta:%s, error:%s',
                         appname, params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get knowledge objects for app %s. error: %s",
                         appname, traceback.format_exc())
            raise e

    @route('/:action=save_models')
    @expose_page(must_login=True, methods=['POST'])
    def save_models(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        eventtype_name = params["eventtype_name"]
        new_models = params['new_models']
        old_models = params['old_models']
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.save_models(eventtype_name, new_models, old_models)
            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error('Get CommonException when saving models for eventtype %s. meta:%s, error:%s',
                         eventtype_name, params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot save models objects for eventtype %s. error: %s",
                         eventtype_name, traceback.format_exc())
            raise e

    @route('/:action=get_app_sourcetypes')
    @expose_page(must_login=True, methods=['GET'])
    def get_app_sourcetypes(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            res = builder.get_app_sourcetypes()
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting sourcetypes for app %s. meta:%s, error:%s',
                         appname, params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get sourcetypes for app %s. error: %s",
                         appname, traceback.format_exc())
            raise e

    @route('/:action=check_cim_available')
    @expose_page(must_login=True, methods=['POST'])
    def check_cim_available(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            confs = builder.check_cim_available()

            res = {"data": {"successful": True}}
            if confs:
                res = {"data": {"successful": False, "conf_names": confs}}
            return self.render_json(res)
        except CommonException as e:
            logger.error('Get CommonException when checking CIM available for app %s. meta:%s, error:%s',
                         appname, params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot check CIM available for app %s. error: %s",
                         appname, traceback.format_exc())
            raise e

    @route('/:action=merge_confs_from_default_to_local')
    @expose_page(must_login=True, methods=['POST'])
    def merge_confs_from_default_to_local(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = controller_util.get_current_ta_project()
        try:
            builder = TACIMBuilder(appname, splunk_uri, session)
            builder.merge_confs_from_default_to_local()
            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error('Get CommonException when merging conf files from default to local for app %s. meta:%s, error:%s',
                         appname, params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot merge conf files from default to local for app %s. error: %s",
                         appname, traceback.format_exc())
            raise e
