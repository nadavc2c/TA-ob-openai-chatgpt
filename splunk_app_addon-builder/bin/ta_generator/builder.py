from builtins import object
import os
import traceback
import shutil
import tempfile

# import ta_generator.builder_util

from ta_generator.builder_ta_basic import TABasicBuilder
from ta_generator.builder_ta_input import TAInputBuilder
from ta_generator.builder_ta_cim import TACIMBuilder
from ta_generator.builder_ta_alert import TAAlertBuilder
from ta_generator.builder_ta_sourcetype import TASourcetypeBuilder
from ta_generator.builder_ta_configuration import TAConfigurationBuilder

import ta_generator.ta_static_asset_generator
from ta_meta_management import meta_manager, meta_const, meta_util
from aob.aob_common import logger, builder_constant, conf_parser
from tabuilder_utility import tab_conf_manager, common_util, upgrade_util
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.ko_util import sourcetype_util
from ta_generator.builder_ta_extraction import TAExtractionBuilder

import splunklib.binding as binding
from solnlib.conf_manager import ConfStanzaNotExistException
from aob.aob_common.metric_collector import metric_util
from ta_generator import builder_util
from ta_generator import ta_static_asset_generator

common_util.initialize_apm()

AOB_RELEASE_VERSIONS = ['1.0.0', '1.0.1', '1.1.0', '2.0.0', '2.1.0', '2.1.1', '2.1.2', '2.2.0']

class TABuilder(object):
    @metric_util.function_run_time(tags=['builder'])
    def __init__(self, appname, uri=None, session_key=None, service_with_tab_context=None):
        if common_util.contain_reserved_chars(appname):
            ce = CommonException()
            ce.set_err_code(2015)
            raise ce

        self.__splunk_uri = uri
        self.__splunk_session_key = session_key
        self.__appname = appname
        self.__logger = logger.get_generator_logger()
        self.__parent_dir = os.path.split(os.path.realpath(__file__))[0]
        self.__resource_dir = os.path.join(self.__parent_dir, "resources")
        self.__resource_lib_dir = os.path.join(self.__parent_dir,
                                               "resources_lib")
        self.__splunk_home = os.environ['SPLUNK_HOME']
        self.__splunk_app_dir = os.path.join(self.__splunk_home, "etc", "apps")
        if service_with_tab_context:
            self.__service_with_tab_context = service_with_tab_context
        else:
            self.__service_with_tab_context = common_util.create_splunk_service(session_key, uri, builder_constant.ADDON_BUILDER_APP_NAME)
        self.__service_with_ta_context = common_util.create_splunk_service(session_key, uri, self.__appname)

        self.__basic_builder = TABasicBuilder(self.__appname, uri, session_key, self.__service_with_tab_context, self.__service_with_ta_context)
        self.__input_builder = TAInputBuilder(self.__appname, uri, session_key, self.__service_with_tab_context, self.__service_with_ta_context)
        self.__cim_builder = TACIMBuilder(self.__appname, uri, session_key, self.__service_with_tab_context, self.__service_with_ta_context)
        self.__st_builder = TASourcetypeBuilder(appname, uri, session_key, self.__service_with_tab_context, self.__service_with_ta_context)
        self.__extraction_builder = TAExtractionBuilder(uri, session_key,
                                                        appname, self.__service_with_tab_context, self.__service_with_ta_context)
        self.__alert_builder = TAAlertBuilder(self.__appname, uri, session_key, self.__service_with_tab_context, self.__service_with_ta_context)
        self.__ta_configuration_builder = TAConfigurationBuilder(self.__appname, self.__service_with_tab_context, self.__service_with_ta_context)
        self.__tab_conf_mgr = tab_conf_manager.create_tab_conf_manager(session_key, uri, appname)
        self.__builder_name_const = {
            'BASIC_BUILDER': 'BASIC_BUILDER',
            'INPUT_BUILDER': 'INPUT_BUILDER',
            'SETUP_BUILDER': 'SETUP_BUILDER',
            'CIM_BUILDER': 'CIM_BUILDER'
        }

        self.__basic_builder_meta_mgr = meta_manager.create_meta_manager(session_key, uri, meta_const.BASIC_BUILDER, self.__appname)
        self.__inputs_builder_meta_mgr = meta_manager.create_meta_manager(session_key, uri, meta_const.DATA_INPUT_BUILDER, self.__appname)
        self.__field_extract_builder_meta_mgr = meta_manager.create_meta_manager(session_key, uri, meta_const.FIELD_EXTRACT_BUILDER, self.__appname)

        self.__input_builder.set_alert_builder(self.__alert_builder)
        self.__upgrade_methods = {
            '1.0.1': {
                'function': 'upgrade_from_1_0_1_to_1_1_0',
                'next': '1.1.0'
            },
            '1.1.0': {
                'function': 'upgrade_from_1_1_0_to_2_0_0',
                'next': '2.0.0'
            },
            '2.0.0': {
                'function': 'upgrade_from_2_0_0_to_2_1_0',
                'next': '2.1.0'
            },
            '2.1.0': {
                'function': 'upgrade_from_2_1_0_to_2_1_1',
                'next': '2.1.1'
            },
            '2.1.1': {
                'function': 'upgrade_from_2_1_1_to_2_1_2',
                'next': '2.1.2'
            },
            '2.1.2': {
                'function': 'upgrade_from_2_1_2_to_2_2_0',
                'next': '2.2.0'
            },
            '2.2.0': {
                'function': 'upgrade_from_2_2_0_to_3_0_0',
                'next': '3.0.0'
            }
        }

    @property
    def app_name(self):
        return self.__appname

    @property
    def alert_builder(self):
        return self.__alert_builder

    @property
    def tab_service(self):
        return self.__service_with_tab_context

    @property
    def basic_builder(self):
        return self.__basic_builder

    def _validation_project_basic_meta(self, meta):
        package_name = meta.get("appname", "")
        if common_util.contain_reserved_chars(package_name):
            ce = CommonException()
            ce.set_err_code(2015)
            raise ce

    @metric_util.function_run_time(tags=['builder'])
    def generate_TA(self, meta):
        self._validation_project_basic_meta(meta)
        return self.__basic_builder.generate_TA(meta)

    @metric_util.function_run_time(tags=['builder'])
    def update_TA_basic(self, meta):
        self._validation_project_basic_meta(meta)
        global_settings = self.__ta_configuration_builder.get_global_settings()
        globalsetting_enabled = not (not global_settings)
        data_inputs = self.__input_builder.get_all_TA_inputs()
        has_data_input = not (not data_inputs)
        self.__logger.debug('update ta basic with meta:%s, global_settings:%s, data_inputs:%s', meta, global_settings, data_inputs)
        is_setup_page_enabled = has_data_input or globalsetting_enabled
        return self.__basic_builder.update_TA_basic(meta, is_setup_page_enabled=is_setup_page_enabled)

    @metric_util.function_run_time(tags=['builder'])
    def get_TA_basic_meta(self):
        return self.__basic_builder.get_meta()

    @metric_util.function_run_time(tags=['builder'])
    def update_TA_name(self, meta):
        """
        param: meta is the basic project info meta

        when renaming the add-on. Try to provide rollback machnism
        """
        self._validation_project_basic_meta(meta)

        curdir = self.__basic_builder.get_current_ta_dir()
        bak_dir = os.path.join(tempfile.mkdtemp(), self.__appname + '.bak')
        new_name = meta["appname"]
        new_dir = os.path.join(self.__splunk_app_dir, new_name)
        if os.path.isdir(new_dir):
            # do not put this into the try. Because no need to revert
            raise CommonException(err_code=71, options={'new_name': new_name}, e_message="App directory {0} exists.".format(new_name))
        try:
            # back up the current ta
            if os.path.isdir(bak_dir):
                shutil.rmtree(bak_dir)
            shutil.copytree(curdir, bak_dir)
            # before renaming, should clean up the UCC resources,
            # because there is app name in the rest hanlder prefix,
            # this will change
            self.__ta_configuration_builder.delete_ta_configuration_resources()
            # begin to rename the app
            shutil.copytree(curdir, new_dir)
            common_util.delete_app(self.__service_with_tab_context, self.__appname)

            meta_manager.MetaManager.rename_app(self.__service_with_tab_context,
                                                self.__appname, new_name)
            # need to load the new app before generate the UCC resources
            common_util.reload_splunk_apps(self.__service_with_tab_context)
            new_ta_service = common_util.create_splunk_service(self.__splunk_session_key, self.__splunk_uri, new_name)

            new_basic_builder = TABasicBuilder(new_name, self.__splunk_uri,
                                           self.__splunk_session_key, self.__service_with_tab_context, new_ta_service)
            new_datainput_builder = TAInputBuilder(new_name, self.__splunk_uri, self.__splunk_session_key, self.__service_with_tab_context, new_ta_service)
            new_configuration_builder = TAConfigurationBuilder(new_name, self.__service_with_tab_context, new_ta_service)
            # data input builder needs to update the libs and declare files
            new_datainput_builder.on_rename_add_on(self.__appname)
            # UCC page contains the app name in the rest endpoint
            new_configuration_builder.on_rename_add_on(self.__appname)
            # should update the app.conf and default.xml
            # this should happens at the last step, update the basic meta after
            # the ucc and inputs migration success
            globalsetting_enabled = not (not new_configuration_builder.get_global_settings())
            has_inputs = not (not new_datainput_builder.get_all_TA_inputs())
            new_basic_builder.update_TA_basic(meta, is_setup_page_enabled=(globalsetting_enabled or has_inputs))
        except Exception as e:
            self.__logger.error('Error when renaming TA from %s to %s. %s', self.__appname, new_name, traceback.format_exc())
            # try to revert the app
            if meta_manager.MetaManager.is_app_created_by_aob(self.__service_with_tab_context, new_name):
                self.__logger.info('rollback the meta of TA %s', self.__appname)
                meta_manager.MetaManager.rename_app(self.__service_with_tab_context, new_name, self.__appname)
            if os.path.isdir(bak_dir):
                if os.path.isdir(curdir):
                    shutil.rmtree(curdir)
                self.__logger.info('rollback the app dir of TA %s', self.__appname)
                shutil.copytree(bak_dir, curdir)
            if os.path.isdir(new_dir):
                # should clean up the new app folder
                shutil.rmtree(new_dir)
            # load the old app
            common_util.reload_splunk_apps(self.__service_with_tab_context)
            if isinstance(e, CommonException):
                raise e
            else:
                raise CommonException(err_code=70, options={'app_name': self.__appname}, e_message='error happens when renaming TA:' + self.__appname)
        finally:
            if os.path.isdir(bak_dir):
                self.__logger.info('delete the backup dir:%s', bak_dir)
                shutil.rmtree(bak_dir)

    @metric_util.function_run_time(tags=['builder'])
    def get_all_TA_inputs(self):
        return self.__input_builder.get_all_TA_inputs()

    @metric_util.function_run_time(tags=['builder'])
    def get_customized_data_input_code(self, input_metas):
        return self.__input_builder.get_customized_data_input_code(input_metas)

    @metric_util.function_run_time(tags=['builder'])
    def create_TA_input(self, datainput, reload_input=True):
        datainputs, meta, ucc_resource_generated = self.__input_builder.create_TA_input(datainput, reload_input)
        self.set_data_input_name(
            datainput.get("sourcetype"), datainput.get("name"))
        if ucc_resource_generated:
            self.__basic_builder.enable_ucc_page_in_app_conf()
        else:
            self.__basic_builder.disable_ucc_page_in_app_conf()
        return meta

    @metric_util.function_run_time(tags=['builder'])
    def save_TA_input_code(self, input_meta):
        """
        input_meta scheme
        {
            "uuid": uuid for this input,
            "filename": data-input-name,
            "code": data-input-code,
            "customized_options": [{name:var1, value:value1},
                                    {name:var2, value:value2}
                                  ] # (optional) data input options and values
        }
        """
        input_name = input_meta.get('filename', None)
        if not input_name:
            raise Exception("Input name not found when save input code.")
        splunk_home = os.environ['SPLUNK_HOME']
        file_path = os.path.join(splunk_home, 'etc/apps', self.__appname, 'bin',
                                 "{}.py".format(input_name))
        with open(file_path, 'w') as f:
            f.write(input_meta["code"])
        # save the customized_options to TAB_example input stanza
        input_conf_updated = False
        options = {opt['name']: opt['value']
                   for opt in input_meta.get('customized_options', [])}
        if options:
            try:
                self.__tab_conf_mgr.update_data_input(
                    input_name, "TAB_example", {}, options)
                self.__logger.info(
                    "update the customized options to inputs.conf, options:%s",
                    options)
                input_conf_updated = True
            except binding.HTTPError as he:
                self.__logger.error(
                    "error caught when updating customized options to inputs.conf. options:%s, input type:%s, exception: %s",
                    options, input_name, traceback.format_exc())
            except ConfStanzaNotExistException as cnee:
                self.__logger.info("Update input %s fails. Input not found. The input may not be loaded. %s", input_name, traceback.format_exc())
            try:
                self.__input_builder.set_customized_options(
                    input_meta['uuid'], input_meta['customized_options'])
                if input_conf_updated is False:
                    self.__input_builder.refresh_input_conf_file()
            except Exception as e:
                self.__logger.error(
                    "fail to add data input customized options %s to meta. Error: %s",
                    input_meta['customized_options'], traceback.format_exc())
                raise e
        self.__tab_conf_mgr.reload_data_input(input_name)

    @metric_util.function_run_time(tags=['builder'])
    def fetch_input_code(self, datainput):
        return self.__input_builder.fetch_input_code(datainput)

    @metric_util.function_run_time(tags=['builder'])
    def delete_TA_input(self, datainput):
        data_inputs_meta, ucc_resource_generated = self.__input_builder.delete_TA_input(datainput)
        self.set_data_input_name(datainput.get("sourcetype"), None)
        if ucc_resource_generated:
            self.__basic_builder.enable_ucc_page_in_app_conf()
        else:
            self.__basic_builder.disable_ucc_page_in_app_conf()

    @metric_util.function_run_time(tags=['builder'])
    def update_TA_input(self, datainput_new, reload_input=True):
        data_inputs_meta, ucc_resource_generated = self.__input_builder.update_TA_input(datainput_new, reload_input)
        self.set_data_input_name(
            datainput_new.get("sourcetype"), datainput_new.get("name"))
        if ucc_resource_generated:
            self.__basic_builder.enable_ucc_page_in_app_conf()
        else:
            self.__basic_builder.disable_ucc_page_in_app_conf()

    # modular alert builder
    @metric_util.function_run_time(tags=['builder'])
    def get_all_TA_alerts(self):
        return self.__alert_builder.get_all_TA_alerts()

    def create_TA_alert(self, modular_alert):
        uuid = self.__alert_builder.create_TA_alert(modular_alert)
        return uuid

    def delete_TA_alert(self, modular_alert):
        self.__alert_builder.delete_TA_alert(modular_alert)

    def update_TA_alert(self, modular_alert):
        self.__alert_builder.update_TA_alert(modular_alert)

    def fetch_modular_alert_code(self, params):
        return self.__alert_builder.get_modular_alert_code(params)

    def test_modular_alert_code(self, params):
        return self.__alert_builder.test_modular_alert_code(params)

    @metric_util.function_run_time(tags=['builder'])
    def get_input_sourcetypes(self):
        """
        @return: [st1, st2, st3]
        """
        return self.__input_builder.get_all_sourcetypes()

    @metric_util.function_run_time(tags=['builder'])
    def update_global_settings(self, meta):
        if 'customized_settings' in meta and len(meta['customized_settings']) == 0:
            del meta['customized_settings']
        ucc_resource_generated = self.__ta_configuration_builder.update_global_settings(meta)
        if ucc_resource_generated:
            self.__basic_builder.enable_ucc_page_in_app_conf()
        else:
            self.__basic_builder.disable_ucc_page_in_app_conf()

    @metric_util.function_run_time(tags=['builder'])
    def get_global_settings(self):
        return self.__ta_configuration_builder.get_global_settings()

    @metric_util.function_run_time(tags=['builder'])
    def get_sourcetypes_from_index(self):
        """
        @return: [{'sourcetype': st1}, {'sourcetype': st2}]
        """
        return self.__cim_builder.get_sourcetypes_from_index()

    @metric_util.function_run_time(tags=['builder'])
    def get_TA_cim_basic_info(self):
        return {}

    @metric_util.function_run_time(tags=['builder'])
    def get_all_sourcetypes(self):
        """
        @return: [st1, st2, st3]
        """
        st_in_meta = self.get_app_sourcetypes()
        index_sts = [s['sourcetype']
                     for s in self.get_sourcetypes_from_index()]
        return list(set(st_in_meta + index_sts))

    @metric_util.function_run_time(tags=['builder'])
    def create_extraction_results(self, sourcetype):
        return self.__extraction_builder.run(sourcetype)

    @metric_util.function_run_time(tags=['builder'])
    def start_parse_unstructured_data(self, sourcetype, batch_size=10000):
        self.__extraction_builder.start_parse_unstructured_data(sourcetype, batch_size)

    @metric_util.function_run_time(tags=['builder'])
    def cancel_parse_unstructured_data(self, sourcetype):
        self.__extraction_builder.cancel_parse_unstructured_data(sourcetype)

    @metric_util.function_run_time(tags=['builder'])
    def get_unstructured_data_status(self, sourcetype):
        return self.__extraction_builder.get_unstructured_data_parsing_status(sourcetype)

    @metric_util.function_run_time(tags=['builder'])
    def load_unstructured_data_result(self, sourcetype):
        return self.__extraction_builder.load_unstructured_data_results(sourcetype)

    @metric_util.function_run_time(tags=['builder'])
    def get_unstructured_data_results(self, sourcetype):
        return self.__extraction_builder.get_unstructured_data_results(sourcetype)

    def remove_all_unstructured_data_inputs(self):
        self.__extraction_builder.remove_all_unstructured_data_inputs()

    ####################################################

    @metric_util.function_run_time(tags=['builder'])
    def get_sourcetype_basic_info(self):
        """
        return:
        {
            sourcetype1: {
                conf_data: {
                    should_linemerge: true,
                    timestamp_prefix: ...,
                    ....
                }
                metadata: {
                    event_count: int,
                    data_input_name: str,
                    extractions_count: int,
                    cims_count: int,
                    is_parsed: bool,
                    data_format: str,
                }
            }
        }
        """
        st_meta = self.__st_builder.get_sourcetypes() or {}
        sourcetype_stanzas = self.__tab_conf_mgr.get_conf_stanza("props", curr_app_only=True)
        event_counts = builder_util.get_event_count(self.__service_with_tab_context)
        extraction_meta = self.__extraction_builder.get_meta_results() or {}

        res = {}
        active_sourcetypes = []
        for stanza in sourcetype_stanzas:
            sourcetype = stanza.get("name")
            # skip the renamed shourcetypes
            if stanza.get("rename") or not sourcetype_util.is_sourcetype(sourcetype):
                continue
            del stanza["name"]

            stanza = {k:v for k,v in list(stanza.items()) if ":" not in k and not sourcetype_util.is_extraction(k)}

            event_count = event_counts.get(sourcetype, 0)

            ext_meta = extraction_meta.get(sourcetype, {})
            data_format = ext_meta.get('data_format', None)
            is_parsed = ext_meta.get('is_parsed', False)
            if data_format:
                table_delim = ext_meta.get("table_results", {}).get("delim", None)
            else:
                extractions = self.detect_sample_format(sourcetype, except_if_no_events=False)
                table_delim = extractions.get("table_results", {}).get("delim", None)
                data_format = extractions.get("data_format", None)

            st = st_meta.get(sourcetype) or {}
            if st:
                active_sourcetypes.append(sourcetype)
            data_input_name = st.get("metadata", {}).get("data_input_name", None)
            metadata = {
                "event_count": event_count,
                "is_parsed": is_parsed,
                "data_format": data_format,
                "table_delim": table_delim,
                "data_input_name": data_input_name
            }

            res[sourcetype] = {
                "conf_data": stanza,
                "metadata": metadata,
            }

        # cleanup metadata
        for sourcetype, key_values in list(st_meta.items()):
            if sourcetype not in active_sourcetypes:
                self.__st_builder.delete_sourcetype(sourcetype)

        return res

    @metric_util.function_run_time(tags=['builder'])
    def create_sourcetype(self, sourcetype, key_values, fail_if_sourcetype_exists=True):
        return self.__st_builder.create_sourcetype(sourcetype, key_values, fail_if_sourcetype_exists)

    @metric_util.function_run_time(tags=['builder'])
    def import_sourcetype(self, sourcetype):
        self.__st_builder.import_sourcetype(sourcetype)

    @metric_util.function_run_time(tags=['builder'])
    def update_sourcetype(self, sourcetype, key_values, check_exist=False):
        return self.__st_builder.update_sourcetype(sourcetype, key_values,
                                                   check_exist)

    @metric_util.function_run_time(tags=['builder'])
    def delete_sourcetype(self, sourcetype):
        # delete sourcetype in sourcetype builder,
        # as well as field extraction & CIM builder.
        # Note that if the sourcetype is used by data input builder,
        # UI should not have "delete" button
        self.__tab_conf_mgr.delete_conf_stanza("props", sourcetype)
        self.__extraction_builder.delete_sourcetype(sourcetype)
        self.__st_builder.delete_sourcetype(sourcetype)

    @metric_util.function_run_time(tags=['builder'])
    def get_sourcetype_extraction_status(self):
        st_dict = self.__st_builder.get_sourcetypes() or {}
        extraction_dict = self.__extraction_builder.get_meta_results() or {}

        status = []
        for sourcetype in list(st_dict.keys()):
            extractions = extraction_dict.get(sourcetype) or {}
            has_extraction = extractions.get("is_parsed", False)

            if not extractions.get("data_format", None):
                extractions = self.detect_sample_format(sourcetype, except_if_no_events=False)

            status.append({
                "sourcetype": sourcetype,
                "has_extraction": has_extraction,
                "table_delim": extractions.get("table_results", {}).get("delim", None),
                "data_format": extractions.get("data_format", None),
            })

        status.sort(key=lambda x: x.get("sourcetype"))
        return status

    @metric_util.function_run_time(tags=['builder'])
    def get_app_sourcetypes(self):
        """
        return the sourcetype name list in this app meta
        [st1, st2, st3]
        """
        return self.__st_builder.get_all_sourcetype_names()

    @metric_util.function_run_time(tags=['builder'])
    def set_data_input_name(self, sourcetype, data_input_name):
        self._set_sourcetype_metadata(sourcetype, "data_input_name",
                                      data_input_name)

    @metric_util.function_run_time(tags=['builder'])
    def set_extraction_count(self, sourcetype, count):
        self._set_sourcetype_metadata(sourcetype, "extractions_count", count)

    @metric_util.function_run_time(tags=['builder'])
    def add_cim_count(self, sourcetype):
        key_values = self.__st_builder.get_sourcetypes()
        metadata = key_values.get(sourcetype, {}).get("metadata", {})
        count = metadata.get("cims_count") + 1
        self._set_sourcetype_metadata(sourcetype, "cims_count", count)

    def minus_cim_count(self, sourcetype):
        key_values = self.__st_builder.get_sourcetypes()
        metadata = key_values.get(sourcetype, {}).get("metadata", {})
        count = metadata.get("cims_count") - 1
        if count < 0:
            count = 0
        self._set_sourcetype_metadata(sourcetype, "cims_count", count)

    @metric_util.function_run_time(tags=['builder'])
    def detect_sample_format(self, sourcetype, except_if_no_events=True):
        return self.__extraction_builder.detect_sample_format(sourcetype, except_if_no_events)

    def _set_sourcetype_metadata(self, sourcetype, field, value):
        key_values = self.__st_builder.get_sourcetypes() or {}
        metadata = key_values.get(sourcetype, {}).get("metadata", {})
        metadata[field] = value
        self.__st_builder.update_meta(sourcetype, metadata)

    @metric_util.function_run_time(tags=['builder'])
    def get_events(self, sourcetype, batch_size):
        return self.__extraction_builder.get_events(sourcetype, batch_size)

    def get_table_format_results(self, sourcetype, delim):
        return self.__extraction_builder.get_table_format_results(sourcetype, delim)

    def load_table_format_results(self, sourcetype):
        return self.__extraction_builder.load_table_format_results(sourcetype)

    def save_table_format_results(self, sourcetype, headers, delim):
        self.__extraction_builder.delete_extraction(sourcetype)
        self.__extraction_builder.set_sourcetype_parsed(sourcetype)
        self.__extraction_builder.save_table_format_results(sourcetype, headers, delim)

    def get_kv_format_results(self, sourcetype, delim_pair, delim_kv, regex):
        return self.__extraction_builder.get_kv_format_results(sourcetype,
                                                               delim_pair, delim_kv, regex)

    def load_kv_format_results(self, sourcetype):
        return self.__extraction_builder.load_kv_format_results(sourcetype)

    def save_kv_format_results(self, sourcetype, delim_pair, delim_kv, regex):
        self.__extraction_builder.delete_extraction(sourcetype)
        self.__extraction_builder.set_sourcetype_parsed(sourcetype)
        self.__extraction_builder.save_kv_format_results(sourcetype, delim_pair, delim_kv, regex)

    def get_kv_templates(self):
        return self.__extraction_builder.get_kv_templates()

    def delete_extraction(self, sourcetype):
        self.__extraction_builder.delete_extraction(sourcetype)

    def save_json_format_results(self, sourcetype):
        self.__extraction_builder.delete_extraction(sourcetype)
        self.__extraction_builder.set_sourcetype_parsed(sourcetype)
        self.__extraction_builder.save_json_format_results(sourcetype)

    def save_xml_format_results(self, sourcetype):
        self.__extraction_builder.delete_extraction(sourcetype)
        self.__extraction_builder.set_sourcetype_parsed(sourcetype)
        self.__extraction_builder.save_xml_format_results(sourcetype)

    def get_import_sourcetype(self):
        res = []
        indexed_st = self.get_sourcetypes_from_index() or []
        meta_st = self.__st_builder.get_all_sourcetype_names() or []
        current_app_stanzas = self.__tab_conf_mgr.get_conf_stanza("props", curr_app_only=True)
        current_app_sourcetypes = set(s.get('name') for s in current_app_stanzas)

        for st in indexed_st:
            name = st.get("sourcetype")
            if name and name not in current_app_sourcetypes and name not in builder_constant.RESERVED_SOURCETYPES:
                item = {"name": name}
                res.append(item)

        res.sort(key=lambda x: x["name"])
        return res

    @metric_util.function_run_time(tags=['builder'])
    def get_index_time_extractions(self):
        return self.__st_builder.get_index_time_extractions()

    def get_inputs_basic_info(self):
        """
        return None if there is no metadata, else
        {
            sourcetype: {
                data_input_name: str,
                data_input_type: str
            }
        }
        """
        return self.__input_builder.get_basic_info()

    def _need_upgrade(self, current_v, latest_v):
        cmp = upgrade_util.compare_versions(current_v, latest_v)
        need_upgrade = (cmp == 1) # latest version is larger than current version
        if need_upgrade:
            # only update the project which is built by AoB
            need_upgrade = meta_util.is_app_created_by_aob(self.__service_with_tab_context, self.__appname)
            if not need_upgrade:
                self.__logger.info('app %s is not built by AoB. No need to upgrade it.', self.__appname)
        return need_upgrade

    @metric_util.function_run_time(tags=['builder'])
    def upgrade(self, current_tab_version, latest_tab_version):
        if not current_tab_version or not latest_tab_version:
            msg = "Invalida tab versions. current version:{0}, latest version:{1}".format(current_tab_version, latest_tab_version)
            self.__logger.error(msg)
            raise Exception(msg)
        if self._need_upgrade(current_tab_version, latest_tab_version):
            ver = current_tab_version
            pre_ver = current_tab_version
            while ver is not None and ver != latest_tab_version:
                if ver not in self.__upgrade_methods:
                    pre_ver = ver
                    ver = upgrade_util.find_next_upgrade_version(ver, latest_tab_version, AOB_RELEASE_VERSIONS)
                else:
                    getattr(self, self.__upgrade_methods[ver]['function'])()
                    pre_ver = ver
                    ver = self.__upgrade_methods[ver]['next']
                    self.__logger.info('Upgrade app %s, source aob version:%s, target aob version:%s', self.__appname, pre_ver, ver)
                if ver is None:
                    self.__logger.info('Can not find the upgrade path. current:%s, latest:%s', pre_ver, latest_tab_version)


    def upgrade_from_1_0_1_to_1_1_0(self):
        """
        this method is registered to a dict. it is invocated dynamically
        """
        self.__logger.info("begin to upgrade tab version from 1.0.1 to 1.1.0 in app %s.", self.__appname)
        self.__basic_builder.regenerate_resource_files()
        self.__input_builder.upgrade_from_1_0_1_to_1_1_0()
        self.__basic_builder.cleanup_splunktalib()
        self.__extraction_builder.upgrade_from_1_0_1_to_1_1_0()
        self.__logger.info("TA %s upgrade from 1.0.1 to 1.1.0 is done.", self.__appname)

    def upgrade_from_1_1_0_to_2_0_0(self):
        self.__logger.info("begin to upgrade tab version from 1.1.0 to 2.0.0 in app %s.", self.__appname)
        self.__basic_builder.upgrade_from_1_1_0_to_2_0_0()
        self.__input_builder.upgrade_from_1_1_0_to_2_0_0()
        self.__logger.info("TA %s upgrade from 1.1.0 to 2.0.0 is done.", self.__appname)

    @metric_util.function_run_time(tags=['builder'])
    def upgrade_from_2_0_0_to_2_1_0(self):
        self.__logger.info("begin to upgrate tab version from 2.0.0 to 2.1.0 in app %s.", self.__appname)
        global_settings = self.__ta_configuration_builder.get_global_settings() or None
        # regen the python lib if needed
        has_inputs = not (not self.__input_builder.get_all_TA_inputs())
        has_alerts = not (not self.__alert_builder.get_all_TA_alerts())
        if has_inputs or has_alerts:
            asset_generator = ta_static_asset_generator.AssetGenerator(
                self.__resource_dir,
                os.path.join(self.__splunk_app_dir, self.__appname),
                self.__resource_lib_dir,
                app_name=self.__appname)
            asset_generator.upgrade_from_2_0_0_to_2_1_0()
        input_upgraded = self.__input_builder.upgrade_from_2_0_0_to_2_1_0()
        self.alert_builder.upgrade_from_2_0_0_to_2_1_0(global_settings)
        global_setting_upgraded = self.__ta_configuration_builder.upgrade_from_2_0_0_to_2_1_0(input_upgraded)
        # update basic meta to regenerate app.conf to use ucc frontend page
        # this must happens after ucc upgrading
        basic_meta = self.__basic_builder.get_meta()
        if basic_meta:
            self.__basic_builder.update_TA_basic(basic_meta, global_setting_upgraded)
        else:
            if global_setting_upgraded:
                # change the local/app.conf directly
                local_app_conf = common_util.make_splunk_path([self.__splunk_app_dir, self.app_name, 'local', 'app.conf'])
                if os.path.isfile(local_app_conf):
                    parser = conf_parser.TABConfigParser()
                    parser.read(local_app_conf)
                    item_dict = parser.item_dict()
                    try:
                        parser.remove_option('ui', 'setup_view')
                    except:
                        pass
                    if not parser.has_section('install'):
                        parser.add_section('install')
                    parser.set('install', 'is_configured', '1')
                    if not parser.has_section('ui'):
                        parser.add_section('ui')
                    parser.set('ui', 'is_visible', '1')
                    with open(local_app_conf, 'w') as f:
                        parser.write(f)
                    self.__logger.info('No basic meta. Just update the app.conf when upgrade. TA:%s', self.app_name)
                    common_util.reload_splunk_apps(self.__service_with_tab_context)
        # todo: any other component update should be added here
        self.__logger.info("TA %s upgrade from 2.0.0 to 2.1.0 is done.", self.__appname)

    @metric_util.function_run_time(tags=['builder'])
    def upgrade_from_2_1_0_to_2_1_1(self):
        self.__logger.info("begin to upgrade tab version from 2.1.0 to 2.1.1 in app %s.", self.__appname)
        basic_meta = self.__basic_builder.get_meta()
        asset_generator = ta_static_asset_generator.AssetGenerator(
            self.__resource_dir,
            os.path.join(self.__splunk_app_dir, self.__appname),
            self.__resource_lib_dir,
            app_name=self.__appname)
        asset_generator.upgrade_from_2_1_0_to_2_1_1(basic_meta)
        self.__logger.info("TA %s upgrade from 2.1.0 to 2.1.1 is done.", self.__appname)

    @metric_util.function_run_time(tags=['builder'])
    def upgrade_from_2_1_1_to_2_1_2(self):
        self.__logger.info('begin to upgrade tab version from 2.1.1 to 2.1.2 in app %s', self.__appname)
        self.__input_builder.upgrade_from_2_1_1_to_2_1_2()
        self.__ta_configuration_builder.upgrade_from_2_1_1_to_2_1_2()
        self.__logger.info("TA %s upgrade from 2.1.1 to 2.1.2 is done.", self.__appname)

    @metric_util.function_run_time(tags=['builder'])
    def upgrade_from_2_1_2_to_2_2_0(self):
        self.__logger.info('begin to upgrade tab version from 2.1.2 to 2.2.0 in app %s', self.__appname)
        self.__basic_builder.upgrade_from_2_1_2_to_2_2_0()
        self.__ta_configuration_builder.upgrade_from_2_1_2_to_2_2_0()
        self.__alert_builder.upgrade_from_2_1_2_to_2_2_0()
        self.__logger.info("TA %s upgrade from 2.1.2 to 2.2.0 is done.", self.__appname)

    @metric_util.function_run_time(tags=['builder'])
    def upgrade_from_2_2_0_to_3_0_0(self):
        self.__logger.info('begin to upgrade tab version from 2.2.0 to 3.0.0 in app %s', self.__appname)
        global_settings = self.get_global_settings()

        # rebuild all alert actions
        has_alert = self.__alert_builder.upgrade_from_2_2_0_to_3_0_0(global_settings)

        # rebuild all data inputs
        all_inputs = self.__input_builder.get_all_input_summaries(global_settings)
        has_input = True if all_inputs else False
        for input in all_inputs:
            self.update_TA_input(input, reload_input=False)
        if has_input or has_alert:
            asset_generator = ta_static_asset_generator.AssetGenerator(
                self.__resource_dir,
                os.path.join(self.__splunk_app_dir, self.__appname),
                self.__resource_lib_dir,
                app_name=self.__appname)
            asset_generator.upgrade_from_2_2_0_to_3_0_0()
        # reload app
        common_util.reload_local_app(self.__service_with_tab_context, self.app_name)
