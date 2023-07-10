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
import json
import logging
import traceback

from ta_generator.builder import TABuilder
from ta_generator.builder_ta_extraction import TAExtractionBuilder
from tabuilder_utility.builder_exception import CommonException
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger(
    'splunk.tabuilder.controllers.app_edit_fieldextraction')


class appsHandler(controllers.BaseController):

    @route('/:action=importmethods')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_all_importmethods(self, action, **params):
        methods = [{"name": "File"}, {"name": "SPL"}]
        return self.render_json(methods)

    @route('/:action=start_parse_unstructured_data')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def start_parse_unstructured_data(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']
        batch_size = params.get("batch_size", None)

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            tabuilder.remove_all_unstructured_data_inputs()
            tabuilder.start_parse_unstructured_data(sourcetype, batch_size)
            return self.render_json({"data": {"successful": True,
                                              "app_name": app_name,
                                              "sourcetype": sourcetype}})

        except CommonException as e:
            tabuilder.cancel_parse_unstructured_data(sourcetype)
            logger.error('Get CommonException when getting auto extraction results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            tabuilder.cancel_parse_unstructured_data(sourcetype)
            logger.error("Cannot get extractions for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=cancel_parse_unstructured_data')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def cancel_parse_unstructured_data(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            tabuilder.cancel_parse_unstructured_data(sourcetype)
            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error('Get CommonException when getting auto extraction results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get extractions for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=get_unstructured_result')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_unstructured_result(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.get_unstructured_data_results(sourcetype)
            tabuilder.cancel_parse_unstructured_data(sourcetype)
            return self.render_json({"data": res})

        except CommonException as e:
#             tabuilder.cancel_parse_unstructured_data(sourcetype)
            logger.error('Get CommonException when getting auto extraction results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
#             tabuilder.cancel_parse_unstructured_data(sourcetype)
            logger.error("Cannot get extractions for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=get_extraction_progress')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_unstructured_data_status(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            results = tabuilder.get_unstructured_data_status(sourcetype)
            if results.get("error"):
                tabuilder.cancel_parse_unstructured_data(sourcetype)
                return self.render_json(results.get("error"))

            return self.render_json({"data": results})
        except CommonException as e:
            tabuilder.cancel_parse_unstructured_data(sourcetype)
            logger.error('Get CommonException when getting auto extraction results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            tabuilder.cancel_parse_unstructured_data(sourcetype)
            logger.error("Cannot get extractions for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=setregex')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def set_regex_results(self, action, **params):
        @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
        def cherrypy_session_get():
            return cherrypy.session.get("sessionKey")
        session = cherrypy_session_get()

        @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
        def scc_getMgmtUri():
            return scc.getMgmtUri()
        splunk_uri = scc_getMgmtUri()
        key_values = json.loads(params['key_values'])
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            extract_builder = TAExtractionBuilder(splunk_uri, session, app_name)

            regexes = key_values.get("regexes")
            if not regexes:
                raise ValueError('Param "key_values" should have a key "regexes"')

            meta = extract_builder.get_meta_results(sourcetype) or {}
            extract_builder.delete_extraction(sourcetype, delete_meta=False, meta=meta)
            meta = extract_builder.save_regexes(sourcetype, regexes, meta=meta)
            meta = extract_builder.set_sourcetype_parsed(sourcetype, meta=meta)
            extract_builder.update_meta_results(sourcetype, meta)

            # update props.conf
            extract_builder.update_props_conf(sourcetype, regexes)
            return self.render_json({"data": {"successful": True}})
        except Exception as e:
            logger.error("Cannot set extractions for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=load_unstructured_data_result')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def load_unstructured_data_result(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            results = tabuilder.load_unstructured_data_result(sourcetype)
            if not results:
                ret = {
                    'err_code': 4006,
                    'err_args': {"sourcetype": sourcetype},
                }
                return self.render_json(ret)
            return self.render_json({"data": results})
        except Exception as e:
            logger.error("Cannot load extractions for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=cancelregexgen')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def cancel_regex_generation(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            tabuilder.cancel_extraction_process()
            return self.render_json({"data": {"successful": True}})
        except Exception as e:
            logger.error("Cannot cancel extraction process for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=get_sourcetype_extraction_status')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_sourcetype_extraction_status(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            status = tabuilder.get_sourcetype_extraction_status()
            return self.render_json({"data": status})
        except Exception as e:
            logger.error("Cannot get extraction status. error: %s",
                         traceback.format_exc())
            raise e

    @route('/:action=get_events')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_events(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']
        batch_size = params.get("batch_size", 1000)

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            events = tabuilder.get_events(sourcetype, batch_size)
            if not events:
                return self.render_json({
                    "err_code": 4011,
                    "err_args": {"sourcetype": sourcetype}
                })
            return self.render_json({"data": [e.get("_raw") for e in events]})
        except Exception as e:
            logger.error("Cannot get events for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=get_table_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_table_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']
        delim = params.get('delim', None)

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.get_table_format_results(sourcetype, delim)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting table format results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get table results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=save_table_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def save_table_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)  # get param from json body
        app_name = params['app_name']
        sourcetype = params['sourcetype']
        headers = params["headers"]
        delim = params["delim"]

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.save_table_format_results(
                sourcetype, headers, delim)
            return self.render_json({"data": res})
        except Exception as e:
            logger.error("Cannot save table results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=load_table_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def load_table_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.load_table_format_results(sourcetype)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting table format results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot load table results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=get_kv_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_kv_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']
        delim_pair = params.get("delim_pair", ",")
        delim_kv = params.get("delim_kv", "=")
        regex = params.get("regex", None)

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.get_kv_format_results(
                sourcetype, delim_pair, delim_kv, regex)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting kv format results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get KV results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=save_kv_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def save_kv_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)  # get param from json body
        app_name = params['app_name']
        sourcetype = params['sourcetype']
        delim_pair = params.get("delim_pair", None)
        delim_kv = params.get("delim_kv", None)
        regex = params.get("regex", None)

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.save_kv_format_results(
                sourcetype, delim_pair, delim_kv, regex)
            return self.render_json({"data": res})
        except Exception as e:
            logger.error("Cannot save KV results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=load_kv_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def load_kv_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.load_kv_format_results(sourcetype)
            return self.render_json({"data": res})
        except CommonException as e:
            logger.error('Get CommonException when getting kv format results. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot get KV results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=get_kv_templates')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def get_kv_templates(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.get_kv_templates()
            return self.render_json({"data": res})
        except Exception as e:
            logger.error("Cannot get KV templates. error: %s",
                         traceback.format_exc())
            raise e

    @route('/:action=delete_extraction')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def delete_extraction(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.delete_extraction(sourcetype)
            return self.render_json({"data": res})
        except Exception as e:
            logger.error("Cannot delete extractions for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=save_json_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def save_json_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)  # get param from json body
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.save_json_format_results(sourcetype)
            return self.render_json({"data": res})
        except Exception as e:
            logger.error("Cannot save JSON results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=save_xml_format_results')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_fieldextraction'])
    def save_xml_format_results(self, action, **params):
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)  # get param from json body
        app_name = params['app_name']
        sourcetype = params['sourcetype']

        try:
            tabuilder = TABuilder(app_name, splunk_uri, session)
            res = tabuilder.save_xml_format_results(sourcetype)
            return self.render_json({"data": res})
        except Exception as e:
            logger.error("Cannot save XML results for sourcetype %s. error: %s",
                         sourcetype, traceback.format_exc())
            raise e

    @route('/:action=check_fe_available')
    @expose_page(must_login=True, methods=['POST'])
    def check_fe_available(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        appname = params['app_name']
        try:
            builder = TAExtractionBuilder(splunk_uri, session, appname)
            confs = builder.check_fe_available()
            res = {"data": {"successful": True}}
            if confs:
                res = {"data": {"successful": False, "conf_names": confs}}
            return self.render_json(res)
        except CommonException as e:
            logger.error('Get CommonException when checking field extraction available for app %s. meta:%s, error:%s',
                         appname, params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot check field extraction available for app %s. error: %s",
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
        appname = params['app_name']
        try:
            builder = TAExtractionBuilder(splunk_uri, session, appname)
            builder.merge_confs_from_default_to_local()
            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error(
                'Get CommonException when merging conf files from default to local for app %s. meta:%s, error:%s',
                appname, params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot merge conf files from default to local for app %s. error: %s",
                         appname, traceback.format_exc())
            raise e
