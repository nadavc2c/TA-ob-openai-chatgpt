from builtins import filter
from builtins import object
import copy
import importlib
import re
import os
import traceback

import splunklib.binding as binding
from splunklib.client import Input
from splunklib.client import Collection

from ta_generator import builder_util
import solnlib.utils as sutils
from ta_generator.builder_ta_sourcetype import TASourcetypeBuilder
from aob.aob_common.metric_collector import metric_util
from ta_meta_management import meta_const
from ta_meta_management import meta_manager
from aob.aob_common import logger, conf_parser
from tabuilder_utility import common_util, data_input_util
from tabuilder_utility.builder_exception import CommonException
'''
Note:
    For rest based data input meta, the details of the meta can be referred in
    builder_cloud_connect_data_input.
    We treat CC data input specially.

    meta data example: datainputs -- list object
    [{
        "uuid": uuid, // this is populated by builder
        "disabled": True/False,
        "sourcetype": "test",
        "index": "default",
        "name": "test",
        "title": "test",
        "description": "",
        "interval": "30",
        "type": "customized",
        "is_single_instance": True/False,  // default is False. Possible True only for customized input
        "use_basic_auth": False/True,  # only used for cc input
        "data_inputs_options": [{
            "type": "customized_var",
            "name": "text",
            "title": "Text",
            "description": "",
            "required_on_edit": false,
            "required_on_create": false,
            "format_type": "text",
            "default_value": "",
            "placeholder": ""
        }, {
            "type": "customized_var",
            "name": "password",
            "title": "Password",
            "description": "",
            "required_on_edit": false,
            "required_on_create": false,
            "format_type": "password",
            "default_value": "",
            "placeholder": ""
        }, {
            "type": "customized_var",
            "name": "checkbox",
            "title": "Checkbox",
            "description": "",
            "required_on_edit": false,
            "required_on_create": false,
            "format_type": "checkbox",
            "default_value": ""
        }, {
            "type": "customized_var",
            "name": "dropdown_list",
            "title": "Dropdown",
            "description": "",
            "required_on_edit": false,
            "required_on_create": false,
            "possible_values": [{
                "value": "option1",
                "label": "Option1"
            }, {
                "value": "option2",
                "label": "Option2"
            }, {
                "value": "option3",
                "label": "Option3"
            }],
            "format_type": "dropdownlist",
            "default_value": "",
            "placeholder": ""
        }, {
            "type": "customized_var",
            "name": "multi_dropdown_list",
            "title": "Multiple Dropdown",
            "description": "",
            "required_on_edit": false,
            "required_on_create": false,
            "possible_values": [{
                "value": "option1",
                "label": "Option1"
            }, {
                "value": "option2",
                "label": "Option2"
            }, {
                "value": "option3",
                "label": "Option3"
            }],
            "format_type": "multi_dropdownlist",
            "default_value": [],
            "placeholder": ""
        }, {
            "type": "customized_var",
            "name": "radio",
            "title": "Radio Group",
            "description": "",
            "required_on_edit": false,
            "required_on_create": false,
            "possible_values": [{
                "value": "option1",
                "label": "Option1"
            }, {
                "value": "option2",
                "label": "Option2"
            }, {
                "value": "option3",
                "label": "Option3"
            }],
            "format_type": "radiogroup",
            "default_value": ""
        }, {
            "type": "customized_var",
            "name": "global_account",
            "title": "Global Account",
            "description": "",
            "required_on_edit": false,
            "required_on_create": true,
            "possible_values": [],
            "format_type": "global_account",
            "default_value": "",
            "placeholder": ""
        }],
        "customized_options": [{
            "name": "xxx",
            "value": "yyy"
            }, {
            "name": "xxx",
            "value": "yyy"
        }],
        "code": the code content of the custmized modinput. // this attribute will not be stored in KV store. But web client will sent the content to server to upate the python file.
        "global_settings" : an object, the format is like the global setting meta. this attribute will not be stored in KV store. input builder use this to run the testing,
    },]

    Notes:
    The content of data inputs options are related to data input type.
    For different types, the content may be different.
    eg. for rest api, there should be a option named url. And the option
    value is required.
'''


class TAInputMetaMgr(object):
    GLOBAL_SETTING_KEY = 'global_settings'

    BASE_INPUT_MODULE_IMPORT = 'import {0} as input_module'
    # fix bug https://jira.splunk.com/browse/TAB-1983
    INPUT_RESERVED_PROPERTIES = [
        'host', 'index', 'source', 'sourcetype', 'queue', '_raw', '_meta',
        '_time', '_TCP_ROUTING', '_SYSLOG_ROUTING',
        '_INDEX_AND_FORWARD_ROUTING', 'interval', 'disabled', 'url', 'headers',
        'name', 'output_mode', 'output_field', 'owner', 'app', 'sharing',
        'queueSize', 'persistentQueueSize'
    ]
    INPUT_RESERVED_NAMES = [
        'sourcetype', 'index', 'start_by_shell', 'monitor', 'batch', 'tcp',
        'splunktcp', 'splunktcptoken', 'udp', 'fifo', 'script', 'http',
        'https', 'perfmon', 'MonitorNoHandle', 'WinEventLog', 'admon',
        'WinRegMon', 'WinHostMon', 'WinPrintMon', 'WinNetMon', 'powershell',
        'powershell2'
    ]
    INPUT_PROPERTY_NAME_PATTERN = re.compile('^[a-zA-Z]\w*$')
    INPUT_NAME_PATTERN = re.compile('^[a-zA-Z]\w*$')
    GLOBAL_ACCOUNT_NAME = '__global_account__'

    PLACEHOLDER_VAR = {
        "name": "placeholder",
        "title": "Placeholder",
        "type": "customized_var",
        "description": "Do not set any value to this",
        "required_on_create": False,
        "required_on_edit": False
    }

    CUSTOMIZED_VAR_REQUIRED_KEYS = ['name', 'title', 'format_type']
    REST_CKPT_OPTIONS = [
        data_input_util.EVENT_JPATH_TYPE, data_input_util.CKPT_JPATH_TYPE,
        data_input_util.CKPT_VAR_NAME_TYPE, data_input_util.CKPT_ENABLE_TYPE,
        data_input_util.CKPT_SOURCE_TIME_FORMAT_TYPE,
        data_input_util.CKPT_TARGET_TIME_FORMAT_TYPE,
        data_input_util.CKPT_INIT_VALUE_TYPE
    ]

    VAR_TYPE_MAPPING = {
        'dropdownlist': 'singleSelect',
        'multi_dropdownlist': 'multipleSelect',
        'radiogroup': 'radio',
        'global_account': 'singleSelect',
        'text': 'text',
        'password': 'text',
        'checkbox': 'checkbox'
    }

    @metric_util.function_run_time(tags=['datainput_builder'])
    def __init__(self,
                 appname,
                 uri,
                 session_key,
                 service_with_tab_context=None):
        self.__appname = appname
        self.__logger = logger.get_input_builder_logger()
        self.__uri = uri
        self.__session_key = session_key

        self.__conf_mgr_with_tab_context = common_util.create_conf_mgr(
            self.__session_key, self.__uri)
        self.__default_input_properties = {
            "index": "default",
            "sourcetype": "{}_sourcetype".format(self.__appname),
            "interval": 60,
            "use_external_validation": True,
            "streaming_mode_xml": True,
        }

        if not service_with_tab_context:
            service_with_tab_context = common_util.create_splunk_service(
                session_key, uri)
        self.__service_with_tab_context = service_with_tab_context
        self.__meta_mgr = meta_manager.create_meta_manager(
            session_key, uri, meta_const.DATA_INPUT_BUILDER, self.__appname)
        self.required_meta_keys = ['name', 'type', 'sourcetype']
        self.__alert_builder = None

    def set_alert_builder(self, builder):
        self.__alert_builder = builder

    def get_alert_names(self):
        if self.__alert_builder:
            return [i.get('short_name') for i in self.__alert_builder.get_all_TA_alerts()]
        else:
            self.__logger.error('Alert builder is not set in input meta manager.')
            return []

    def validate_input_name_and_sourcetype(self, meta):
        '''
        meta =
        {
            "uuid": uuid // when creating, no uuid yet.
            "name": name,
            "title": title,
            "description": description,
            "type": type,
            "sourcetype": sourcetype,
            "interval": interval,
        }
        Will not validate the custom variables for modular input
        '''
        is_update = 'uuid' in meta
        self._validate_basic_input_meta(meta, is_update)
        self._validate_input_name(
            meta.get('name', None),
            self.get_all_TA_inputs(), meta.get('uuid', None))

    def add_default_values(self, datainput):
        data_input_meta_new = copy.deepcopy(self.__default_input_properties)
        data_input_meta_new.update(datainput)
        return data_input_meta_new

    def get_all_TA_inputs(self):
        return self._get_inputs()

    @metric_util.function_run_time(tags=['datainput_builder'])
    def create_input_meta(self, datainput):
        self._validate_new_meta(datainput)

        datainputs = self._get_inputs()
        self._validate_input_name(datainput['name'], datainputs)
        self.__logger.debug("get data inputs meta from meta store:%s",
                            logger.hide_sensitive_field(datainputs))
        if self._input_exist(datainput, datainputs):
            e = CommonException()
            e.set_err_code(3011)
            e.set_option('name', datainput.get('name', ''))
            raise e

        data_input_meta = self.add_default_values(
            builder_util.add_unique_identification(datainput))
        datainputs.append(data_input_meta)
        self.__meta_mgr.set_app_meta_data({"datainputs": datainputs})

        return datainputs, data_input_meta

    @metric_util.function_run_time(tags=['datainput_builder'])
    def update_input_meta(self, datainput_new):
        self._validate_exist_meta(datainput_new)
        datainputs = self._get_inputs()
        uuid = datainput_new.get("uuid", None)
        if not uuid:
            raise Exception("uuid not found in meta {0}".format(datainput_new))
        if not self._input_exist(datainput_new, datainputs, use_uuid=True):
            raise Exception("Input dose not exist")

        self._validate_input_name(datainput_new['name'], datainputs, uuid)
        datainput_old = [
            oneinput for oneinput in datainputs if oneinput['uuid'] == uuid
        ][0]

        datainputs = list([oneinput for oneinput in datainputs if oneinput['uuid'] != uuid])
        if self._input_exist(datainput_new, datainputs):
            e = CommonException()
            e.set_err_code(3011)
            e.set_option('name', datainput_new.get('name', ''))
            raise e
        data_input_meta_new = self.add_default_values(datainput_new)
        datainputs.append(data_input_meta_new)
        self.__meta_mgr.set_app_meta_data({"datainputs": datainputs})
        return datainputs, datainput_old, data_input_meta_new

    @metric_util.function_run_time(tags=['datainput_builder'])
    def delete_input_meta(self, datainput):
        self._validate_exist_meta(datainput)
        datainputs_existed = self._get_inputs()
        if not self._input_exist(datainput, datainputs_existed):
            raise Exception("Input does not exist")

        def input_not_equal(oneinput):
            return oneinput['name'] != datainput['name']

        datainputs = list(filter(input_not_equal, datainputs_existed))
        self.__meta_mgr.set_app_meta_data({"datainputs": datainputs})

        return datainputs

    def get_all_sourcetypes(self):
        datainputs = self._get_inputs()
        return [_input['sourcetype'] for _input in datainputs]

    def get_input_summary(self):
        datainputs = self._get_inputs()
        sourcetype_count = 0
        input_count = 0
        for _input in datainputs:
            if 'sourcetype' in _input:
                sourcetype_count += 1
            input_count += 1
        return {
            'input_sourcetype_count': sourcetype_count,
            'input_count': input_count
        }

    def get_input_loaded_status(self):
        '''
        return a dict. the key is the input name, value is whether the input is loaded
        '''
        datainputs = self._get_inputs()
        input_loaded_status = {_input['name']: False for _input in datainputs}
        input_types = Collection(self.__service_with_tab_context,
                                 'data/inputs')
        for input_type in input_types:
            if input_type.name in input_loaded_status:
                input_loaded_status[input_type.name] = True
        return input_loaded_status

    def get_basic_info(self):
        """
        return None if there is no metadata, else
        {
            sourcetype: {
                data_input_name: str,
                data_input_type: str
            }
        }
        """
        ret = {}
        datainputs = self.__meta_mgr.get_app_meta_data()
        if not datainputs:
            return None

        datainputs = datainputs.get("datainputs", [])
        for _input in datainputs:
            sourcetype = _input.get("sourcetype", None)
            if sourcetype:
                ret[sourcetype] = {
                    "data_input_name": _input.get("name", None),
                    "data_input_type": _input.get("type", None)
                }
        return ret

    def set_customized_options(self, uuid, customized_options):
        datainputs_existed = self._get_inputs()
        for datainput in datainputs_existed:
            if datainput.get('uuid', None) == uuid:
                datainput['customized_options'] = customized_options
                self.__logger.info("set customized_options for data input. %s",
                                   logger.hide_sensitive_field(datainput))
        self.__meta_mgr.set_app_meta_data({"datainputs": datainputs_existed})

    def get_datainputs_and_kinds_for_conf(self, datainputs):
        datainputs = [
            _input for _input in datainputs
            if _input['type'] in data_input_util.ALL_INPUT_METHODS
        ]
        input_kinds = [i['name'] for i in datainputs]
        return self._filter_meta_for_input_conf(datainputs), input_kinds

    def _get_inputs(self):
        datainputs = self.__meta_mgr.get_app_meta_data() or {}
        return datainputs.get("datainputs", [])

    def _validate_basic_input_meta(self, meta, is_update=False):
        if common_util.contain_reserved_chars(meta.get('name', '')):
            e = CommonException()
            e.set_err_code(3015)
            raise e

        sourcetype = meta.get('sourcetype', None)
        if sourcetype is None:
            e = CommonException()
            e.set_err_code(3116)
            e.set_option('name', meta.get('name'))
            raise e

        if not is_update:
            st_builder = TASourcetypeBuilder(self.__appname, self.__uri,
                                             self.__session_key)
            if sourcetype in st_builder.get_all_sourcetype_names():
                e = CommonException()
                e.set_err_code(3010)
                e.set_option('sourcetype', sourcetype)
                raise e
            # splunk may not restart yet. TA is not load. so, use the conf mgr
            # with tab context
            sourcetype_existed = self.__conf_mgr_with_tab_context.get_conf(
                "props").get_all()
            if sourcetype in sourcetype_existed:
                self.__logger.error(
                    "Error when validating meta: %s, Error: sourcetype exists.",
                    logger.hide_sensitive_field(meta))
                e = CommonException()
                e.set_err_code(3012)
                e.set_option('sourcetype', sourcetype)
                raise e

    def _validate_customized_vars(self, datainput):
        var_list = datainput.get('data_inputs_options', [])
        for v in var_list:
            if v.get('rest_header',
                     False) or v.get('type', '') in self.REST_CKPT_OPTIONS:
                continue
            if 'name' not in v:
                self.__logger.error(
                    "name field is not found in customized option part:%s", v)
                ce = CommonException()
                ce.set_err_code(3130)
                raise ce
            else:
                name = v['name']
                t = v.get('type', '')
                if t == data_input_util.CUSTOMIZED_VAR_TYPE and TAInputMetaMgr.INPUT_PROPERTY_NAME_PATTERN.match(
                        name
                ) is None and name != TAInputMetaMgr.GLOBAL_ACCOUNT_NAME:
                    self.__logger.error(
                        "customized variable name:%s is not valid.", name)
                    ce = CommonException(err_code=3131)
                    ce.set_option('prop_name', name)
                    raise ce
                if name in TAInputMetaMgr.INPUT_RESERVED_PROPERTIES:
                    self.__logger.error(
                        "customized variable name:%s is in the reseved list.",
                        name)
                    ce = CommonException()
                    ce.set_err_code(3132)
                    ce.set_option('prop_name', name)
                    raise ce
                if t == data_input_util.CUSTOMIZED_VAR_TYPE:
                    for k in TAInputMetaMgr.CUSTOMIZED_VAR_REQUIRED_KEYS:
                        if k not in v:
                            emsg = 'Required field {} not found in customized variable.'.format(
                                k)
                            self.__logger.error(emsg)
                            ce = CommonException(
                                err_code=3144,
                                e_message=emsg,
                                options={'attribute': k})
                            raise ce

    @metric_util.function_run_time(tags=['datainput_builder'])
    def _validate_new_meta(self, meta, is_update=False):
        for k in self.required_meta_keys:
            if k not in meta:
                ce = CommonException(
                    e_message='{0} not found in meta {1}'.format(k, meta),
                    err_code=3137,
                    options={'property_name': k})
                raise ce

        self._validate_basic_input_meta(meta, is_update)

        self._validate_customized_vars(meta)
        input_type = meta['type']
        if input_type == 'customized':
            options = meta.get('data_inputs_options', [])
            options_existed = {}
            for option in options:
                if 'name' not in option:
                    raise Exception('name is not found for input option {0}'.
                                    format(option))
                else:
                    if option['name'] in options_existed:
                        e = CommonException()
                        e.set_err_code(3013)
                        e.set_option('name', option['name'])
                        raise e
                    else:
                        options_existed[option['name']] = True
        elif input_type == 'rest':
            options = meta.get('data_inputs_options', [])
            url_option_found = False
            method_option_found = False
            for option in options:
                if option.get(
                        'type', ''
                ) == data_input_util.CUSTOMIZED_VAR_TYPE or option.get(
                        'type', '') in self.REST_CKPT_OPTIONS:
                    continue
                if 'name' not in option:
                    raise Exception('name is not found for input option {0}'.
                                    format(option))
                if 'value' not in option:
                    raise Exception('value is not found for input option {0}'.
                                    format(option))
                if 'rest_header' not in option:
                    raise Exception(
                        'rest_handler is not found for input option {0}'.
                        format(option))
                if option['name'] == '_rest_api_url':
                    url_option_found = True
                if option['name'] == '_rest_api_method':
                    method_option_found = True
            if url_option_found is False:
                raise Exception('_rest_api_url option not found.')
            if method_option_found is False:
                raise Exception('_rest_api_method option not found.')
        elif input_type == 'command':
            options = meta.get('data_inputs_options', [])
            command_found = False
            for option in options:
                if option.get('type',
                              '') == data_input_util.CUSTOMIZED_VAR_TYPE:
                    continue
                if 'name' not in option:
                    raise Exception('name is not found for input option {0}'.
                                    format(option))
                if 'value' not in option:
                    raise Exception('value is not found for input option {0}'.
                                    format(option))
                if option['name'] == '_command':
                    command_found = True
                    break
            if command_found is False:
                raise Exception('command option is not found.')
        else:
            raise Exception('Invalid data input type: {0}'.format(input_type))

    def _validate_exist_meta(self, meta):
        self._validate_new_meta(meta, True)
        if "uuid" not in meta:
            ce = CommonException(
                e_message='{0} not found in meta {1}'.format('uuid', meta),
                err_code=3137,
                options={'property_name': 'uuid'})
            raise ce

    @metric_util.function_run_time(tags=['datainput_builder'])
    def _validate_input_name(self, name, all_inputs_meta, uuid=None):
        should_check_module_name = True
        if uuid:
            for _input in all_inputs_meta:
                if _input['uuid'] == uuid:
                    # if it is update request, and no name changes, do not check
                    # the module name, because there is a input python file
                    # there
                    should_check_module_name = (_input['name'] != name)

        if not name:
            ce = CommonException(
                e_message='data input name should not be empty.',
                err_code=3137,
                options={'property_name': 'name'})
            raise ce
        if name in TAInputMetaMgr.INPUT_RESERVED_NAMES:
            ce = CommonException(
                e_message='data input name is reserved.',
                err_code=3145,
                options={'input_name': name})
            raise ce
        if TAInputMetaMgr.INPUT_NAME_PATTERN.match(name) is None:
            ce = CommonException()
            ce.set_err_code(3133)
            raise ce
        if common_util.contain_reserved_chars(name):
            ce = CommonException()
            ce.set_err_code(3015)
            raise ce

        # for name conflicts, should tell if this is a update or an create
        need_check_input_name_conflict = True
        if uuid:
            input_meta = [
                meta for meta in all_inputs_meta if meta['uuid'] == uuid
            ]
            if not input_meta:
                ce = CommonException(
                    e_message='No input with uuid {}'.format(uuid),
                    err_code=3138)
                self.__logger.error(
                    'No input with uuid %s, validate input name fails.', uuid)
                raise ce
            input_meta = input_meta[0]
            if input_meta['name'] == name:
                # It is fine. No rename for input update
                need_check_input_name_conflict = False

        if need_check_input_name_conflict:
            # need to check name conflict when creating an input and renaming
            # the input
            loaded_modinputs = [
                i.name
                for i in self.__service_with_tab_context.modular_input_kinds
            ]
            modinputs_in_meta = [i['name'] for i in all_inputs_meta]
            name_exist = name in loaded_modinputs or name in modinputs_in_meta
            if name_exist:
                ce = CommonException()
                ce.set_err_code(3119)
                ce.set_option('name', name)
                raise ce

        try:
            if should_check_module_name:
                checked_module = importlib.import_module(name)
                if checked_module:
                    ce = CommonException(
                        e_message='Input name {} conflicts with existing python module name.'.
                        format(name),
                        err_code=3136,
                        options={'input_name': name})
                    raise ce
        except ImportError:
            # this is expected errors.
            self.__logger.debug('input name is valid. No package named %s',
                                name)
        # check if the input name conflicts with alert name
        if self.__alert_builder:
            self.__logger.debug('validate input name:%s', name)
            if self.__alert_builder.is_alert_exist(name):
                ce = CommonException(
                    e_message='Input name {} conflicts with an existing alert action name.'.
                    format(name),
                    err_code=3143,
                    options={'input_name': name})
                raise ce

    def _input_exist(self, input, datainputs, use_uuid=False):
        if use_uuid:
            uuid = input.get("uuid", None)
            if uuid is None:
                raise Exception("uuid is not specifies")
            # To do: check all uuids exist
            datainput_uuids = [
                datainput.get("uuid", None) for datainput in datainputs
            ]

            return uuid in datainput_uuids
        else:
            name = input.get('name', None)
            if name is None:
                raise Exception("name is not specifies")
            # To do: check all names exist
            datainput_names = [
                datainput.get("name", None) for datainput in datainputs
            ]
            return name in datainput_names

    def _filter_meta_for_input_conf(self, datainputs):
        '''
        filter the built-in input vars for the input_meta
        The returned meta are used to generate the inputs.conf and inputs.conf.spec
        @param: datainputs, a list of input metas
        @return: filtered_datainputs, a list of metas without built-in vars
        '''
        cloned_datainputs = copy.deepcopy(datainputs)
        filtered_datainputs = []
        for datainput in cloned_datainputs:
            input_type = datainput['type']
            if input_type == data_input_util.INPUT_METHOD_REST:
                datainput = data_input_util.process_cc_data_input_meta(
                    datainput)
            # clean up the data_inputs_options
            if input_type == data_input_util.INPUT_METHOD_REST or input_type == data_input_util.INPUT_METHOD_CMD:
                options = datainput['data_inputs_options']
                filtered_options = []
                for opt in options:
                    if opt.get('type',
                               '') == data_input_util.CUSTOMIZED_VAR_TYPE:
                        filtered_options.append(opt)
                if len(filtered_options) > 0:
                    datainput['data_inputs_options'] = filtered_options
                else:
                    datainput['data_inputs_options'] = [self.PLACEHOLDER_VAR]
            customized_options = [
                opt for opt in datainput.get('customized_options', [])
                if opt.get('name')
            ]
            datainput['customized_options'] = customized_options
            filtered_datainputs.append(datainput)

        return filtered_datainputs

    # method for Unit test
    def clear_meta(self):
        self.__meta_mgr.set_app_meta_data({"datainputs": []})

    # only used for upgrade, use with caution
    def set_meta(self, datainputs):
        self.__meta_mgr.set_app_meta_data({"datainputs": datainputs})

    def validate_new_meta(self, datainput, is_update=False):
        self._validate_new_meta(datainput, is_update)

    def get_ucc_input_meta(self):
        '''
        generate the input related meta structure for ucc
        The meta schema is in UCC doc.
        <<< https://git.splunk.com/projects/SOLN/repos/ta-ui-framework/browse/globalConfig.json >>>
        '''
        datainputs = self._get_inputs()
        if not datainputs:
            return {}

        ucc_input_meta = {
            "title": "Inputs",
            "description": "Manage your data inputs",
            "table": {
                "header": [{
                    "field": "name",
                    "label": "Name"
                }, {
                    "field": "interval",
                    "label": "Interval"
                }, {
                    "field": "index",
                    "label": "Index"
                }, {
                    "field": "disabled",
                    "label": "Status"
                }],
                "moreInfo": [],
                "actions": ["edit", "enable", "delete", "clone"]
            },
            "services": []
        }
        # generate the services
        service_list = []
        more_info_fields = [{
            'field': 'name',
            'label': 'Name'
        }, {
            'field': 'interval',
            'label': 'Interval'
        }, {
            'field': 'index',
            'label': 'Index'
        }, {
            'field': 'disabled',
            'label': 'Status'
        }]
        more_info_field_names = set()
        more_info_field_names.add('name')
        more_info_field_names.add('interval')
        more_info_field_names.add('index')
        more_info_field_names.add('disabled')
        for _input in datainputs:
            service = {
                'name': _input['name'],
                'title': _input.get('title', _input['name']),
                'entity': [{
                    'field': 'name',
                    'label': 'Name',
                    'type': 'text',
                    'help': 'Enter a unique name for the data input',
                    'required': True,
                    'validators': [{
                        'type': 'regex',
                        'pattern': '^[a-zA-Z]\\w*$',
                        'errorMsg':
                        'Input Name must start with a letter and followed by alphabetic letters, digits or underscores.'
                    }, {
                        'type': 'string',
                        'minLength': 1,
                        'maxLength': 100,
                        'errorMsg':
                        'Length of input name should be between 1 and 100'
                    }]
                }]
            }
            if not _input.get('is_single_instance', False):
                service['entity'].append({
                    'field': 'interval',
                    'label': 'Interval',
                    'type': 'text',
                    'required': True,
                    'help': 'Time interval of input in seconds.',
                    'validators': [{
                        'type': 'regex',
                        'pattern': '^\\-[1-9]\\d*$|^\\d*$',
                        'errorMsg': 'Interval must be an integer.'
                    }]
                })
            service['entity'].append({
                'field': 'index',
                'label': 'Index',
                'type': 'singleSelect',
                'defaultValue': 'default',
                'options': {
                    'endpointUrl': 'data/indexes',
                    'blackList': '^_.*$',
                    'createSearchChoice': True
                },
                'required': True,
                'validators': [{
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80,
                    "errorMsg":
                    "Length of index name should be between 1 and 80."
                }]
            })
            for input_opt in _input['data_inputs_options']:
                if input_opt.get('type',
                                 '') == data_input_util.CUSTOMIZED_VAR_TYPE:
                    opt_name = input_opt['name']
                    if opt_name not in more_info_field_names:
                        more_info_fields.append({
                            'field': input_opt['name'],
                            'label': input_opt.get('title', input_opt['name'])
                        })
                        more_info_field_names.add(opt_name)
                    entity = TAInputMetaMgr.convert_customized_var_to_entity(
                        input_opt)
                    service['entity'].append(entity)
            # process the checkpoint name
            # because the checkpoint name is a var for modular input
            ckpt_var_opt = data_input_util.get_ckpt_var_options(_input)
            if ckpt_var_opt:
                ckpt_var_opt['default_value'] = '' # reset default value
                service['entity'].append(
                    TAInputMetaMgr.convert_customized_var_to_entity(
                        ckpt_var_opt))
                service['entity'].append(
                    TAInputMetaMgr.convert_customized_var_to_entity(
                        data_input_util.get_ckpt_type_options()))
                more_info_fields.append({
                    'field': ckpt_var_opt['name'],
                    'label': ckpt_var_opt['title']
                })
            service_list.append(service)
        ucc_input_meta['table']['moreInfo'] = more_info_fields
        ucc_input_meta['services'] = service_list
        return ucc_input_meta

    @staticmethod
    def convert_customized_var_to_entity(var_options):
        v_name = var_options['name']
        entity = {
            'field': v_name,
            'label': var_options.get('title', v_name),
            'help': var_options.get('description', ''),
            'required': var_options.get('required_on_create', False)
        }

        opt_type = var_options['format_type']
        entity['type'] = TAInputMetaMgr.VAR_TYPE_MAPPING[opt_type]
        default_value = var_options.get('default_value', None)
        if default_value:
            # default value is a list for multi dropdown type and string for other types
            if type(default_value) == list:
                if len(default_value) > 0:
                    entity['defaultValue'] = "~".join(default_value)
                else:
                    entity['defaultValue'] = ""
            else:
                entity['defaultValue'] = default_value
        if opt_type == 'password':
            entity['encrypted'] = True
            entity['validators'] = [{
                'type': 'string',
                'minLength': 0,
                'maxLength': 8192,
                'errorMsg': 'Max length of password is 8192'
            }]
        elif opt_type == 'text':
            entity['validators'] = [{
                'type': 'string',
                'minLength': 0,
                'maxLength': 8192,
                'errorMsg': 'Max length of text input is 8192'
            }]
        elif opt_type == 'dropdownlist':
            opt = {
                'disableSearch': True,
                'autoCompleteFields': [{
                    'value': possible_value['value'],
                    'label': possible_value.get('label', '')
                } for possible_value in var_options.get('possible_values', [])
                                       if possible_value.get('value')]
            }
            entity['options'] = opt
        elif opt_type == 'multi_dropdownlist':
            opt = {
                'delimiter': '~',
                'items': [{
                    'value': possible_value['value'],
                    'label': possible_value.get('label', '')
                } for possible_value in var_options.get('possible_values', [])
                          if possible_value.get('value')]
            }
            entity['options'] = opt
        elif opt_type == 'global_account':
            entity['options'] = {'referenceName': 'account'}
        elif opt_type == 'radiogroup':
            opt = {
                'items': [{
                    'value': possible_value['value'],
                    'label': possible_value.get('label', '')
                } for possible_value in var_options.get('possible_values', [])
                          if possible_value.get('value')]
            }
            entity['options'] = opt

        # update the placeholder
        if var_options.get('placeholder'):
            opt = {'placeholder': var_options.get('placeholder')}
            if 'options' in entity:
                entity['options'].update(opt)
            else:
                entity['options'] = opt
        return entity
