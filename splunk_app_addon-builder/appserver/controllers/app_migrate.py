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
import time
import cherrypy
import logging
import traceback
from cherrypy.lib.static import serve_file

from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.export_util import AppMigrator
from tabuilder_utility.common_util import create_splunk_service, make_splunk_path
from tabuilder_utility import app_util, upgrade_util, common_util
from ta_generator.app import App
from aob.aob_common.metric_collector import metric_util

logger = logging.getLogger('splunk.tabuilder.controllers.app_migration')


class appMigrationHandler(controllers.BaseController):
    @route('/:action=export_app')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_migrate'])
    def export_ta_project_as_file(self, action, **params):
        uri = scc.getMgmtUri()
        session = cherrypy.session.get("sessionKey")
        app = params.get('app', None)
        try:
            if app:
                migrator = AppMigrator(app, uri, session)
                migrator.export_project()
                return self.render_json({'status': 'success'})
            else:
                raise CommonException(e_message='app is not set.', err_code=40)
        except CommonException as ce:
            logger.error('export project %s fails. %s', app,
                         traceback.format_exc())
            return self.render_json({
                'err_code': ce.get_err_code(),
                'err_args': ce.get_options()
            })
        except Exception as e:
            logger.error('export project %s fails. %s', app,
                         traceback.format_exc())
            return self.render_json({'err_code': 43, 'err_args': {'app': app}})

    @route('/:action=download_exported_app')
    @expose_page(must_login=True, methods=['GET'])
    @metric_util.function_run_time(tags=['tab_app_migrate'])
    def download_exported_ta_project_file(self, action, **params):
        uri = scc.getMgmtUri()
        session = cherrypy.session.get("sessionKey")
        app = params.get('app', None)
        try:
            if app:
                migrator = AppMigrator(app, uri, session)
                app_root_dir = make_splunk_path(['etc', 'apps', app])
                tar_file = migrator.get_exported_file_full_path(app_root_dir)
                if not os.path.isfile(tar_file):
                    raise CommonException(
                        e_message='tgz file {} not found.'.format(tar_file),
                        err_code=41,
                        options={'app': app})
                return serve_file(tar_file, "application/x-download",
                                  "attachment")
            else:
                raise CommonException(e_message='app is not set.', err_code=40)
        except CommonException as ce:
            logger.error('%s', traceback.format_exc())
            return self.render_json({
                'err_code': ce.get_err_code(),
                'err_args': ce.get_options()
            })

    @route('/:action=import_app')
    @expose_page(must_login=True, methods=['POST'])
    @metric_util.function_run_time(tags=['tab_app_migrate'])
    def import_ta_project_package_file(self, action, **params):
        uri = scc.getMgmtUri()
        session = cherrypy.session.get("sessionKey")
        pkg_file = params.get('app_package_file', None)
        try:
            if pkg_file is None:
                raise CommonException(
                    e_message='app_package_file is not in the parameter.',
                    err_code=42)
            file_name = pkg_file.filename
            # WINDOWNS will get file_name like:
            #    C:\Users\Administrator\Desktop\TA-t2458_1_0_0_export.tgz
            file_name = os.path.basename(file_name)
            full_package_path = AppMigrator.get_import_package_full_path(
                file_name)
            if os.path.isfile(full_package_path):
                os.remove(full_package_path)
            # must use binary mode to open file. otherwise windows will fail
            # TAB-1666
            with open(full_package_path, 'wb') as tar_f:
                while True:
                    data = pkg_file.file.read(16384)
                    if not data:
                        break
                    tar_f.write(data)
            service = create_splunk_service(session, uri)
            app_brief = AppMigrator.import_project(full_package_path, service)
            # should align the imported app info with the app_home list app interface
            version, build = common_util.get_tab_version_and_build(service)
            app_service = App(app_brief["id"], service)
            app_tab_version = app_service.get_tabuilder_build()
            imported_app_info = {
                'id': app_brief['id'],
                'name': app_brief['name'],
                'icon': app_util.get_icon(service, app_brief),
                'author': app_brief['author'],
                'visible': app_brief['visible'],
                'last_modified': time.strftime(
                    '%Y/%m/%d', time.gmtime(app_brief['last_modify_time'])),
                'version': app_brief['version'],
                'create_by_builder': True,
                "upgrade_info": upgrade_util.get_upgrade_info(app_tab_version, version)
            }
            if 'version_validation' in app_brief:
                imported_app_info.update({
                    'warn_code': app_brief['version_validation']['warn_code'],
                    'warn_args': app_brief['version_validation']['warn_args']
                })
            return self.render_json(imported_app_info)
        except CommonException as ce:
            logger.error('%s', traceback.format_exc())
            return self.render_json({
                'err_code': ce.get_err_code(),
                'err_args': ce.get_options()
            })
        except Exception as e:
            logger.error('fail to import TA project. %s', traceback.format_exc())
            return self.render_json({
                'err_code': 77
            })
