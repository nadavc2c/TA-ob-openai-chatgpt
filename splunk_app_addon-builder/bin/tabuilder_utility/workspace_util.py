# encoding = utf-8
import os
import re
import shutil
import tarfile
import traceback
import stat

from aob.aob_common import logger, builder_constant
from aob.aob_common.conf_parser import TABConfigParser
from . import common_util
from ta_modular_alert_builder import modular_alert_builder as mab
from ta_modular_alert_builder import ta_merge as ta_merge
from ta_meta_management import meta_util as meta_util
from ta_generator import app as ProjectApp
from aob.aob_common.metric_collector import metric_util
from aob.aob_common import package_util, global_setting_util

pkg_logger = logger.get_builder_util_logger()


@metric_util.function_run_time(tags=['workspace_util'])
def get_package_file_full_path_with_package_name(package_file_name):
    download_dir = common_util.make_splunk_path([
        'etc', 'apps', builder_constant.ADDON_BUILDER_APP_NAME, 'appserver',
        'static', 'download'
    ])
    if not os.path.isdir(download_dir):
        os.makedirs(download_dir)
    return os.path.join(download_dir, package_file_name)

@metric_util.function_run_time(tags=['workspace_util'])
def get_package_file_path(app):
    app_root = common_util.make_splunk_path(['etc', 'apps', app])
    app_version = package_util.get_app_version(app_root)
    package_file_name = package_util.get_package_filename(app, app_version)
    return get_package_file_full_path_with_package_name(package_file_name)

@metric_util.function_run_time(tags=['workspace_util'])
def prepare_app_package_workspace(package_workspace,
                                  app_source_path,
                                  tabuilder):
    '''
    This function will preprocess the workspace for project export
    and project package.
    :param package_workspace: the path of temporary workspace
    :param app_source_path: the path of the app source code
    :param tabuilder: the TABuilder instance
    '''
    if not os.path.exists(os.path.dirname(package_workspace)):
        os.makedirs(os.path.dirname(package_workspace))
    if os.path.isdir(package_workspace):
        shutil.rmtree(package_workspace)

    # process the add_on_builder.conf
    edited_flag = meta_util.is_ta_project_edited(tabuilder.tab_service,
                                                 tabuilder.app_name)

    tabuilder.basic_builder.generate_add_on_builder_conf(edited_flag)
    app_project = ProjectApp.App(tabuilder.app_name, tabuilder.tab_service)
    app_project.update_is_edited_flag(edited_flag)

    shutil.copytree(
        app_source_path,
        package_workspace,
        ignore=shutil.ignore_patterns('*.pyc', '*.pyo'))


@metric_util.function_run_time(tags=['workspace_util'])
def package_app(tabuilder):
    app = tabuilder.app_name
    # copy the ta project to package workspace dir
    app_path = common_util.make_splunk_path(['etc', 'apps', app])
    package_workspace = common_util.make_splunk_path(
        ["var", "data", "tabuilder", "package", app])
    prepare_app_package_workspace(package_workspace, app_path, tabuilder)
    app_version = package_util.get_app_version(package_workspace)
    download_file_path = get_package_file_path(app)
    package_util.package_add_on(app, package_workspace, download_file_path, copy_project=False, tabuilder=tabuilder)
    return download_file_path
