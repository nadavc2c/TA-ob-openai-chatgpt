from builtins import range
from builtins import object
import os
import re
import shutil
import traceback
import tempfile
import json

from mako.template import Template

from ta_generator import ta_configuration_meta
from ta_generator import ta_basic_meta
from ta_generator import ta_static_asset_generator
from aob.aob_common import logger, builder_constant, conf_parser
from tabuilder_utility import common_util, file_content_util, builder_exception, upgrade_util
from aob.aob_common import global_setting_util
from aob.aob_common.metric_collector import metric_util

from uccrestbuilder.endpoint.multiple_model import (
    MultipleModelEntityBuilder,
    MultipleModelEndpointBuilder,
)
from uccrestbuilder.endpoint.field import RestFieldBuilder
from uccrestbuilder.global_config import GlobalConfigBuilderSchema, GlobalConfigPostProcessor
import uccrestbuilder
from aob.aob_common.metric_collector import metric_util
from pathlib import Path

import time

from splunktaucclib.rest_handler.endpoint.field import RestField
from solnlib.splunkenv import make_splunkhome_path
from solnlib.utils import is_true
from splunk_add_on_ucc_framework import generate as ucc_gen
from aob.aob_common.metric_collector import monitor
m = monitor.Monitor()


class TAConfigurationBuilder(object):
    '''
    TA configuration builder writes all the resources to some temp dir.
    Then, merge it to the app root dir.
    Doing these 2 steps have some benifits.
    1. if generating the resources fails, there is no impact to the current TA.
    2. when there are multiple builders modify the same conf, we need these 2 step commit.Before commiting,
     delete the stanzas generated last time.

    Builder constructs the meta information in memory according to the user inputs.
    Then, flush all the information out the disk.
    '''
    INPUT_CONF_PATTERN = re.compile('inputs\.conf$')
    INPUT_CONF_SPEC_PATTERN = re.compile('inputs\.conf\.spec$')
    REQUIREMENTS_PATTERN = re.compile('requirements\.txt$')
    PY_DECLARE_PATTERN = re.compile('([\w\_]+)_declare\.py$')

    @classmethod
    def _get_stash_dir(cls):
        '''
        stash dir is a temp dir for builder to write the resources.
        the caller needs to delete the stash dir
        '''
        workspace = builder_constant.BUILDER_WORKSPACE_ROOT
        if not os.path.isdir(workspace):
            workspace = None
        return tempfile.mkdtemp(prefix='ta_conf_bld', dir=workspace)

    @metric_util.function_run_time(tags=['configuration_builder'])
    def __init__(self, appname, service_with_tab_context,
                 service_with_ta_context):
        self._appname = appname
        self._logger = logger.get_global_settings_builder_logger()
        pdir = os.path.split(os.path.realpath(__file__))[0]
        self._resource_dir = os.path.join(pdir, "resources")
        self._resource_lib_dir = os.path.join(pdir, "resources_lib")
        self._ucc_lib_resource_dir = os.path.join(pdir, 'ucc_resources')
        self._current_app_dir = common_util.make_splunk_path(
            ['etc', 'apps', self._appname])
        self._service_with_ta_context = service_with_ta_context
        self._service_with_tab_context = service_with_tab_context
        self._global_setting_meta = ta_configuration_meta.GlobalSettingMeta(
            appname, service_with_tab_context)
        self._static_asset_gen = ta_static_asset_generator.AssetGenerator(
            self._resource_dir, self._current_app_dir, self._resource_lib_dir)
        self._basic_meta = ta_basic_meta.TABasicMeta(
            self._appname, self._service_with_tab_context)

    @property
    def global_setting_meta_object(self):
        return self._global_setting_meta

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def get_global_settings(self):
        meta = self._global_setting_meta.meta
        # # sync global configuration from ucc
        # meta = self._global_setting_meta.read_global_configuration(meta)
        # self._logger.debug('get global setting meta:%s', meta)
        return meta

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def clean_up_ucc_confs(self):
        conf_names = []
        conf_names.append(
            global_setting_util.get_global_settings_conf_file_name(
                self._appname))
        conf_names.append(
            global_setting_util.get_global_account_conf_file_name(
                self._appname))
        spec_file_paths = [
            os.path.join(self._current_app_dir, 'README', n + '.spec')
            for n in conf_names
        ]
        default_conf_paths = [
            os.path.join(self._current_app_dir, 'default', n)
            for n in conf_names
        ]
        local_conf_paths = [
            os.path.join(self._current_app_dir, 'local', n) for n in conf_names
        ]
        for i in range(len(spec_file_paths)):
            file_content_util.clean_up_conf_file(default_conf_paths[i],
                                                 spec_file_paths[i])
            file_content_util.clean_up_conf_file(local_conf_paths[i],
                                                 spec_file_paths[i])

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def delete_global_settings(self):
        '''
        :ret: True any resource is generated after deleting the global setting part.
              Because we may need to generate the resource to manage the inputs
        '''
        self._logger.info('Delete global settings in app %s', self._appname)
        self.delete_ta_configuration_resources()
        self._global_setting_meta.delete_global_settings_meta()
        # try to gen the modular input pages if any
        resource_generated = self.generate_ta_configuration_resources(
            None, False, False)
        self.clean_up_ucc_confs()
        # regen the app.conf, set the visible flag right
        self._static_asset_gen.generate_app_conf(
            self._basic_meta.meta, is_setup_page_enabled=False)
        return resource_generated

    def get_ucc_json_file_path(self, app_root):
        return os.path.join(app_root, 'appserver', 'static', 'js', 'build',
                            'globalConfig.json')

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def update_global_settings(self,
                               meta,
                               include_input_conf=False,
                               reload_app=True):
        '''
        :ret: True if any resource is generated, False if no resource is generated
        '''
        resource_generated = False
        if meta:
            # need to delete the previous assets
            self.delete_ta_configuration_resources()
            # generate the new assets
            resource_generated = self.generate_ta_configuration_resources(
                meta, include_input_conf, reload_app=reload_app)
            self._global_setting_meta.meta = meta
            self.clean_up_ucc_confs()
        else:
            resource_generated = self.delete_global_settings()
        return resource_generated

    def regenerate_ucc_resources(self, reload_app=True):
        return self.generate_ta_configuration_resources(
            self.get_global_settings(), False, reload_app=reload_app)

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def delete_ta_configuration_resources(self):
        ucc_meta = self._global_setting_meta.get_ucc_meta(
            self._global_setting_meta.meta)
        if ucc_meta is None:
            return
        has_input = self._global_setting_meta.is_input_meta_in_ucc_meta(
            ucc_meta)
        stash_dir = self._get_stash_dir()
        try:
            self._logger.info(
                'Generate ta to-be-delete configuration resources to stash dir %s',
                stash_dir)
            self._generate_ucc_asset(stash_dir, ucc_meta,
                                     self._global_setting_meta.meta)
            lambdas = {}
            if has_input:
                # do not delete the input related confs
                lambdas = {
                    self.INPUT_CONF_PATTERN:
                    file_content_util.FILE_LAMBDAS['no_op'],
                    self.INPUT_CONF_SPEC_PATTERN:
                    file_content_util.FILE_LAMBDAS['no_op']
                }
            default_lambda = file_content_util.FILE_LAMBDAS['delete_dst']
            file_content_util.transform_files(
                stash_dir,
                self._current_app_dir,
                lambdas=lambdas,
                default_lambda=default_lambda)
        except Exception as e:
            self._logger.error('fail to delete the ucc assets. %s',
                               traceback.format_exc())
            raise e
        finally:
            shutil.rmtree(stash_dir)

    def _generate_ucc_asset(self, stash_dir, ucc_meta, global_setting_meta):
        # generate the UCC fraemwork and generate the js file
        ctx = {
            'app': self._appname,
            'theme_color': self._basic_meta.theme_color,
            'ucc_meta': ucc_meta
        }
        file_content_util.copy_dir(
            self._ucc_lib_resource_dir, stash_dir, mako_context=ctx)
        ucc_meta_json = self.get_ucc_json_file_path(stash_dir)
        if not os.path.isdir(os.path.dirname(ucc_meta_json)):
            os.makedirs(os.path.dirname(ucc_meta_json))
        with open(ucc_meta_json, 'w') as jsonfile:
            json.dump(ucc_meta, jsonfile, indent=4)
        self._logger.debug(
            'generate the ucc frontend files to %s, mako_context:%s',
            stash_dir, ctx)
        # generate the ucc backend rest hanlder
        uccrestbuilder.build(
            CustomGlobalConfigBuilderSchema(ucc_meta),
            'splunk_aoblib.rest_migration.ConfigMigrationHandler',
            stash_dir,
            post_process=GlobalConfigPostProcessor(),
            import_declare_name=(
                common_util.get_python_declare_file_name(self._appname)[:-3]))
        # remove the locale folder
        locale_dir = os.path.join(stash_dir, 'locale')
        if os.path.isdir(locale_dir):
            shutil.rmtree(locale_dir)
        # should move the default global settings conf to the default dir
        default_dir = os.path.join(stash_dir, 'default')
        if not os.path.isdir(default_dir):
            os.mkdir(default_dir)
        ucc_confs = [
            self._global_setting_meta.global_account_conf_name,
            self._global_setting_meta.global_settings_conf_name
        ]
        for _conf in ucc_confs:
            local_conf = os.path.join(stash_dir, 'local', _conf)
            if os.path.isfile(local_conf):
                shutil.move(local_conf, os.path.join(default_dir, _conf))
        # move the local/data/ui to default/data/ui
        local_data_dir = os.path.join(stash_dir, 'local', 'data')
        if os.path.isdir(local_data_dir):
            shutil.move(local_data_dir, os.path.join(default_dir))
        # generate the global_checkbox_param.json if needed
        # the file name is hard coded. it works like a protocol
        if global_setting_meta:
            checkbox_param_file_name = os.path.join(
                stash_dir, 'bin', 'global_checkbox_param.json')
            checkbox_params = [
                global_var['name']
                for global_var in global_setting_meta.get(
                    'customized_settings', [])
                if global_var.get('type', '') == 'checkbox'
            ]
            if checkbox_params:
                with open(checkbox_param_file_name, 'w') as fp:
                    json.dump(checkbox_params, fp)
        self._logger.debug('generate the ucc backend files to %s', stash_dir)

    def _generate_ui(self, destination):
        stash_dir = self._get_stash_dir()
        try:
            self._logger.info("Created stash_dir %s", stash_dir)
            source_path = self.get_temp_ucc_ui_gen_dir()
            self._logger.info("Created temp_dir %s", source_path)
            Path(source_path).mkdir(parents=True, exist_ok=True)
            shutil.copy2(self.get_ucc_json_file_path(destination), source_path)
            shutil.copy2(os.path.join(self._get_created_addon_dir(self._appname), "app.manifest"), source_path)
            self._logger.info("Copying manifest")
            output_dir_path = os.path.join(stash_dir, "output")
            app_version = self.extract_app_version_or_default("1.0.0")
            ucc_gen(source_path, os.path.join(source_path, 'globalConfig.json'), app_version, output_dir_path)
            generated_addon = os.path.join(output_dir_path, self._appname)
            self._logger.info("Copying UI from ucc gen - %s to our addon %s", generated_addon, destination)
            file_content_util.copy_dir(
                os.path.join(generated_addon, "appserver"), os.path.join(destination, "appserver"))
            shutil.copy2(os.path.join(generated_addon, "default", "restmap.conf"), os.path.join(destination, "local"))
        finally:
            shutil.rmtree(self.get_temp_ucc_ui_gen_dir())
            shutil.rmtree(os.path.join(stash_dir, "output", self._appname))

    def get_temp_ucc_ui_gen_dir(self):
        return os.path.join(self._get_created_addon_dir(self._appname), "temp")

    def extract_app_version_or_default(self, default_version):
        app_conf = os.path.join(self._current_app_dir, "default", "app.conf")
        parser = TAConfigurationBuilder.parse_ini_file(app_conf)
        if parser and parser.has_section("launcher"):
            return parser.get("launcher", "version")
        return default_version

    @staticmethod
    def parse_ini_file(path_to_ini):
        parser = None
        if os.path.isfile(path_to_ini):
            parser = conf_parser.TABConfigParser()
            parser.read(path_to_ini)
        return parser

    @classmethod
    def _get_created_addon_dir(cls, ta_name: str):
        return make_splunkhome_path(["etc", "apps", ta_name])

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def generate_ta_configuration_resources(self, global_setting_meta,
                                            include_input_conf, reload_app):
        '''
        :param global_setting_meta: global setting meta data, can be empty or None
        :param include_input_conf: whether to generate the input.conf with UCC builder
        :ret : True if generate any resource, False if no resource is genrerated.
        '''
        ucc_meta = self._global_setting_meta.get_ucc_meta(global_setting_meta)
        if not ucc_meta:
            self._logger.warning(
                'UCC meta is None. No need to generate the UCC resources.')
            return False
        # put input page to the meta
        stash_dir = self._get_stash_dir()
        try:
            self._logger.info(
                'Generate ta configuration resources to stash dir %s',
                stash_dir)
            self._generate_ucc_asset(stash_dir, ucc_meta, global_setting_meta)
            self._generate_ui(stash_dir)
            # TODO: merge all the stash dir to the TA directory,
            # should merge the confs
            lambdas = {}
            if not include_input_conf:
                lambdas = {
                    self.INPUT_CONF_PATTERN:
                    file_content_util.FILE_LAMBDAS['no_op'],
                    self.INPUT_CONF_SPEC_PATTERN:
                    file_content_util.FILE_LAMBDAS['no_op'],
                    self.REQUIREMENTS_PATTERN:
                    file_content_util.FILE_LAMBDAS['no_op'],
                    self.PY_DECLARE_PATTERN:
                    file_content_util.FILE_LAMBDAS['no_op']
                }
            file_content_util.transform_files(
                stash_dir, self._current_app_dir, lambdas=lambdas)
            self._static_asset_gen.generate_import_declare_if_not_exist()
            self._static_asset_gen.generate_python_libs_if_not_exist()
        except Exception as e:
            self._logger.error('fail to generate the ucc assets. %s',
                               traceback.format_exc())
            raise e
        finally:
            self._logger.debug('Clean up the stash dir:%s', stash_dir)
            shutil.rmtree(stash_dir)
        # update the theme color according to the basic meta
        self._static_asset_gen.generate_nav_xml(self._basic_meta.meta, True)
        if reload_app:
            common_util.reload_splunk_apps(self._service_with_tab_context)
            # use the reload app endpoint to reload the rest endpoint
            common_util.reload_local_app(self._service_with_tab_context,
                                         self._appname)
            self._logger.info('Reload the apps when generate UCC stuff.')
        else:
            self._logger.info('Skip reload the apps when generate UCC stuff.')
        return True

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def on_rename_add_on(self, old_app_name):
        # rename the UCC conf files to the new conf file
        self.regenerate_ucc_resources()  # app is reload here
        local_dir = os.path.join(self._current_app_dir, 'local')
        old_account_conf = os.path.join(
            local_dir,
            global_setting_util.get_global_account_conf_file_name(
                old_app_name))
        old_settings_conf = os.path.join(
            local_dir,
            global_setting_util.get_global_settings_conf_file_name(
                old_app_name))
        new_settings_conf = os.path.join(
            local_dir,
            global_setting_util.get_global_settings_conf_file_name(
                self._appname))
        new_account_conf = os.path.join(
            local_dir,
            global_setting_util.get_global_account_conf_file_name(
                self._appname))
        conf_file_map = {
            old_settings_conf: new_settings_conf,
            old_account_conf: new_account_conf
        }
        for src, dst in list(conf_file_map.items()):
            if os.path.isfile(src):
                self._logger.info('move con file from %s to %s', src, dst)
                shutil.move(src, dst)

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def upgrade_from_2_0_0_to_2_1_0(self, input_upgraded):
        global_settings = self.get_global_settings()
        if global_settings:
            self.ta_setup_clean(self._appname, self._current_app_dir)

        if input_upgraded and not global_settings:
            # if no global settings, but found inputs are upgraded.
            # at least, need a log level part to generate UCC
            global_settings = {
                'log_settings': {
                    'log_level': 'INFO',
                }
            }

        if not global_settings:
            return False

        CREDENTIAL_SETTING_KEY = ta_configuration_meta.GlobalSettingMeta.CREDENTIAL_SETTING_KEY
        CUSTOMIZED_SETTING_KEY = ta_configuration_meta.GlobalSettingMeta.CUSTOMIZED_SETTING_KEY
        if CREDENTIAL_SETTING_KEY in global_settings:
            credentials = global_settings.get(CREDENTIAL_SETTING_KEY, {})
            if isinstance(credentials, dict):
                global_settings[CREDENTIAL_SETTING_KEY] = [{
                    'username':
                    key,
                    'password':
                    value.get('password')
                } for key, value in list(credentials.items())]
        if CUSTOMIZED_SETTING_KEY in global_settings:
            customized_settings = global_settings.get(CUSTOMIZED_SETTING_KEY,
                                                      [])
            for variable in customized_settings:
                variable.update({'type': variable.get('format_type')})
                if 'value' not in variable:
                    if variable['type'] == 'checkbox':
                        variable['value'] = variable.get('default_value', 0)
                    else:
                        variable['value'] = variable.get('default_value', '')

        self._logger.info(
            'regenerate the UCC resource during upgrading. meta:%s',
            logger.hide_sensitive_field(global_settings))
        # should update the meta before calling upgrade global settings
        # in update global settings, the meta will be validated
        self._global_setting_meta.meta = global_settings
        latest_tab_version, latest_tab_build = upgrade_util.get_latest_tabuilder_version(
            self._service_with_tab_context)
        if latest_tab_version == '2.1.0':
            # only regenerate ucc resources when current installation is 2.1.0
            self.update_global_settings(global_settings)
        return True

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def upgrade_from_2_1_1_to_2_1_2(self):
        # regenerate the ucc resources, the global_checkbox_param json is added in 2.1.2
        # see details in TAB-2512
        if not self._global_setting_meta.meta:
            return
        latest_tab_version, latest_tab_build = upgrade_util.get_latest_tabuilder_version(
            self._service_with_tab_context)
        if latest_tab_version == '2.1.2':
            # only regenerate the ucc resources when currenc installation is 2.1.2
            self.generate_ta_configuration_resources(self.get_global_settings(),
                                                 False, False)

    @metric_util.function_run_time(tags=['ta_configuration_builder'])
    def upgrade_from_2_1_2_to_2_2_0(self):
        if not self._global_setting_meta.meta:
            # if no global meta, no need to upgrade
            return
        # before 2.2.0, the ucc view xmls are generated to local/data/ui and local/data/nav
        # in 2.2.0, these xmls are generated to default folder. Should move the local xml to default
        local_dir = os.path.join(self._current_app_dir, 'local', 'data', 'ui')
        default_dir = os.path.join(self._current_app_dir, 'default', 'data', 'ui')
        xml_dirs = ['views', 'nav']
        local_xml_dir = [os.path.join(local_dir, d) for d in xml_dirs]
        if any([os.path.isdir(d) for d in local_xml_dir]):
            if not os.path.isdir(default_dir):
                os.makedirs(default_dir)
            for d in [os.path.join(default_dir, i) for i in xml_dirs]:
                if os.path.isdir(d):
                    dir_name = '<SPLUNK_HOME>/etc/apps/' + self._appname + '/default/data/ui/' + os.path.basename(d)
                    raise builder_exception.CommonException(
                        e_message='Directory ' + dir_name +
                        ' exists in add-on. Fail to upgrade TA ' +
                        self._appname,
                        err_code=78,
                        options={'dir': dir_name})
            for d in local_xml_dir:
                if os.path.isdir(d):
                    shutil.move(d, default_dir)
                    self._logger.info('update TA %s, move folder %s to %s.',
                                      self._appname, d, default_dir)

        # should remove the locale folder. It is generated by AoB 2.1.x
        locale_dir = os.path.join(self._current_app_dir, 'locale')
        if os.path.isdir(locale_dir):
            shutil.rmtree(locale_dir)

        latest_tab_version, latest_tab_build = upgrade_util.get_latest_tabuilder_version(
            self._service_with_tab_context)
        if latest_tab_version == '2.2.0':
            # should regen the ucc assets, in order to fix the license issue
            # only regenerate this when current installation is 2.2.0
            self.regenerate_ucc_resources()
            self._logger.debug('regenerate the UCC assets successfully.')

    @classmethod
    def ta_setup_clean(cls, appname, current_ta_dir):
        app_namespace = appname.lower().strip().replace('-', '_')
        target_files = []
        cls._add_file_to_delete(target_files,
                                os.path.join(current_ta_dir, "default", "data",
                                             "ui", "views", "setup_page.xml"))
        cls._add_file_to_delete(target_files,
                                os.path.join(current_ta_dir, "appserver",
                                             "static", "setup.css"))
        cls._add_file_to_delete(target_files,
                                os.path.join(current_ta_dir, "appserver",
                                             "static", "setup.js"))
        cls._add_file_to_delete(
            target_files,
            os.path.join(current_ta_dir, "bin",
                         "{}_consts.py".format(app_namespace)))
        cls._add_file_to_delete(
            target_files,
            os.path.join(current_ta_dir, "bin",
                         "{}_setup.py".format(app_namespace)))
        cls._add_file_to_delete(
            target_files,
            os.path.join(current_ta_dir, "bin",
                         "{}_setup_util.py".format(app_namespace)))
        cls._add_file_to_delete(target_files,
                                os.path.join(current_ta_dir, "local",
                                             "restmap.conf"))
        cls._add_file_to_delete(target_files,
                                os.path.join(current_ta_dir, "local",
                                             "web.conf"))
        declare_py = common_util.get_python_declare_file_name(appname)
        bin_folder = os.path.join(current_ta_dir, "bin")
        should_remove_declare = True
        if os.path.exists(bin_folder):
            for child in os.listdir(bin_folder):
                if child.endswith(
                        '.py'
                ) and child != declare_py and child != "{}_consts.py".format(
                        app_namespace) and child != "{}_setup.py".format(
                            app_namespace
                        ) and child != "{}_setup_util.py".format(app_namespace):
                    should_remove_declare = False
                    break
        if should_remove_declare:
            cls._add_file_to_delete(target_files,
                                    os.path.join(current_ta_dir, "bin",
                                                 declare_py))

        for tfile in target_files:
            if os.path.exists(tfile):
                os.remove(tfile)

    @classmethod
    def _add_file_to_delete(cls, file_list, file_name):
        file_list.append(file_name)
        if file_name.endswith('.py'):
            file_list.append(file_name + 'c')
            file_list.append(file_name + 'o')


class CustomGlobalConfigBuilderSchema(GlobalConfigBuilderSchema):

    def _builder_settings(self):
        for setting in self._settings:
            self._builder_entity(
                setting['name'],
                setting['entity'],
                'settings',
                CustomMultipleModelEndpointBuilder,
                CustomMultipleModelEntityBuilder,
            )

    def _parse_field(self, content):
        field = RestField(
            content['field'],
            required=is_true(content.get('required')),
            encrypted=is_true(content.get('encrypted')),
            default=content.get('defaultValue'),
        )
        return CustomRestFieldBuilder(
            field,
            self._parse_validation(content.get('validators')),
        )


class CustomRestFieldBuilder(RestFieldBuilder):

    def generate_conf(self):
        if self._field.default and not self._field.encrypted:
            default_value = self._field.default
        else:
            default_value = ''

        return self._kv_template.format(
            name=self._field.name,
            value=default_value,
        )


class CustomMultipleModelEndpointBuilder(MultipleModelEndpointBuilder):

    def generate_default_conf(self):
        specs = [entity.generate_conf_file() for entity in self._entities]
        return '\n\n'.join(specs)


class CustomMultipleModelEntityBuilder(MultipleModelEntityBuilder):

    def generate_conf_file(self, omit_kv_pairs = False):
        title = self._title_template.format(self.name_spec)
        if omit_kv_pairs:
            return title
        lines = [field.generate_conf() for field in self._fields]
        lines.insert(0, title)
        return '\n'.join(lines)
