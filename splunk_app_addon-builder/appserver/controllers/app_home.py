import sys
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
controller_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_addon-builder', 'appserver', 'controllers'])
if controller_path not in sys.path:
    sys.path.insert(1, controller_path)
import sys_path_checker

import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
import splunk.clilib.cli_common as scc

import json
import time
import cherrypy
import logging
import traceback

from tabuilder_utility import app_util, common_util, builder_exception, upgrade_util
from ta_generator.app import App
from ta_meta_management import meta_util
from aob.aob_common.metric_collector import metric_util

import splunklib.binding as binding

logger = logging.getLogger('splunk.tabuilder.controllers.app_home')

common_util.initialize_apm()


class app_home(controllers.BaseController):
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_home'])
    def app_list(self, **params):
        result = list()
        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session, splunk_uri)
        try:
            disabled_apps = app_util.get_all_disabled_apps(service)
            builder_projects = meta_util.get_all_project_brief_meta(
                service, disabled_apps)
            logger.debug("brief metas:%s", builder_projects)
            builder_app_ids = list()
            external_app_brief_meta = dict()

            version, build = common_util.get_tab_version_and_build(service)
            if version == "3.0.0":
                # remove old resource_lib to avoid lib conflicts
                upgrade_util.cleanup_resources_libs()

            for app in builder_projects:
                logger.info("Got one app {}".format(app))
                if app.get('built_by_tabuilder', False):
                    aApp = {"id": "",
                            "name": "",
                            "icon": "",
                            "author": "",
                            "last_modified": "2016/01/01",
                            "version": "",
                            "create_by_builder": True,
                            "upgrade_info": {
                           }}

                    aApp["id"] = app["id"]
                    aApp["name"] = app["name"]
                    aApp["author"] = app["author"] or ''
                    aApp["version"] = app["version"] or ''
                    aApp["visible"] = app["visible"]
                    aApp["last_modified"] = time.strftime(
                        "%Y/%m/%d", time.gmtime(app["last_modify_time"]))
                    aApp["icon"] = app_util.get_icon(service, app)

                    app_service = App(app["id"], service)
                    app_tab_version = app_service.get_tabuilder_build()
                    aApp["upgrade_info"] = upgrade_util.get_upgrade_info(app_tab_version, version)

                    builder_app_ids.append(app["id"])
                    result.append(aApp)
                else:
                    external_app_brief_meta[app["id"]] = {
                        "id": app["id"],
                        "last_modify_time": time.strftime(
                            "%Y/%m/%d", time.gmtime(app["last_modify_time"]))
                    }

            installed_apps = app_util.list_existing_solutions(service)

            for app in installed_apps:
                aApp = {"name": "",
                        "icon": "",
                        "author": "",
                        "last_modified": "2016/01/01",
                        "version": "",
                        "create_by_builder": False}
                if app["id"] not in builder_app_ids:
                    aApp.update(app)
                    if app["id"] in external_app_brief_meta:
                        aApp.update(external_app_brief_meta[app["id"]])
                    result.append(aApp)

            app_util.remove_legacy_validation_rules()
            return self.render_json(result)
        except binding.HTTPError as ke:
            logger.error("HTTPError is caught when list all apps. %s",
                         traceback.format_exc())
            return self.render_json([{'err_code': 20}])

    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_home'])
    def app_delete(self, **params):

        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        service = common_util.create_splunk_service(session, splunk_uri)
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        app_context = json.loads(raw_body)
        app_name = app_context["name"]
        try:
            if meta_util.is_app_created_by_aob(service, app_name):
                app_util.delete_app(service, app_name, splunk_uri, session)
            else:
                raise builder_exception.CommonException(err_code=64, options={'current_app': app_name})
            return self.render_json(
                {"result": "success",
                 "message":
                 "TA {} has been successfully deleted".format(app_name)})
        except builder_exception.CommonException as e:
            logger.error('Fail to delete app. %s', traceback.format_exc())
            return self.render_json(
                {"err_code": e.get_err_code(),
                 "err_args": e.get_options()})
        except Exception as e:
            logger.error('Fail to delete app %s. %s', app_name, traceback.format_exc())
            return self.render_json({'err_code': 1003, 'err_args': app_name})

    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_home'])
    def apps_delete(self, **params):

        session = cherrypy.session.get("sessionKey")
        splunk_uri = scc.getMgmtUri()
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        app_context = json.loads(raw_body)
        to_be_deleted_apps = app_context.get("names", [])
        deleted_apps = []
        current_app = None
        service = common_util.create_splunk_service(session, splunk_uri)

        try:
            while len(to_be_deleted_apps) > 0:
                current_app = to_be_deleted_apps.pop()
                if meta_util.is_app_created_by_aob(service, current_app):
                    app_util.delete_app(service, current_app, splunk_uri, session)
                    deleted_apps.append(current_app)
                else:
                    raise RuntimeError()
            common_util.reload_splunk_apps(service)
            logger.info("TA %s has been successfully deleted", ', '.join(deleted_apps))
            return self.render_json(
                {"result": "success"})
        except Exception as e:
            logger.error('Fail to delete app %s. %s', current_app, traceback.format_exc())
            if len(deleted_apps) > 0:
                common_util.reload_splunk_apps(service)
            return self.render_json({
                'err_code': 60,
                'err_args': {
                    'current_app': current_app,
                    'deleted_apps': deleted_apps
                },
                'deleted_app_list': deleted_apps
            })
