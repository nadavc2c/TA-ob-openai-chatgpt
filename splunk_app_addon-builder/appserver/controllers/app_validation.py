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

from aob.aob_common import builder_constant
from tabuilder_utility import ta_project_meta
from validation_app_cert.app_cert import AppCert
from tabuilder_utility.validation_utility import *
from ta_generator.builder_ta_validation import TAValidationBuilder
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility import common_util
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.apps_manage')


class validationHandler(controllers.BaseController):
    @route('/:action=submit_validation')
    @expose_page(must_login=False, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_validation'])
    def submit_validation_job(self, action, **params):
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        params = json.loads(raw_body)

        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        appname = params["app_name"] or ta_project_meta.get_appname({})

        try:
            vbuilder = TAValidationBuilder(splunkd_uri, session_key, appname)
            validators = [v.strip() for v in params["validators"].split(",")]

            # validate the username & password when app certification is selected
            if "app_cert_validation" in validators:
                conf_mgr = common_util.create_conf_mgr(session_key, splunkd_uri)
                settings = conf_mgr.get_conf(builder_constant.GLOBAL_SETTING_CONF_NAME)
                conf = settings.get(builder_constant.APP_CERT_STANZA)
                if not conf.get("username") or not conf.get("password"):
                    ce = CommonException()
                    ce.set_err_code(6008)
                    raise ce

                # try to get the token. If failed, will throw exceptions
                app_cert = AppCert(splunkd_uri, session_key, builder_constant.ADDON_BUILDER_APP_NAME)
                app_cert.app_conf = app_cert._get_app_cert_conf(need_validation=False)
                app_cert.get_token()

            # vbuilder.remove_all_validation_data_inputs()
            vid = vbuilder.start_validation_job(validators)
            result = {
                "validation_id": vid,
                "submission_result": "success",
                "app_name": appname
            }

            return self.render_json(result)
        except CommonException as e:
            vbuilder.cancel_validation_job()
            logger.error('Get CommonException when starting validation. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            vbuilder.cancel_validation_job()
            logger.error("Cannot start validation. error: %s", traceback.format_exc())
            raise e

    @route('/:action=cancel_validation')
    @expose_page(must_login=False, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_validation'])
    def cancel_validation_job(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        appname = params["app_name"]

        try:
            vbuilder = TAValidationBuilder(splunkd_uri, session_key, appname)
            vbuilder.cancel_validation_job()

            return self.render_json({"data": {"successful": True}})
        except CommonException as e:
            logger.error('Get CommonException when canceling validation. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            logger.error("Cannot cancel validation. error: %s", traceback.format_exc())
            raise e

    @route('/:action=load_validation')
    @expose_page(must_login=False, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_validation'])
    def load_validation_result(self, action, **params):
        appname = params["app_name"]
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()

        vbuilder = TAValidationBuilder(splunkd_uri, session_key, appname)
        status = vbuilder.get_validation_status()
        if status:
            return self.render_json(status)
        return self.render_json({"data": {"successful": True}})

    @route('/:action=get_validation_progress')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_validation'])
    def get_validation_progress(self, action, **params):
        appname = params['app_name']
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()

        try:
            vbuilder = TAValidationBuilder(splunkd_uri, session_key, appname)
            status = vbuilder.get_validation_status()
            if not status:
                return self.render_json({"app_name": appname, "progress": 100})
            if status.get("error"):
                vbuilder.cancel_validation_job()
                err_status = status.get("error")
                if err_status.get("err_code"):
                    return self.render_json({'err_code': err_status.get("err_code"),
                                             'err_args': err_status.get("err_args")})
                else:
                    logger.error("Validation error! Message: %s, traceback %s",
                        err_status.get("message"), err_status.get("traceback"))
                    raise Exception(err_status.get("message"))
            progress = status.get("progress", 0)
            if progress == 1.0:
                vbuilder.delete_data_input()
                vbuilder.delete_checkpoint()

            result = {
                "app_name": appname,
                "validation_id": status.get("validation_id"),
                "progress": int(100 * progress),
            }

            return self.render_json(result)
        except CommonException as e:
            vbuilder.cancel_validation_job()
            logger.error('Get CommonException when getting validation progress. meta:%s, error:%s',
                         params, traceback.format_exc())
            return self.render_json({'err_code': e.get_err_code(),
                                     'err_args': e.get_options()})
        except Exception as e:
            vbuilder.cancel_validation_job()
            logger.error("Cannot get validation progress. error: %s", traceback.format_exc())
            raise e

    @route('/:resource=validators')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_validation'])
    def get_validator_names(self, resource, **params):
        return self.render_json(ALL_TA_VALIDATORS)

    @route('/:action=test_app_cert')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_validation'])
    def test_app_cert(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        settings = json.loads(params['settings'])

        try:
            app_cert = AppCert(splunkd_uri, session_key, builder_constant.ADDON_BUILDER_APP_NAME)
            conf = settings.get("app_cert")
            app_cert.test_connection(conf)
            return self.render_json({"data": {"successful": True}})
        except CommonException as ce:
            return self.render_json({'err_code': ce.get_err_code(),
                                     'err_args': ce.get_options()})
