# encoding = utf-8

from builtins import str
from builtins import object
import json
import os
import shutil
import platform
import traceback

from aob.aob_common import logger
from tabuilder_utility import builder_exception, data_input_util, common_util
from ta_generator import ta_configuration_meta
from aob.aob_common.metric_collector import metric_util
from ta_generator.ta_configuration_meta import GlobalSettingMeta
'''
Initialize the builder with one cc data input meta. Input meta is a dict like this

{
    "uuid": uuid, // this is populated by input builder
    "disabled": True/False,
    "sourcetype": "test",
    "index": "default",
    "name": "test",
    "title": "test",
    "description": "",
    "interval": "30",
    "type": "rest",  // this is very important, for cc input, it must be rest
    "data_inputs_options": [{
        // _rest_api_url and _rest_api_method is hard coded and required
        // For _rest_api_url and _rest_api_method, the rest_header is not checked. they are hard coded
        "name": "_rest_api_url",
        "value": "xxxxx",
        "rest_header": false
    }, {
        "name": "header_key1",
        "value": "xxxxx",
        "rest_header": true  // if rest_header is true. This means the key-value is in header
    }, {
        "name": "body_key1",
        "value": "xxxxx",
        "rest_header": false // if rest_header is false, this means the key-value is in rest payload
    }, {
        "type": "event_json_path_key",
        "name": "_event_json_path_key", // name is not important here
        "value": "xxxx"
    }, {
        "type": "ckpt_json_path_key",
        "name": "_ckpt_json_path_key", // name is not important here
        "value": "xxxx"
    }, {
        "type": "ckpt_var_name",
        "name": "_ckpt_var_name", // name is not important here
        "value": "xxx"
    }, {
        "type": "ckpt_initial_value",
        "name": "_ckpt_initial_value", // name is not important here
        "value": "xxx"
    }, {
        "type": "ckpt_enable",
        "name": "_ckpt_enable", // name is not important here
        "value": True/False
    }, {
        "type": "ckpt_source_time_format",
        "name": "_ckpt_source_time_format", // name is not important here
        "value": "YYYY-mm-dd"
    }, {
        "type": "ckpt_target_time_format",
        "name": "_ckpt_target_time_format", // name is not important here
        "value": "YYYY-dd-mm"
    }, {
        "type": "customized_var",  // if type is customized_var, this is data input variable
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
}

'''


class CloudConnectDataInputBuilder(object):
    '''
    When init this object, the input_meta should be processed by data_input_util.process_cc_data_input_meta
    Because we will move the ckpt to the customized var options and also process the mako template string
    '''

    @metric_util.function_run_time(tags=['cloud_connect_input_builder'])
    def __init__(self, input_meta, global_settings_meta):
        '''
        input_meta is a dict which contain the input meta data
        global_settings_meta is a dict
        '''
        self._global_proxy_setting_enabled = (
            GlobalSettingMeta.PROXY_SETTING_KEY in global_settings_meta)
        self._global_log_setting_enabled = (
            GlobalSettingMeta.LOG_LEVEL_SETTING_KEY in global_settings_meta)
        var_list = global_settings_meta.get(
            GlobalSettingMeta.CUSTOMIZED_SETTING_KEY, [])
        self._customized_var_names_and_types = {
            v['name']: v['type']
            for v in var_list
        }
        self._meta = input_meta
        self._logger = logger.get_input_builder_logger()
        # begin to parse the meta
        self._headers = {}
        self._payload = {}
        self._event_jpath_key = None
        self._ckpt_enable = False
        self._ckpt_time_format_enabled = False
        self._ckpt_jpath_key = None
        self._ckpt_var_name = None
        self._ckpt_source_time_format = None
        self._ckpt_target_time_format = None
        self._rest_url = None
        self._rest_method = None
        self._ckpt_init_value = ''
        for option in self._meta.get('data_inputs_options', []):
            opt_type = option.get('type')
            if opt_type == data_input_util.CUSTOMIZED_VAR_TYPE:
                continue
            elif opt_type == data_input_util.EVENT_JPATH_TYPE:
                self._event_jpath_key = option.get('value', '').strip()
            elif opt_type == data_input_util.CKPT_JPATH_TYPE:
                self._ckpt_jpath_key = option.get('value', '').strip()
            elif opt_type == data_input_util.CKPT_VAR_NAME_TYPE:
                self._ckpt_var_name = option.get('value', '').strip()
            elif opt_type == data_input_util.CKPT_INIT_VALUE_TYPE:
                self._ckpt_init_value = option.get('value', '').strip()
            elif opt_type == data_input_util.CKPT_ENABLE_TYPE:
                self._ckpt_enable = option.get('value', False)
            elif opt_type == data_input_util.CKPT_SOURCE_TIME_FORMAT_TYPE:
                self._ckpt_source_time_format = option.get('value', '').strip()
            elif opt_type == data_input_util.CKPT_TARGET_TIME_FORMAT_TYPE:
                self._ckpt_target_time_format = option.get('value', '').strip()
            else:
                opt_name = option['name']
                if opt_name == data_input_util.REST_METHOD_NAME:
                    self._rest_method = str(option.get('value')).upper()
                elif opt_name == data_input_util.REST_URL_NAME:
                    self._rest_url = data_input_util.convert_mako_template_string_to_jinja2_template(
                        option.get('value'))
                else:
                    opt_name = data_input_util.convert_mako_template_string_to_jinja2_template(
                        option['name'])
                    opt_value = data_input_util.convert_mako_template_string_to_jinja2_template(
                        option['value'])
                    if option.get(data_input_util.REST_HEADER_KEY, False):
                        self._headers[opt_name] = opt_value
                    else:
                        self._payload[opt_name] = opt_value

        self._ckpt_time_format_enabled = self._ckpt_source_time_format and self._ckpt_target_time_format
        if not self._ckpt_enable:
            self._ckpt_var_name = None
            self._ckpt_jpath_key = None
            self._ckpt_init_value = None
            self._ckpt_source_time_format = None
            self._ckpt_target_time_format = None
            self._ckpt_time_format_enabled = False

        if not self._event_jpath_key or self._event_jpath_key == '$':
            self._event_jpath_key = '$'
        else:
            self._event_jpath_key = '$.' + self._event_jpath_key
        if not self._ckpt_jpath_key or self._ckpt_jpath_key == '$':
            self._ckpt_jpath_key = '$'
        else:
            self._ckpt_jpath_key = '$.' + self._ckpt_jpath_key

        # the following logic is used for testing modular input
        self._enable_proxy_in_dryrun = False
        self._enable_logging_in_dryrun = False
        self._customized_var_names_and_types_in_dryrun = {}
        if 'test_id' in input_meta:
            # if dry run the input, get the global setting meta from the input meta
            test_global_settings = input_meta.get('global_settings', {})
            self._enable_proxy_in_dryrun = ta_configuration_meta.GlobalSettingMeta.PROXY_SETTING_KEY in test_global_settings
            self._enable_logging_in_dryrun = ta_configuration_meta.GlobalSettingMeta.LOG_LEVEL_SETTING_KEY in test_global_settings
            self._customized_var_names_and_types_in_dryrun = dict()
            for v in test_global_settings.get(
                    ta_configuration_meta.GlobalSettingMeta.
                    CUSTOMIZED_SETTING_KEY, []):
                if v.get('name') and v.get('type'):
                    self._customized_var_names_and_types_in_dryrun[v[
                        'name']] = v['type']

    def _get_cc_parameters(self, is_dryrun):
        parameters = []
        if (not is_dryrun and self._global_log_setting_enabled) or (
                is_dryrun and self._enable_logging_in_dryrun):
            parameters = parameters + ['__settings__.logging.loglevel']
        if (not is_dryrun and self._global_proxy_setting_enabled) or (
                is_dryrun and self._enable_proxy_in_dryrun):
            parameters = parameters + [
                '__settings__.proxy.proxy_enabled',
                '__settings__.proxy.proxy_url',
                '__settings__.proxy.proxy_port',
                '__settings__.proxy.proxy_type',
                '__settings__.proxy.proxy_username',
                '__settings__.proxy.proxy_rdns',
                '__settings__.proxy.proxy_password'
            ]
        # append global var as token
        var_types = self._customized_var_names_and_types_in_dryrun if is_dryrun else self._customized_var_names_and_types
        for n, t in list(var_types.items()):
            if t == 'global_account':
                parameters.append('__settings__.additional_parameters.' + n +
                                  '.username')
                parameters.append('__settings__.additional_parameters.' + n +
                                  '.password')
            else:
                parameters.append('__settings__.additional_parameters.' + n)

        for option in self._meta.get('data_inputs_options', []):
            if option.get('type') != data_input_util.CUSTOMIZED_VAR_TYPE:
                continue
            if option.get('format_type') == 'global_account':
                parameters += [
                    option['name'] + '.username', option['name'] + '.password'
                ]
            else:
                parameters.append(option['name'])
        # process the ckpt variable here.
        if self._ckpt_enable:
            parameters.append(self._ckpt_var_name)
        return parameters

    def _get_cc_json_basic_part(self, is_dryrun):
        '''
        basic part of the cc json. It can be used both in dryrun and final version
        '''
        global_settings = {}
        if (not is_dryrun and self._global_proxy_setting_enabled) or (
                is_dryrun and self._enable_proxy_in_dryrun):
            global_settings['proxy'] = {
                'enabled': '{{__settings__.proxy.proxy_enabled}}',
                'host': '{{__settings__.proxy.proxy_url}}',
                'port': '{{__settings__.proxy.proxy_port}}',
                'username': '{{__settings__.proxy.proxy_username}}',
                'password': '{{__settings__.proxy.proxy_password}}',
                'rdns': '{{__settings__.proxy.proxy_rdns}}',
                'type': '{{__settings__.proxy.proxy_type}}'
            }
        if (not is_dryrun and self._global_log_setting_enabled) or (
                is_dryrun and self._enable_logging_in_dryrun):
            global_settings['logging'] = {
                'level': '{{__settings__.logging.loglevel}}'
            }
        else:
            global_settings['logging'] = {
                'level': 'INFO'  # hard code INFO as the log level
            }
        return {
            'meta': {
                'apiVersion': '1.0.0'
            },
            'tokens': self._get_cc_parameters(is_dryrun),
            'global_settings': global_settings
        }

    def _get_rest_auth(self):
        use_basic_auth = common_util.is_true(
            self._meta.get('use_basic_auth', False))
        if use_basic_auth:
            for option in self._meta.get('data_inputs_options', []):
                if option.get(
                        'type'
                ) == data_input_util.CUSTOMIZED_VAR_TYPE and option.get(
                        'format_type') == 'global_account':
                    return {
                        'auth': {
                            'type': 'basic_auth',
                            'options': {
                                'username':
                                '{{' + option['name'] + '.username}}',
                                'password':
                                '{{' + option['name'] + '.password}}'
                            }
                        }
                    }
        return None

    def _get_request_option(self):
        req_options = {"url": self._rest_url, "method": self._rest_method}
        req_options['headers'] = self._headers
        if self._payload:
            req_options['body'] = self._payload
        auth = self._get_rest_auth()
        if auth:
            req_options.update(auth)
        return {'request': req_options}

    def _get_request_pre_process(self):
        pipeline_list = []
        if self._ckpt_enable and self._ckpt_var_name:
            pipeline_list.append({
                "input": ['{{' + self._ckpt_var_name + '}}'],
                "method": "set_var",
                "output": "_raw_" + self._ckpt_var_name
            })

        if self._ckpt_enable and self._ckpt_time_format_enabled and self._ckpt_var_name:
            pipeline_list.append({
                    'input': [
                        '{{' + self._ckpt_var_name + '}}',
                        self._ckpt_source_time_format,
                        self._ckpt_target_time_format
                    ],
                    'method': 'time_str2str',
                    'output': self._ckpt_var_name
            })

        return {
            'pre_process': {
                'skip_conditions': [],
                'pipeline': pipeline_list
            }
        }

    def _get_request_post_process(self, is_dryrun):
        # if it is dryrun, always get the raw response back
        event_jpath_key = '$' if is_dryrun else self._event_jpath_key

        pipeline_list = [{'input': ['{{__stdout__}}'], 'method': 'std_output'}]
        if event_jpath_key == '$':
            pipeline_list = [{
                'input': [
                    '{{__response__.body}}',
                    '',  # this should be the _time
                    '{{index}}',
                    '{{host}}',
                    '{{source}}',
                    '{{sourcetype}}'
                ],
                'method': 'splunk_xml',
                'output': '__stdout__'
            }] + pipeline_list
        else:
            pipeline_list = [
                {
                    'input': ['{{__response__.body}}', event_jpath_key],
                    'method': 'json_path',
                    'output': '__stdout__'
                },
                {
                    'input': [
                        '{{__stdout__}}',
                        '',  # this should be the _time
                        '{{index}}',
                        '{{host}}',
                        '{{source}}',
                        '{{sourcetype}}'
                    ],
                    'method': 'splunk_xml',
                    'output': '__stdout__'
                }
            ] + pipeline_list
        # extract the ckpt vars
        if self._ckpt_enable and self._ckpt_jpath_key and self._ckpt_var_name:
            ckpt_pipeline = []
            ckpt_pipeline.append({
                'input': ['{{__response__.body}}', self._ckpt_jpath_key],
                'method': 'json_path',
                'output': self._ckpt_var_name
            })
            ckpt_pipeline.append({
                'input': [
                    "{{" + self._ckpt_var_name + " != ''" + "}}",
                    "The value of token '" + self._ckpt_var_name + "' extracted from response cannot be empty!"
                ],
                'method': "assert_true"
            })
            ckpt_pipeline.append({
                'input': [
                    '{{' + self._ckpt_var_name + " == " + "_raw_" + self._ckpt_var_name + '}}',
                ],
                'method': "exit_if_true"
            })
            ckpt_pipeline.append({
                "input": ['{{' + self._ckpt_var_name + '}}'],
                "method": "set_var",
                "output": "_raw_" + self._ckpt_var_name
            })
            pipeline_list = ckpt_pipeline + pipeline_list

        return {
            'post_process': {
                'skip_conditions': [{
                    'input': ['{{__response__.body}}', event_jpath_key],
                    'method': 'json_empty'
                }],
                'pipeline': pipeline_list
            }
        }

    def _get_iteration_mode(self, is_dryrun):
        iteration_mode_json = None
        if is_dryrun:
            iteration_mode_json = {
                'iteration_mode': {
                    'iteration_count': '1',
                    'stop_conditions': []
                }
            }
        else:
            iteration_count = 1
            if self._ckpt_enable and self._ckpt_var_name:
                #TODO: we can put some configuration value in the AoB
                # if ckpt is enabled, we will try to collect 100 times in each interval
                iteration_count = 100
            iteration_mode_json = {
                'iteration_mode': {
                    # set 100 here, in case wrong json causes infinite loop
                    'iteration_count': str(iteration_count),
                    'stop_conditions': []
                }
            }
        if self._event_jpath_key and self._event_jpath_key != '$':
            iteration_mode_json['iteration_mode']['stop_conditions'].append({
                'input': ['{{__response__.body}}', self._event_jpath_key],
                'method': 'json_empty'
            })

        return iteration_mode_json

    def _get_ckpt(self):
        if self._ckpt_var_name:
            return {
                'checkpoint': {
                    # 'namespace': ['{{name}}'], TAB-1984. Do not set the namespace for ckpt
                    'content': {
                        self._ckpt_var_name: '{{_raw_' + self._ckpt_var_name + '}}'
                    }
                }
            }
        else:
            return None

    def _get_request_part(self, is_dryrun):
        req = {'pre_process': {}}
        req.update(self._get_request_option())
        req.update(self._get_request_pre_process())
        req.update(self._get_request_post_process(is_dryrun))
        req.update(self._get_iteration_mode(is_dryrun))
        if not is_dryrun:
            ckpt = self._get_ckpt()
            if ckpt:
                req.update(ckpt)
        return [req]

    def get_cc_json_file_path(self, target_dir, is_dryrun):
        basename_template = '{}_dryrun.cc.json' if is_dryrun else '{}.cc.json'
        json_file_name = os.path.join(
            target_dir, basename_template.format(self._meta['name']))
        if platform.system() == "Windows":
            # have to put more slashes to avoid char escape
            json_file_name = json_file_name.replace('\\', '\\\\')
        return json_file_name

    @metric_util.function_run_time(tags=['cloud_connect_input_builder'])
    def generate_cc_input_json(self, target_dir, is_dryrun):
        '''
        Dryrun code is different from the final code.
        CC does not provide test mode. AoB has to do this.
        :param target_dir: the directory to store the CC json file
        :return: return the json file path
        '''
        if not os.path.isdir(target_dir):
            raise Exception('Directory {} not found'.format(target_dir))

        json_file_name = None
        try:
            cc_json = self._get_cc_json_basic_part(is_dryrun)
            cc_json['requests'] = self._get_request_part(is_dryrun)
            json_file_name = self.get_cc_json_file_path(target_dir, is_dryrun)
            with open(json_file_name, 'w') as fp:
                json.dump(cc_json, fp, indent=4)
            self._logger.debug('Generate cc json:%s. is_dryrun:%s', cc_json,
                               is_dryrun)
        except Exception as e:
            self._logger.error('Error when generating cc json:%s. %s', cc_json,
                               traceback.format_exc())
            if json_file_name and os.path.isfile(json_file_name):
                os.remove(json_file_name)
                json_file_name = None
        return json_file_name

    def get_cc_python_file_path(self, target_dir):
        basename = self._meta['name']
        return os.path.join(target_dir, basename + '.py')

    @metric_util.function_run_time(tags=['cloud_connect_input_builder'])
    def save_cc_input(self, resource_dir, target_dir):
        '''
        Generate the CC input python code and json schema
        For inputs.conf and inputs.conf.spec. let ta_input_builder to handle it

        :param resource_dir: the resource file directory
        :param target_dir: the target dir to store the python and json
        :param is_dryrun: boolean, if dryrun is enabled
        '''
        try:
            self.generate_cc_input_json(target_dir, False)
            # generate the py
            cc_py_file = self.get_cc_python_file_path(target_dir)
            shutil.copy(
                os.path.join(resource_dir, 'bin', 'cc_input.py.template'),
                cc_py_file)
        except Exception as e:
            cc_json = self.get_cc_json_file_path(target_dir, False)
            if os.path.isfile(cc_json):
                os.remove(cc_json)
            cc_py = self.get_cc_python_file_path(target_dir)
            if os.path.isfile(cc_py):
                os.remove(cc_py)
            raise e

    @metric_util.function_run_time(tags=['cloud_connect_input_builder'])
    def process_cc_input_dry_run_result(self, return_code, raw_stdout,
                                        raw_stderr):
        '''
        Process the CC data input dry run results.
        Now, when dryrun CC input. We use the low level client. If error happens, the client
        throws exception out. Then, we just need to use the raw_stderr as the err message

        if any error happens, an exception is thrown
        :return: return a dict, which contains the dryrun result of CC input.
        {
            'status': 'success/fail',
            // a list of results, each result is a python dict
            'results': [event1, event2, event3],
            error: 'error messages'
        }
        '''
        self._logger.debug(
            'Process the testing result of CC data input. ret:%s, stdout:%s, stderr:%s',
            return_code, raw_stdout, raw_stderr)
        if return_code == 0:
            results = data_input_util.parse_MI_output_xml(raw_stdout)
            error_log = data_input_util.grep_last_error_log(raw_stderr)
            if error_log:
                return {'status': 'fail', 'results': results, 'error': error_log}
            else:
                return {'status': 'success', 'results': results}
        else:
            # system error
            return {'status': 'fail', 'error': raw_stderr}

    @metric_util.function_run_time(tags=['cloud_connect_input_builder'])
    def delete_cc_input(self, target_dir):
        '''
        :param target_dir: target dir is the dir which contains the py and json file. normally, it is the bin folder.
        delete the cc input python file and the json file
        '''
        to_be_deleted = [
            self.get_cc_json_file_path(target_dir, False),
            self.get_cc_python_file_path(target_dir)
        ]
        for f in to_be_deleted:
            if os.path.isfile(f):
                self._logger.info('Delete the CC related file:%s', f)
                os.remove(f)
