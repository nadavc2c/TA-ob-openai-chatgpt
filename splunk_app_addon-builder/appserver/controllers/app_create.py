from builtins import str
import sys
import re
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
import base64
import time
import random
import cherrypy
import logging
import traceback
import os

import controller_util
from ta_generator import builder, ta_configuration_meta
from tabuilder_utility import path_util, common_util
from tabuilder_utility.builder_exception import CommonException
from ta_meta_management import meta_util, meta_const, meta_manager
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.app_create')

common_util.initialize_apm()


class createHandler(controllers.BaseController):
    @route('/:action=create')
    @expose_page(must_login=True, methods=['GET', 'POST'])
    @metric_util.function_run_time(tags=['tab_app_create'])
    def create(self, action, **params):
        session_key = cherrypy.session.get("sessionKey")
        splunkd_uri = scc.getMgmtUri()
        if cherrypy.request.method == 'POST':
            response_dict = {}
            cl = cherrypy.request.headers["Content-Length"]
            raw_body = cherrypy.request.body.read(int(cl))
            meta = json.loads(raw_body)
            err_code = 0
            err_app = ''
            try:
                app_name = meta['projectName']
                pre_app_name = meta['previousProjectName']
                friendly_name = meta['friendlyName']
                # construct the meta for builder
                builder_meta = {
                    "appname": app_name,
                    "friendly_name": friendly_name,
                    "version": meta.get('projectVersion', ''),
                    "author": meta.get('projectAuthor', ''),
                    "description": meta.get('projectDescription', ''),
                    "theme": meta.get('themeColor', ''),
                    "large_icon": meta.get('largeIcon', ''),
                    "small_icon": meta.get('smallIcon', ''),
                    "visible": meta.get('visible', 0) == 1
                }
                if builder_meta['version']:
                    if not re.match(r"^(\w+\.)*(\w+)$", builder_meta['version']):  # nosemgrep
                        raise CommonException(err_code=6014)

                if not pre_app_name:
                    logger.info("TA builder creates app with meta: %s",
                                builder_meta)
                    err_code = 2002
                    err_app = app_name
                    response_dict['resp_status'] = 'creation_fail'
                    app_builder = builder.TABuilder(app_name, splunkd_uri,
                                                    session_key)
                    app_builder.generate_TA(builder_meta)
                    response_dict['resp_status'] = 'creation_success'
                else:
                    if pre_app_name == app_name:
                        logger.info("TA builder update app with meta: %s",
                                    builder_meta)
                        err_code = 2003
                        err_app = app_name
                        response_dict['resp_status'] = 'update_fail'
                        app_builder = builder.TABuilder(app_name, splunkd_uri,
                                                        session_key)
                        app_builder.update_TA_basic(builder_meta)
                        response_dict['resp_status'] = 'update_success'
                    else:
                        # rename the app
                        err_code = 2004
                        err_app = pre_app_name
                        app_builder = builder.TABuilder(
                            pre_app_name, splunkd_uri, session_key)
                        response_dict['resp_status'] = 'rename_fail'
                        app_builder.update_TA_name(builder_meta)
                        response_dict['resp_status'] = 'rename_success'

                # update the cookie if success
                controller_util.set_current_ta_project(app_name)
                controller_util.set_current_ta_display_name(friendly_name)
                response_dict["cookies"] = controller_util.format_response_cookie()
                mgr = meta_manager.create_meta_manager(session_key, splunkd_uri, meta_const.APP_CONTEXT, app_name)
                return self.render_json(response_dict)
            except CommonException as ce:
                logger.error("Error when create app. %s",
                             traceback.format_exc())
                response_dict['err_code'] = ce.get_err_code()
                response_dict['err_args'] = ce.get_options()
                response_dict['cookies'] = controller_util.format_response_cookie()
                return self.render_json(response_dict)
            except Exception as e:
                logger.error("Error when create app. %s",
                             traceback.format_exc())
                response_dict['err_code'] = err_code
                response_dict['err_args'] = {'reason': str(e),
                                             'app_name': err_app}
                response_dict['cookies'] = controller_util.format_response_cookie()
                return self.render_json(response_dict)
        else:
            try:
                if 'app_name' in params:
                    app = params['app_name']
                    if app == "":
                        # return the empty json
                        return self.render_json({})
                    else:
                        app_builder = builder.TABuilder(app, splunkd_uri,
                                                        session_key)
                        meta = app_builder.get_TA_basic_meta()
                        if meta:
                            friendly_name = meta.get('friendly_name', '')
                            controller_util.set_current_ta_project(app)
                            controller_util.set_current_ta_display_name(friendly_name)
                            result = {
                                'previousProjectName': app,
                                'projectName': app,
                                'friendlyName': friendly_name,
                                'projectVersion': meta.get('version', ''),
                                'projectAuthor': meta.get('author', ''),
                                'projectDescription': meta.get('description', ''),
                                'visible': 1 if meta.get('visible', False) else 0
                            }

                            if meta.get('theme', None):
                                result['themeColor'] = meta['theme']
                                if meta.get('large_icon', None):
                                    result['largeIcon'] = meta['large_icon']
                                if meta.get('small_icon', None):
                                    result['smallIcon'] = meta['small_icon']
                            service = common_util.create_splunk_service(session_key, splunkd_uri)
                            globalsetting_meta = ta_configuration_meta.GlobalSettingMeta(app, service)
                            result['isSetupEnabled'] = globalsetting_meta.is_global_setting_enabled()
                            result['cookies'] = controller_util.format_response_cookie()
                            return self.render_json(result)
                        else:
                            controller_util.delete_current_ta_project()
                            controller_util.delete_current_ta_display_name()
                            return self.render_json({'cookies': controller_util.format_response_cookie()})
                else:
                    logger.error("app_name is not in the params:%s.", params)
                    raise RuntimeError('app_name is not in the params')
            except CommonException as ce:
                logger.error("Can not get app basic info. %s", ce)
                return self.render_json({'err_code': ce.get_err_code(),
                                         'err_args': ce.get_options()})

    @route("/:action=upload_icon")
    @expose_page(must_login=True, methods=['POST'])
    def upload_icon_file(self, action, **params):
        try:
            # put the icon file to the tmp directory
            icon_dir = path_util.get_icon_upload_dir()
            if not os.path.isdir(icon_dir):
                os.mkdir(icon_dir)
            ts = int(time.time())
            rn = random.randint(0, 100)
            l_icon_name = 'licon_{}_{}.png'.format(ts, rn)
            icon_l = os.path.join(icon_dir, l_icon_name)
            with open(icon_l, 'wb') as f:
                f.write(base64.b64decode(params['large_icon']))
            s_icon_name = 'sicon_{}_{}.png'.format(ts, rn)
            icon_s = os.path.join(icon_dir, s_icon_name)
            with open(icon_s, 'wb') as f:
                f.write(base64.b64decode(params['small_icon']))

            return self.render_json({
                'large_icon': l_icon_name,
                'small_icon': s_icon_name
            })
        except Exception as e:
            return self.render_json({'error': "Exception: {}".format(e)})
