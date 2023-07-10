from builtins import str
from builtins import object
import copy
import importlib
import inspect
import os
import re
import shutil
import sys
import traceback

from mako.template import Template

from ta_generator import builder_util
from ta_generator import ta_static_asset_generator
from ta_generator import builder_ta_configuration
from ta_generator.builder_ta_sourcetype import TASourcetypeBuilder
from ta_generator.builder_util import escape_character
from aob.aob_common.metric_collector import metric_util
from ta_generator.modinput_runner import runner
from ta_generator.input_meta_util import TAInputMetaMgr
from ta_generator.builder_cloud_connect_data_input import CloudConnectDataInputBuilder
from aob.aob_common import logger, conf_parser
from tabuilder_utility import common_util, data_input_util, search_util
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.tab_conf_manager import TabConfMgr

import time
from aob.aob_common.metric_collector import monitor
m = monitor.Monitor()

class TAInputBuilder(object):
    @metric_util.function_run_time(tags=['datainput_builder'])
    def __init__(self,
                 appname,
                 uri,
                 session_key,
                 service_with_tab_context=None,
                 service_with_ta_context=None):
        self.__appname = appname
        self.__app_namespace = common_util.get_python_lib_dir_name(
            self.__appname)
        self.__logger = logger.get_input_builder_logger()
        self.__parent_dir = os.path.split(os.path.realpath(__file__))[0]
        self.__resource_dir = os.path.join(self.__parent_dir, "resources")
        self.__resource_lib_dir = os.path.join(self.__parent_dir,
                                               "resources_lib")
        self.__splunk_home = os.environ['SPLUNK_HOME']
        self.__splunk_app_dir = os.path.join(self.__splunk_home, "etc", "apps")
        self.__current_ta_dir = os.path.join(self.__splunk_app_dir,
                                             self.__appname)
        self.__asset_generator = ta_static_asset_generator.AssetGenerator(
            self.__resource_dir,
            self.__current_ta_dir,
            self.__resource_lib_dir,
            app_name=self.__appname)
        self.__uri = uri
        self.__session_key = session_key

        if service_with_ta_context:
            self.__service_with_ta_context = service_with_ta_context
        else:
            self.__service_with_ta_context = common_util.create_splunk_service(
                session_key, uri, self.__appname)
            self.__logger.info('Create splunk service with args: %s, %s',
                               session_key, uri)

        self.__conf_mgr = common_util.create_conf_mgr(
            self.__session_key, self.__uri, app=self.__appname)
        self.__conf_mgr_with_tab_context = common_util.create_conf_mgr(
            self.__session_key, self.__uri)

        if not service_with_tab_context:
            service_with_tab_context = common_util.create_splunk_service(
                session_key, uri)
        self.__service_with_tab_context = service_with_tab_context
        self.required_meta_keys = ['name', 'type', 'sourcetype']
        self.__global_vars = None

        self.__input_meta_mgr = TAInputMetaMgr(appname, uri, session_key,
                                               self.__service_with_tab_context)

        self._ta_configuration_builder = builder_ta_configuration.TAConfigurationBuilder(
            self.__appname, self.__service_with_tab_context, self.__service_with_ta_context)

    def set_alert_builder(self, builder):
        self.__input_meta_mgr.set_alert_builder(builder)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def validate_input_name_and_sourcetype(self, meta):
        self.__input_meta_mgr.validate_input_name_and_sourcetype(meta)

    def _update_global_var_list(self):
        # TODO: should get the ta_configuration builder to get the global var values
        self.__global_vars = None
        if not self.__global_vars:
            self.__global_vars = ['userdefined_global_var']

    @metric_util.function_run_time(tags=['datainput_builder'])
    def refresh_input_conf_file(self):
        datainputs = self.get_all_TA_inputs()
        filtered_datainputs, input_kinds = self.__input_meta_mgr.get_datainputs_and_kinds_for_conf(
            datainputs)
        self._generate_inputs_conf(filtered_datainputs, input_kinds)
        common_util.reload_local_app(self.__service_with_tab_context,
                                     self.__appname)

    def _generate_inputs_conf(self, datainputs, input_kinds):
        targetfile = os.path.join(
            builder_util.get_target_folder(self.__current_ta_dir, "local"),
            "inputs.conf")
        backup_conf = os.path.join(builder_util.get_target_folder(self.__current_ta_dir, "local"),
        "inputs.conf.bak")

        new_inputs_conf_content = None
        try:
            if os.path.isfile(backup_conf):
                os.remove(backup_conf)
            if os.path.isfile(targetfile):
                os.rename(targetfile, backup_conf)
            filename = os.path.join(self.__resource_dir, "local",
                                    "inputs.conf.template")
            temp = Template(filename=filename)
            new_inputs_conf_content = temp.render(datainputs=datainputs)
            with open(targetfile, "w+") as write_file:
                write_file.write(new_inputs_conf_content.strip())
            inputs_conf_parser = conf_parser.TABConfigParser()
            inputs_conf_parser.read(targetfile)
            bak_conf_parser = conf_parser.TABConfigParser()
            bak_conf_parser.read(backup_conf)
            for stanza, props in list(bak_conf_parser.item_dict().items()):
                stanza_parts = stanza.split('://')
                if len(stanza_parts) == 2 and stanza_parts[0] in input_kinds:
                    inputs_conf_parser.add_section(stanza)
                    for k, v in list(props.items()):
                        inputs_conf_parser.set(stanza, k, v)
            with open(targetfile, 'w') as conf_fp:
                inputs_conf_parser.write(conf_fp)
            # clean up inputs.conf.bak
            if os.path.isfile(backup_conf):
                os.remove(backup_conf)
        except Exception as e:
            self.__logger.error('Fail to generate inputs.conf. The new inputs.conf content:%s, %s', new_inputs_conf_content, traceback.format_exc())
            # revert the conf
            if os.path.isfile(backup_conf):
                if os.path.isfile(targetfile):
                    os.remove(targetfile)
                os.rename(backup_conf, targetfile)
            raise e

    def _generate_inputs_conf_spec(self, datainputs):
        filename = os.path.join(self.__resource_dir, "README",
                                "inputs.conf.spec.template")
        temp = Template(filename=filename)
        tran = temp.render(datainputs=datainputs)
        targetfile = os.path.join(
            builder_util.get_target_folder(self.__current_ta_dir, "README"),
            "inputs.conf.spec")
        with open(targetfile, "w+") as write_file:
            write_file.write(tran.strip())

    def _create_sourcetype_stanzas(self, datainput):
        sourcetype = datainput.get('sourcetype', None)
        if sourcetype is None:
            e = CommonException()
            e.set_err_code(3116)
            e.set_option('name', datainput.get('name'))
            raise e

        st_builder = TASourcetypeBuilder(self.__appname, self.__uri,
                                         self.__session_key)
        if sourcetype in st_builder.get_all_sourcetype_names():
            e = CommonException()
            e.set_err_code(3010)
            e.set_option('sourcetype', sourcetype)
            raise e

        try:
            # should write the props.conf directly, ta may not be loaded yet.
            st_builder.create_sourcetype(sourcetype, {
                "SHOULD_LINEMERGE": "0",
                "pulldown_type": "1",
                "category": "Splunk App Add-on Builder"
            })
        except Exception as e:
            self.__logger.error(
                'get error when creating sourcetype stanza. %s',
                traceback.format_exc())
            ce = CommonException()
            ce.set_err_code(3117)
            ce.set_option('name', datainput.get('name', ''))
            ce.set_option('msg', '{}'.format(e))
            ce.set_option('sourcetype', sourcetype)
            raise ce

    """
    py file related
    """

    def _get_py_template(self):
        return os.path.join(self.__resource_dir, "bin", "input.py.template")

    def _get_module_py_template(self, datainput):
        input_type = datainput.get('type')
        if input_type == data_input_util.INPUT_METHOD_CUSTOMIZED:
            return os.path.join(self.__resource_dir, "bin",
                                "input_module.py.template")
        elif input_type == data_input_util.INPUT_METHOD_REST:
            return os.path.join(self.__resource_dir, "bin",
                                "rest_input_module.py.template")
        elif input_type == data_input_util.INPUT_METHOD_CMD:
            return os.path.join(self.__resource_dir, "bin",
                                "cmd_input_module.py.template")
        else:
            raise Exception('unknown data input type.')

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_input_module_file_name(self, file_suffix):
        escaped = escape_character(file_suffix)
        return "input_module_" + escaped

    @metric_util.function_run_time(tags=['datainput_builder'])
    def generate_python_modinput_content(self, datainput):
        input_meta = copy.deepcopy(datainput)
        input_var_names = [
            opt['name'] for opt in input_meta.get('data_inputs_options', [])
            if not opt.get('name', '').startswith('_')
        ]
        if not input_var_names:
            # update the data_inputs_options for rest/cmd modular inputs
            input_type = input_meta.get('type')
            if input_type == data_input_util.INPUT_METHOD_REST or input_type == data_input_util.INPUT_METHOD_CMD:
                opts = input_meta.get('data_inputs_options', [])
                opts.append(TAInputMetaMgr.PLACEHOLDER_VAR)
                input_meta['data_inputs_options'] = opts
            else:
                raise ValueError(
                    'ModInput should have at least one customized variable.')
        filename = self._get_py_template()
        declare_py = common_util.get_python_declare_file_name(self.__appname)
        temp = Template(filename=filename)
        content = temp.render(
            python_declare=declare_py[:-3],
            app_name=self.__appname,
            app_namespace=self.__app_namespace,
            datainput=input_meta,
            module_name=self.get_input_module_file_name(input_meta['name']))
        return content

    @metric_util.function_run_time(tags=['datainput_builder'])
    def generate_input_module_content(self, datainput):
        input_var_names = [
            opt['name'] for opt in datainput.get('data_inputs_options', [])
        ]
        if not input_var_names:
            input_var_names = ['modinput_var_name']
        global_vars = []
        if 'global_settings' in datainput:
            global_var_metas = datainput.get('global_settings', {}).get(
                'customized_settings', [])
            global_vars = [m['name'] for m in global_var_metas]
        if not global_vars:
            self._update_global_var_list()
            global_vars = self.__global_vars

        temp_file = self._get_module_py_template(datainput)
        temp = Template(filename=temp_file)
        self.__logger.debug(
            "Generate the input module: modinput_vars:%s, global_vars:%s, input_meta:%s",
            input_var_names, self.__global_vars, logger.hide_sensitive_field(datainput))
        content = temp.render(
            appname=self.__appname,
            app_namespace=self.__app_namespace,
            datainput=datainput,
            global_vars=global_vars,
            modinput_vars=input_var_names)
        return content

    def _create_input_py(self, datainput, overwrite=False, global_settings_meta=None):
        '''
        @param: overwrite -- whether to overwrite the modinput python file
                            with the code from meta data.
        '''
        datainput_name = datainput['name']
        # create the mod input py file
        self._create_modular_input_py(datainput, global_settings_meta)
        self._create_input_module_py(datainput)

        if overwrite and 'code' in datainput:
            targetfile = os.path.join(
                builder_util.get_target_folder(self.__current_ta_dir, "bin"),
                "{}.py".format(
                    self.get_input_module_file_name(datainput_name)))
            with open(targetfile, 'w') as f:
                f.write(datainput['code'])
            self.__logger.info(
                'Overwrite modular input file %s with code in meta.',
                targetfile)

        if 'code' in datainput:
            # do not put the code in meta any more!
            # the code logic is in the file
            # then, use can use IDE to edit the pyfile directly
            del datainput['code']

    def _create_modular_input_py(self, datainput, global_settings_meta=None):
        '''
        create input_name.py
        '''
        bin_folder = builder_util.get_target_folder(self.__current_ta_dir, "bin")
        if datainput.get('type') == data_input_util.INPUT_METHOD_REST:
            cc_input_builder = CloudConnectDataInputBuilder(datainput, global_settings_meta or {})
            cc_input_builder.save_cc_input(self.__resource_dir, bin_folder)
        else:
            datainput_name = datainput['name']
            tran = self.generate_python_modinput_content(datainput)
            targetfile = os.path.join(
                bin_folder,
                "{}.py".format(datainput_name))
            with open(targetfile, "w+") as write_file:
                write_file.write(tran)

    def _create_input_module_py(self, datainput):
        '''
        create customized_input_module.py or cmd_input_module.py
        For rest, cc data input is special
        '''
        input_type = datainput['type']
        if input_type == data_input_util.INPUT_METHOD_REST:
            return

        datainput_name = datainput['name']
        targetfile = os.path.join(
            builder_util.get_target_folder(self.__current_ta_dir, "bin"),
            "{}.py".format(self.get_input_module_file_name(datainput_name)))
        if input_type == data_input_util.INPUT_METHOD_CUSTOMIZED and os.path.isfile(
                    targetfile):
            self.__logger.info(
                "customized modular input module %s exists. Do not regen the python file anymore.",
                targetfile)
        else:
            tran = self.generate_input_module_content(datainput)
            with open(targetfile, "w+") as write_file:
                write_file.write(tran)

    def _update_input_py(self, datainput_old, datainput_new, global_settings_meta=None):
        '''
        update the datainput. Currently, the old input and new input
        should be of the same type. But the input name will be changed.
        '''
        input_type = datainput_new['type']
        datainput_name_new = datainput_new['name']
        datainput_name_old = datainput_old['name']
        bin_folder = builder_util.get_target_folder(self.__current_ta_dir,
                                                    "bin")

        if input_type in [
                data_input_util.INPUT_METHOD_CUSTOMIZED, data_input_util.INPUT_METHOD_REST,
                data_input_util.INPUT_METHOD_CMD
        ]:
            # just remove the old one, generate new input py file
            self._create_input_py(datainput_new, overwrite=True, global_settings_meta=global_settings_meta)
        else:
            raise Exception('unknown data input type.')

        # remove the old modinput in the end. After we finish all the job
        # both name.py and module.py should exist for all input types
        # TODO: maybe we should think about how to make the update action as atomic
        if datainput_name_new != datainput_name_old:
            if input_type == data_input_util.INPUT_METHOD_REST:
                # cc data input is special, should remove the json and py
                cc_input_builder = CloudConnectDataInputBuilder(datainput_old, global_settings_meta)
                cc_input_builder.delete_cc_input(bin_folder)
            else:
                targetfile_old = os.path.join(bin_folder,
                                              "{}.py".format(datainput_name_old))
                if os.path.isfile(targetfile_old):
                    os.remove(targetfile_old)
                else:
                    self.__logger.error(
                        "Can not find the old modular input python file:%s",
                        targetfile_old)
                targetfile_old = os.path.join(bin_folder, "{}.py".format(
                    self.get_input_module_file_name(datainput_name_old)))
                if os.path.isfile(targetfile_old):
                    os.remove(targetfile_old)
                else:
                    self.__logger.error(
                        "Can not find the old modular input python file: %s",
                        targetfile_old)

    def _delete_input_py(self, datainput):
        datainput_name = datainput['name']
        bin_folder = builder_util.get_target_folder(self.__current_ta_dir,
                                                    "bin")
        file_names = [
            escape_character(datainput_name),
            self.get_input_module_file_name(datainput_name)
        ]
        file_paths = [
            os.path.join(bin_folder, '{}.py'.format(f)) for f in file_names
        ]
        for targetfile in file_paths:
            if os.path.exists(targetfile):
                os.remove(targetfile)
            else:
                self.__logger.error("mod input module file not found: %s",
                                    targetfile)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_all_TA_inputs(self):
        return self.__input_meta_mgr.get_all_TA_inputs()

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_inputs_by_sourcetype(self, sourcetype_list):
        if not isinstance(sourcetype_list, list):
            sourcetype_list = [sourcetype_list]
        input_names = {}
        for s in sourcetype_list:
            input_names[s] = list()
        datainputs = self.get_all_TA_inputs()
        for dinput in datainputs:
            sourcetype = dinput.get('sourcetype', None)
            name = dinput.get('name', None)
            if sourcetype and name and (sourcetype in sourcetype_list):
                input_names[sourcetype].append(name)
        return input_names

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_customized_data_input_code(self, datainputs):
        codes = {}
        for datainput in datainputs:
            if datainput.get('type') == data_input_util.INPUT_METHOD_CUSTOMIZED:
                codes[datainput['name']] = self._get_data_input_code(datainput)
        return codes

    def _get_data_input_code(self, datainput):
        targetfile = os.path.join(
            builder_util.get_target_folder(self.__current_ta_dir, "bin"),
            "{}.py".format(self.get_input_module_file_name(datainput['name'])))
        if os.path.isfile(targetfile):
            with open(targetfile, 'r') as tf:
                return tf.read()
        else:
            return self.generate_input_module_content(datainput)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def fetch_input_code(self, datainput):
        '''
        this function tries to get the input python code based on input meta.
        The data input may not be created yet. will generate python file content
        '''
        data_input_meta = self.__input_meta_mgr.add_default_values(
            builder_util.add_unique_identification(datainput))
        try:
            # when testing the code, the input may not be saved yet.
            self.__asset_generator.generate_python_libs_if_not_exist()
            self.__asset_generator.generate_import_declare_if_not_exist()

            data_input_meta['code'] = self._get_data_input_code(
                data_input_meta)
            return data_input_meta
        except Exception:
            self.__logger.error("Fail to get the code. datainput:%s",
                                logger.hide_sensitive_field(data_input_meta))
            ce = CommonException()
            ce.set_err_code(3129)
            ce.set_option('input_name', data_input_meta['name'])
            raise ce

    @metric_util.function_run_time(tags=['datainput_builder'])
    def create_TA_input(self, datainput, reload_input):
        if not os.path.isdir(self.__current_ta_dir):
            e = CommonException()
            e.set_err_code(3118)
            e.set_option('name', datainput.get('name', ''))
            raise e

        global_settings = datainput.get(TAInputMetaMgr.GLOBAL_SETTING_KEY)
        if TAInputMetaMgr.GLOBAL_SETTING_KEY in datainput:
            del datainput[TAInputMetaMgr.GLOBAL_SETTING_KEY]

        datainputs, data_input_meta = self.__input_meta_mgr.create_input_meta(
            datainput)
        filtered_datainputs, input_kinds = self.__input_meta_mgr.get_datainputs_and_kinds_for_conf(
            datainputs)

        # always refresh the declare py
        self.__asset_generator.generate_import_declare()
        # only generate the libs if there is no such a dir
        self.__asset_generator.generate_python_libs_if_not_exist()

        self._create_input_py(data_input_meta, overwrite=True, global_settings_meta=global_settings)
        self._generate_inputs_conf(filtered_datainputs, input_kinds)
        self._generate_inputs_conf_spec(filtered_datainputs)

        # detect the single instance mode after py file is updated
        # have to save the meta again
        mode_changed = False
        for _input in datainputs:
            if _input['uuid'] == data_input_meta['uuid']:
                old_mode = _input.get('is_single_instance', False)
                self.detect_single_instance_mode(_input)
                mode_changed = old_mode != _input.get('is_single_instance', False)
                break
        if mode_changed:
            self.__logger.info('Set single instance mode when create input %s', data_input_meta['name'])
            self.__input_meta_mgr.set_meta(datainputs)

        # write global setting meta and ucc configuration content together
        # at frontend, when creating or updating an input, no need to save global settings in a seperate step
        ucc_resource_generated = self._ta_configuration_builder.update_global_settings(global_settings, reload_app=reload_input)
        # common_util.reload_local_app(self.__service_with_tab_context, self.__appname)
        # regenerate_ucc_resources will reload the app resources, no need to reload here

        self._create_sourcetype_stanzas(data_input_meta)

        if datainputs and len(datainputs) == 1:
            # create the modinput log stanzas
            # only create the stanza once, calling the conf rest costs time
            log_source = data_input_util.get_input_log_source_stanza(self.__appname)
            cce_log_source = data_input_util.get_cce_log_source_stanza(self.__appname)
            stanza = {"SHOULD_LINEMERGE": "true", "sourcetype": self.get_input_log_sourcetype()}
            conf_mgr = TabConfMgr(self.__uri, self.__session_key, self.__appname, self.__service_with_tab_context)
            conf_mgr.update_conf_stanza('props', log_source, {}, stanza)
            conf_mgr.update_conf_stanza('props', cce_log_source, {}, stanza)
            self.__logger.debug("create the input log props stanza in app " + self.__appname)

        return datainputs, data_input_meta, ucc_resource_generated

    def get_input_log_sourcetype(self):
        '''
        according to the DES best practice, '-' is used as the seperator of vendor and technology
        and only ':' is the valid seperator in sourcetype
        '''
        prefix = re.sub(r'\\-+', ':', self.__appname.lower())
        return re.sub(r"[^\\:\da-zA-Z]+", "", prefix) + ":log"

    @metric_util.function_run_time(tags=['datainput_builder'])
    def delete_TA_input(self, datainput):
        if not os.path.isdir(self.__current_ta_dir):
            raise Exception("{} does not exist".format(self.__appname))

        ucc_resource_generated = False
        global_conf_deleted = False
        try:
            # should remove all the ucc related files here
            # because later, there might be no mod inputs. So, no ucc files
            self._ta_configuration_builder.delete_ta_configuration_resources()

            datainputs = self.__input_meta_mgr.delete_input_meta(datainput)
            filtered_datainputs, input_kinds = self.__input_meta_mgr.get_datainputs_and_kinds_for_conf(
                datainputs)

            self._delete_input_py(datainput)
            self._generate_inputs_conf(filtered_datainputs, input_kinds)
            self._generate_inputs_conf_spec(filtered_datainputs)
            if not datainputs and not self.__input_meta_mgr.get_alert_names():
                # if no inputs and alerts, delete the global settings
                self._ta_configuration_builder.delete_global_settings()
                global_conf_deleted = True
            # clean up bin folder
            self.__asset_generator.cleanup_ta_bin_folder()
        finally:
            # this must be done after the inputs meta is stored
            if not global_conf_deleted:
                # no need to reload app, reload happens when enable_ucc_page_in_app_conf
                ucc_resource_generated = self._ta_configuration_builder.regenerate_ucc_resources(reload_app=False)
            # common_util.reload_local_app(self.__service_with_tab_context, self.__appname)
            # regenerate_ucc_resources will reload app resouces, no need to reload here
        if not datainputs:
            # no data input any more
            conf_mgr = TabConfMgr(self.__uri, self.__session_key, self.__appname, self.__service_with_tab_context)
            try:
                conf_mgr.delete_conf_stanza('props', data_input_util.get_input_log_source_stanza(self.__appname))
                conf_mgr.delete_conf_stanza('props', data_input_util.get_cce_log_source_stanza(self.__appname))
                self.__logger.debug("Delete the input log props stanzas in app " + self.__appname)
            except Exception as e:
                self.__logger.error("Fail to delete log props stanzas in app " + self.__appname + ". " + str(e))

        return datainputs, ucc_resource_generated

    def detect_single_instance_mode(self, datainput):
        # detect the single instance mode
        if data_input_util.INPUT_METHOD_CUSTOMIZED == datainput.get('type'):
            datainput['is_single_instance'] = data_input_util.detect_MI_single_instance_mode(os.path.join(self.__current_ta_dir, 'bin'), common_util.get_python_declare_file_name(self.__appname)[:-3], self.get_input_module_file_name(datainput['name']))
            self.__logger.debug('Detect the single instance mode. input:%s, value:%s', datainput['name'], datainput['is_single_instance'])
        return datainput

    @metric_util.function_run_time(tags=['datainput_builder'])
    def _on_rename_input(self, old_input_meta, new_input_meta):
        old_name = old_input_meta['name']
        new_name = new_input_meta['name']
        parser = conf_parser.TABConfigParser()
        input_conf = os.path.join(
            builder_util.get_target_folder(self.__current_ta_dir, "local"),
            "inputs.conf")
        parser.read(input_conf)
        for section in parser.sections():
            stanza_names = section.split('://')
            if len(stanza_names) == 2 and stanza_names[0].strip() == old_name:
                # copy all the old stanzas into the new name stanzas
                new_section = new_name + '://' + stanza_names[1]
                parser.add_section(new_section)
                for item in parser.items(section):
                    parser.set(new_section, item[0], item[1])
        with open(input_conf, 'w') as fp:
            parser.write(fp)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def update_TA_input(self, datainput_new, reload_input):
        if not os.path.isdir(self.__current_ta_dir):
            raise Exception("{} does not exist".format(self.__appname))

        global_settings = datainput_new.get(TAInputMetaMgr.GLOBAL_SETTING_KEY)
        if TAInputMetaMgr.GLOBAL_SETTING_KEY in datainput_new:
            del datainput_new[TAInputMetaMgr.GLOBAL_SETTING_KEY]

        datainputs, datainput_old, data_input_meta_new = self.__input_meta_mgr.update_input_meta(
            datainput_new)
        filtered_datainputs, input_kinds = self.__input_meta_mgr.get_datainputs_and_kinds_for_conf(
            datainputs)

        if datainput_old['name'] != data_input_meta_new['name']:
            self._on_rename_input(datainput_old, data_input_meta_new)

        self._update_input_py(datainput_old, data_input_meta_new, global_settings_meta=global_settings)
        self._generate_inputs_conf(filtered_datainputs, input_kinds)
        self._generate_inputs_conf_spec(filtered_datainputs)

        # detect the single instance mode after py file is updated
        # have to save the meta again
        mode_changed = False
        for _input in datainputs:
            if _input['uuid'] == data_input_meta_new['uuid']:
                old_mode = _input.get('is_single_instance', False)
                self.detect_single_instance_mode(_input)
                mode_changed = old_mode != _input.get('is_single_instance', False)
                break
        if mode_changed:
            self.__logger.info('Set single instance mode when update input %s', data_input_meta_new['name'])
            self.__input_meta_mgr.set_meta(datainputs)

        # this must be done after the inputs meta is stored
        # write global setting meta and ucc configuration content together
        # at frontend, when creating or updating an input, no need to save global settings in a seperate step
        ucc_resource_generated = self._ta_configuration_builder.update_global_settings(global_settings, reload_app=reload_input)
        # common_util.reload_local_app(self.__service_with_tab_context, self.__appname)
        # regenerate_ucc_resources will reload the app resources, no need to reload here
        return datainputs, ucc_resource_generated

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_input_summary(self):
        return self.__input_meta_mgr.get_input_summary()

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_input_loaded_status(self):
        '''
        return a dict. the key is the input name, value is whether the input is loaded
        '''
        return self.__input_meta_mgr.get_input_loaded_status()

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_basic_info(self):
        return self.__input_meta_mgr.get_basic_info()

    def get_dry_run_job_id(self, datainput):
        test_id = builder_util.generate_code_test_id()
        datainput['test_id'] = test_id
        return datainput

    @metric_util.function_run_time(tags=['datainput_builder'])
    def dryrun_modinput_code(self, datainput):
        '''
        The dryrun returns the following structure as the results

        {
            'status': 'success/fail',
            // a list of results, each result is a python dict
            'results': [event1, event2, event3],
            error: 'error messages'
        }
        '''
        # TODO: dryrun is sync call now. If the modinput is long running,
        # should make it as async
        dryrun_result = None
        datainput = self.__input_meta_mgr.add_default_values(datainput)
        self.__input_meta_mgr.validate_new_meta(datainput, 'uuid' in datainput)
        # if it is cc data input, should process the meta
        if datainput.get('type') == data_input_util.INPUT_METHOD_REST:
            datainput = data_input_util.process_cc_data_input_meta(datainput)
        if 'test_id' not in datainput:
            ce = CommonException(
                e_message='dry run job id not found.',
                err_code=3142,
                options={'input_name': datainput['name']})
            raise ce

        datainput['server_uri'] = self.__uri
        datainput['session_key'] = self.__session_key
        datainput['checkpoint_dir'] = common_util.make_splunk_path([
            'var', 'lib', 'splunk', 'modinputs', datainput['name'],
            'test_' + datainput['name']
        ])
        test_id = datainput['test_id']

        bin_dir = builder_util.get_target_folder(self.__current_ta_dir, "bin")
        cc_input_builder = None
        if datainput.get('type') == data_input_util.INPUT_METHOD_REST:
            cc_input_builder = CloudConnectDataInputBuilder(datainput, datainput.get('global_settings', {}))
            datainput['cc_json_file'] = cc_input_builder.get_cc_json_file_path(
                bin_dir, True)
        # generate {mod input}.py
        if datainput[
                'type'] == data_input_util.INPUT_METHOD_CUSTOMIZED and 'code' not in datainput:
            raise CommonException(
                e_message='No code in data input:{}'.format(datainput['name']),
                err_code=3141,
                options={'input_name': datainput['name']})
        elif datainput['type'] in [
                data_input_util.INPUT_METHOD_CMD, data_input_util.INPUT_METHOD_REST
        ]:
            datainput['code'] = self.generate_input_module_content(datainput)
        test_input_module = self.get_input_module_file_name(datainput['name'] +
                                                            test_id)
        targetfile = os.path.join(bin_dir, '{}.py'.format(test_input_module))
        with open(targetfile, 'w') as f:
            f.write(datainput['code'])
        datainput['input_module_file'] = targetfile
        # generate input.py
        modinput_content = self.generate_python_modinput_content(datainput)
        # Important: should replace the base input module name, since it is
        # changed!
        old_import = TAInputMetaMgr.BASE_INPUT_MODULE_IMPORT.format(
            self.get_input_module_file_name(datainput['name']))
        new_import = TAInputMetaMgr.BASE_INPUT_MODULE_IMPORT.format(
            test_input_module)
        modinput_content = modinput_content.replace(old_import, new_import)
        datainput['code'] = modinput_content

        datainput['modinput_file'] = os.path.join(
            bin_dir, '{}.py'.format(datainput['name'] + test_id))

        try:
            self.__asset_generator.generate_import_declare_if_not_exist()
            self.__asset_generator.generate_python_libs_if_not_exist()
            # generate cc json
            if cc_input_builder:
                cc_input_builder.generate_cc_input_json(bin_dir, True)
            # Do not open this log in production env. It may log some user credential: TAB-2191
            # self.__logger.debug("begine to test data input %s", logger.hide_sensitive_field(datainput))
            code_runner = runner.CodeRunner(self.__appname, datainput)
            return_code, stdout_buffer, stderr_buffer = code_runner.run()
            if cc_input_builder:
                dryrun_result = cc_input_builder.process_cc_input_dry_run_result(
                    return_code, stdout_buffer, stderr_buffer)
            else:
                if return_code == 0:
                    # success
                    raw_events = data_input_util.parse_MI_output_xml(
                        stdout_buffer)
                    dryrun_result = {
                        'status': 'success',
                        'results': raw_events
                    }
                else:
                    dryrun_result = {
                        'status': 'fail',
                        'results': [],
                        'error': stderr_buffer
                    }
        except Exception as e:
            self.__logger.error('Error happens when dry run input:%s. \n %s',
                                datainput['modinput_file'],
                                traceback.format_exc())
            raise e
        finally:
            # clean up the base modinput python files. The modinput file will
            # be cleaned in code runner
            if 'input_module_file' in datainput and os.path.isfile(datainput[
                    'input_module_file']):
                os.remove(datainput['input_module_file'])
                self.__logger.debug(
                    'remove input module file:%s after testing.',
                    datainput['input_module_file'])
            self.__asset_generator.cleanup_ta_bin_folder()
            for f in os.listdir(bin_dir):
                if f.endswith('.pyc'):
                    self.__logger.debug('remove %s after testing.', f)
                    os.remove(os.path.join(bin_dir, f))
            if cc_input_builder:
                cc_json = cc_input_builder.get_cc_json_file_path(bin_dir, True)
                if os.path.isfile(cc_json):
                    self.__logger.debug('delete dryrun cc json:%s.', cc_json)
                    os.remove(cc_json)

        return dryrun_result

    # method for Unit test
    def clear_meta(self):
        self.__input_meta_mgr.clear_meta()

    @metric_util.function_run_time(tags=['datainput_builder'])
    def upgrade_modular_input_from_1_0_1_to_1_1_0(self, modinput_file,
                                                  datainput):
        '''this file is used to upgrade the modular input files.
        because from 1.0.0 to 1.1.0, we changed the modinput hierarchy
        '''
        input_type = datainput.get('type', '')
        if input_type == 'customized' and os.path.isfile(modinput_file):
            # this means the modinput file is v1.0.0. If we have successfully
            # generated v1.1.0 modinput file, no code in meta
            pdir = os.path.dirname(modinput_file)
            sys.path.insert(0, pdir)
            module_name = os.path.splitext(os.path.basename(modinput_file))[0]
            old_modinput = importlib.import_module(module_name)
            if hasattr(old_modinput.MyScript, 'collect_events'):
                self.__logger.info(
                    "collect_events is found in modular input file %s. It is of 1.1.0 format. No need to upgrade.",
                    modinput_file)
                return

            validate_input_str = inspect.getsource(
                old_modinput.MyScript.validate_input)
            validate_input_str = re.sub(
                r'\s*def\s+validate_input\(self, definition\):', '',
                validate_input_str)
            stream_events_str = inspect.getsource(
                old_modinput.MyScript.stream_events)
            stream_events_str = re.sub(
                r'\s*def\s+stream_events\(self, inputs, ew\):', '',
                stream_events_str)
            sys.path.remove(pdir)  # clean the path
            self._create_modular_input_py(datainput)
            self._create_input_py(datainput)  # create the base input py
            # till now, modinput_file should be new, with empty content
            # need to replace the content
            trans = ""
            with open(modinput_file, 'r') as tf:
                trans = tf.read()
            trans = re.sub(
                r'\s*# TODO : Implement you own validation logic\s+pass',
                validate_input_str, trans)
            trans = re.sub(
                r'\s*# TODO: implement your data collection logic here',
                stream_events_str, trans)
            with open(modinput_file, 'w') as tf:
                tf.write(trans)
            self.__logger.info(
                "Migrate the customized modinput %s during upgrade.",
                datainput.get('name', 'unknown'))
        else:
            # update the cmd modinput var. we changed this in 1.1.0
            if input_type == 'command':
                opts = datainput['data_inputs_options']
                for opt in opts:
                    if opt['name'] == 'command' and 'type' not in opt:
                        opt['name'] = '_command'

            # it is not customized mod input, just regen
            self._create_input_py(datainput)
            self.__logger.info("Regenerate modinput %s during upgrade.",
                               datainput.get('name', 'unknown'))

    @metric_util.function_run_time(tags=['datainput_builder'])
    def upgrade_from_1_0_1_to_1_1_0(self):
        datainputs = self.get_all_TA_inputs()
        for datainput in datainputs:
            input_name = datainput['name']
            target_file = os.path.join(
                builder_util.get_target_folder(self.__current_ta_dir, 'bin'),
                "{}.py".format(input_name))
            self.upgrade_modular_input_from_1_0_1_to_1_1_0(target_file,
                                                           datainput)
            self.__logger.info("Upgrade modinput %s from 1.0.1 to 1.1.0.",
                               input_name)
        if datainputs:
            self.__input_meta_mgr.set_meta(datainputs)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def upgrade_from_1_1_0_to_2_0_0(self):
        datainputs = self.get_all_TA_inputs()
        if len(datainputs) > 0:
            # no need to do anything if there is no data inputs
            for l in ['tab_splunklib', 'tab_splunktalib', 'modinput_wrapper']:
                d = os.path.join(self.__current_ta_dir, 'bin', l)
                if os.path.isdir(d):
                    shutil.rmtree(d)
                    self.__logger.info(
                        'Delete %s when upgrade from 1.1.0 to 2.0.0.', d)
            self.__asset_generator.generate_python_libs()
            self.__asset_generator.generate_import_declare()
        for di in datainputs:
            # regenerate the inputs python files
            self._create_input_py(di)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def upgrade_from_2_0_0_to_2_1_0(self):
        '''
        return True if there are data inputs upgraded
        '''
        # regenerate the inputs python files
        datainputs = self.get_all_TA_inputs()
        if not datainputs:
            # no need to upgrade if there is no inputs
            return False
        for datainput in datainputs:
            for input_option in datainput.get('data_inputs_options'):
                if input_option.get('type') == 'customized_var':
                    input_option['format_type'] = 'text'
            if datainput['type'] == 'rest':
                global_settings_meta = self._ta_configuration_builder.get_global_settings()
            else:
                global_settings_meta = None
            self._create_input_py(datainput, global_settings_meta)
        self.__input_meta_mgr.set_meta(datainputs)
        upgraded = True if datainputs else False
        return upgraded

    @metric_util.function_run_time(tags=['datainput_builder'])
    def upgrade_from_2_1_1_to_2_1_2(self):
        # regen all the customized and cmd input python files: TAB-2512
        global_settings_meta = self._ta_configuration_builder.get_global_settings()
        for datainput in self.get_all_TA_inputs():
            if datainput.get('type') in (data_input_util.INPUT_METHOD_CMD, data_input_util.INPUT_METHOD_CUSTOMIZED):
                self._create_modular_input_py(datainput, global_settings_meta)
                self.__logger.info('Upgrade input %s. regenerate modular input python file.', datainput.get('name'))

    @metric_util.function_run_time(tags=['datainput_builder'])
    def on_rename_add_on(self, old_app_name):
        datainputs = self.get_all_TA_inputs()
        if len(datainputs) > 0:
            old_declare = os.path.join(self.__current_ta_dir, 'bin', common_util.get_python_declare_file_name(old_app_name))
            if os.path.isfile(old_declare):
                os.remove(old_declare)
            self.__asset_generator.generate_import_declare()
            old_python_dir_name = common_util.get_python_lib_dir_name(
                old_app_name)
            old_python_lib = os.path.join(self.__current_ta_dir, 'bin',
                                          old_python_dir_name)
            if os.path.isdir(old_python_lib):
                self.__asset_generator.migrate_python_libs(old_python_lib)
            else:
                self.__asset_generator.generate_python_libs_if_not_exist()
        for di in datainputs:
            self._create_input_py(di)
            self.__logger.debug('create python file when add-on is renamed.')

    def set_customized_options(self, uuid, customized_options):
        self.__input_meta_mgr.set_customized_options(uuid, customized_options)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_all_sourcetypes(self):
        return self.__input_meta_mgr.get_all_sourcetypes()

    @metric_util.function_run_time(tags=['datainput_builder'])
    def regenerate_inputs_conf(self):
        '''
        this method is used for importing TA projects.
        The inputs.conf needs to be updated if there is any encrypted variables in inputs
        '''
        # call the private method to get the input meta directly
        datainputs = self.__input_meta_mgr._get_inputs()
        if datainputs:
            filtered_datainputs, input_kinds = self.__input_meta_mgr.get_datainputs_and_kinds_for_conf(datainputs)
            self._generate_inputs_conf(filtered_datainputs, input_kinds)

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_data_input_summary(self):
        all_inputs = self.get_all_TA_inputs() or []
        search_result = search_util.get_sourcetype_from_index(self.__service_with_tab_context)
        sourcetypes_totalcount = {entry['sourcetype']: entry['totalCount']
                                  for entry in search_result}
        for _input in all_inputs:
            _input['sample_count'] = sourcetypes_totalcount.get(
                _input['sourcetype'], 0)
        # get the code for customized modinput
        input_codes = self.get_customized_data_input_code(all_inputs)
        for _input in all_inputs:
            if _input['name'] in input_codes:
                _input['code'] = input_codes[_input['name']]

        return all_inputs

    @metric_util.function_run_time(tags=['datainput_builder'])
    def get_all_input_summaries(self, global_settings):
        # rebuilt data input for Python3 upgrade
        all_inputs = self.get_data_input_summary()

        for input in all_inputs:
            input["global_settings"] = global_settings
            input["reload_input"] = False

        return all_inputs
