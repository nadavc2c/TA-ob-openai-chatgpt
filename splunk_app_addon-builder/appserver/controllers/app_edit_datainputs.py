from builtins import str
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
from tabuilder_utility import app_util, common_util, search_util, data_input_util
from tabuilder_utility.builder_exception import CommonException
from ta_generator import builder
from ta_generator import builder_ta_input
from ta_generator import builder_ta_alert
from ta_generator.modinput_runner import runner
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.app_edit_datainputs')


class appsHandler(controllers.BaseController):

    @route('/:action=get_inputs_summary')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def get_inputs_summary(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session_key, splunkd_uri)
        tabuilder = builder.TABuilder(controller_util.get_current_ta_project(),
                                      splunkd_uri, session_key, service)
        all_inputs = tabuilder.get_all_TA_inputs() or []
        search_result = search_util.get_sourcetype_from_index(service)
        sourcetypes_totalcount = {entry['sourcetype']: entry['totalCount']
                                  for entry in search_result}
        for _input in all_inputs:
            _input['sample_count'] = sourcetypes_totalcount.get(
                _input['sourcetype'], 0)
        # get the code for customized modinput
        input_codes = tabuilder.get_customized_data_input_code(all_inputs)
        for _input in all_inputs:
            if _input['name'] in input_codes:
                _input['code'] = input_codes[_input['name']]
        return self.render_json(all_inputs)

    @route('/:action=get_input_names')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def get_input_names(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session_key, splunkd_uri)
        tabuilder = builder.TABuilder(controller_util.get_current_ta_project(),
                                      splunkd_uri, session_key, service)
        all_inputs = tabuilder.get_all_TA_inputs() or []
        return self.render_json({"input_names": [_input['name'] for _input in all_inputs]})

    @route('/:action=add_data_input')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def add_data_input(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        reload_input = params.get('reload_input', True)
        if 'reload_input' in params:
            del params['reload_input']
        appname = controller_util.get_current_ta_project()
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TABuilder(appname, splunkd_uri, session_key)
            meta = tabuilder.create_TA_input(params, reload_input)
            return self.render_json({"status": "success", 'meta': meta})
        except CommonException as e:
            logger.error(
                'Get CommonException when create data input. meta:%s, error:%s',
                params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error('fail to create data input, meta:%s, error: %s',
                         params, traceback.format_exc())
            raise e

    @route('/:action=fetch_data_input_code')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def fetch_input_code(self, action, **params):
        '''
        call this to fetch modinput code. Used in input wizard.
        '''
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TABuilder(appname, splunkd_uri, session_key)
            meta = tabuilder.fetch_input_code(params)
            logger.info('fetch input code:%s', meta)
            return self.render_json(meta)
        except Exception as e:
            logger.error('fetch input code error. %s',
                         traceback.format_exc())
            raise e

    @route('/:action=edit_data_input')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def edit_data_input(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        reload_input = params.get('reload_input', True)
        if 'reload_input' in params:
            del params['reload_input']
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TABuilder(appname, splunkd_uri, session_key)
            tabuilder.update_TA_input(params, reload_input)
            return self.render_json({"status": "success", "meta": params})
        except CommonException as e:
            logger.error(
                'Get CommonException when update data input. meta:%s, error:%s',
                params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error(
                'Get exception when update data input. meta:%s, error:%s',
                params, traceback.format_exc())
            raise e

    @route('/:action=delete_data_input')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def delete_data_input(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        splunkd_uri, session_key = scc.getMgmtUri(), cherrypy.session.get(
            "sessionKey")
        try:
            tabuilder = builder.TABuilder(appname, splunkd_uri, session_key)
            tabuilder.delete_TA_input(params)
            return self.render_json({"status": "success"})
        except CommonException as e:
            logger.error('Fail to delete data input. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error('Fail to delete data input. meta:%s, error:%s',
                         params, traceback.format_exc())
            raise e

    @route('/:action=code_save')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def code_save(self, action, **params):
        # TODO: delete this api. Save the code when savin the input
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        tabuilder = builder.TABuilder(appname, splunk_uri, session)
        tabuilder.save_TA_input_code(params)

        return self.render_json({"status": "successful"})

    @route('/:action=generate_test_id')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def gen_test_id(self, action, **params):
        username = cherrypy.session.get('user').get('name')
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session_key, splunkd_uri)
        r = app_util.is_user_allow_to_create_ta(username, service)
        if r:
            # if getting error code, just render it
            return self.render_json(r)
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        meta = json.loads(raw_body)  # params is the meta for this input
        appname = controller_util.get_current_ta_project()
        input_builder = builder_ta_input.TAInputBuilder(
            appname, splunkd_uri, session_key)
        meta = input_builder.get_dry_run_job_id(meta)
        return self.render_json(meta)

    @route('/:action=code_run')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def code_run(self, action, **params):
        # check the role of current user, only admin can run code
        username = cherrypy.session.get('user').get('name')
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session_key, splunkd_uri)
        params = None
        try:
            r = app_util.is_user_allow_to_create_ta(username, service)
            if r:
                # if getting error code, just render it
                return self.render_json(r)

            cl = cherrypy.request.headers["Content-Length"]
            raw_body = cherrypy.request.body.read(int(cl))
            params = json.loads(raw_body)  # params is the meta for this input
            appname = controller_util.get_current_ta_project()
            input_builder = builder_ta_input.TAInputBuilder(
                appname, splunkd_uri, session_key)
            dryrun_result = input_builder.dryrun_modinput_code(params)
            return self.render_json(dryrun_result)
        except CommonException as ce:
            logger.error('Fail to dryrun data input. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})

    @route('/:action=search_json_object')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def search_json_object(self, action, **params):
        '''
        the POST payload is like
        {
            root_object: {...}
            json_path: {key: [jpath]}
        }

        return value is
        {"data": {key: [{value: xxx, xpath:xxx}...]}}
        '''
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)  # params is the meta for this input
        if not params.get('root_object'):
            return self.render_json({'err_code': 3156})
        if not params.get('json_path'):
            return self.render_json({'err_code': 3157})
        try:
            r, errs = data_input_util.search_with_json_path(params['root_object'], params['json_path'])
            return self.render_json({"data": r, "errs": errs})
        except:
            return self.render_json({"data": {}})


    @route('/:action=code_check_pid')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def code_check_pid(self, action, **params):
        if 'test_id' not in params:
            self.render_json({'err_code': 3139})
        code_checker = runner.CodeChecker()
        pid_existed = code_checker.check_pid(str(params['test_id']))
        return self.render_json({"status": pid_existed})

    @route('/:action=code_kill_all')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def code_kill_all(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        appname = controller_util.get_current_ta_project()
        code_killer = runner.CodeKiller()
        code_killer.kill_all(appname, params['name'])
        return self.render_json({"status": "successful"})

    @route('/:action=code_kill_pid')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def code_kill_pid(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)
        if 'test_id' not in params:
            self.render_json({'err_code': 3140})
        code_killer = runner.CodeKiller()
        code_killer.kill_pid(str(params['test_id']))
        return self.render_json({"status": "successful"})

    @route('/:action=get_input_load_status')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def get_input_load_status(self, action, **param):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        input_builder = builder_ta_input.TAInputBuilder(
            controller_util.get_current_ta_project(), splunkd_uri, session_key)
        response = {}
        try:
            response = input_builder.get_input_loaded_status()
        except CommonException as ce:
            logger.error('get input load status fails. %s',
                         traceback.format_exc())
            response['err_code'] = ce.get_err_code()
            response['err_args'] = ce.get_options()
        return self.render_json(response)

    @route('/:action=validate_input_meta')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_edit_datainputs'])
    def validate_input_meta(self, action, **params):
        '''
        post body:
            {
                "uuid": uuid // first time to create the input, no uuid yet
                "name": name,
                "title": title,
                "description": description,
                "type": type,
                "sourcetype": sourcetype,
                "interval": interval,
            }
        '''
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        input_builder = builder_ta_input.TAInputBuilder(
            controller_util.get_current_ta_project(), splunkd_uri, session_key)
        alert_builder = builder_ta_alert.TAAlertBuilder(
            controller_util.get_current_ta_project(), splunkd_uri, session_key)
        input_builder.set_alert_builder(alert_builder)
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        meta = json.loads(raw_body)
        response = {}
        try:
            input_builder.validate_input_name_and_sourcetype(meta)
            response['validate_result'] = 'success'
        except CommonException as ce:
            logger.error('Validate input meta fails. %s',
                         traceback.format_exc())
            response['err_code'] = ce.get_err_code()
            response['err_args'] = ce.get_options()
        return self.render_json(response)
