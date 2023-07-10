from builtins import str
from builtins import object
import traceback
import copy

from aob.aob_common.metric_collector import metric_util
from ta_meta_management import meta_const, meta_manager
from ta_generator import input_meta_util
from aob.aob_common import logger, global_setting_util
from tabuilder_utility import common_util
from tabuilder_utility.builder_exception import CommonException
from splunktaucclib.global_config import GlobalConfig, GlobalConfigSchema

'''
global setting meta data structure
The values comes from the the user inputs.

{
  "credential_settings": [{
      "username": "user1",
      "password": ""
    },{
      "username": "user2",
      "password": ""
    }],
  "proxy_settings": {
    "proxy_rdns": "1",
    "proxy_port": "8888",
    "proxy_enabled": "1",
    "proxy_password": "admin",
    "proxy_username": "admin",
    "disabled": "0",
    "proxy_type": "http",
    "proxy_url": "10.66.144.2"
  },
  "customized_settings": [{
        "required": false,
        "name": "text",
        "label": "Text",
        "default_value": "",
        "placeholder": "",
        "help_string": "",
        "type": "text", //Please use this field in new API.
        "format_type": "text", //This is to keep backward compatibility.
        "value": "test"
    }, {
        "required": false,
        "name": "password",
        "label": "Password",
        "placeholder": "",
        "default_value": "",
        "help_string": "",
        "type": "password",
        "format_type": "password",
        "value": "test"
    }, {
        "required": false,
        "name": "checkbox",
        "label": "Checkbox",
        "default_value": "",
        "help_string": "",
        "type": "checkbox",
        "format_type": "checkbox",
        "value": 1
    }],
  "log_settings": {
    "log_level": "INFO",
    "disabled": "0"
  }
}

'''


class GlobalSettingMeta(object):
    CREDENTIAL_SETTING_KEY = 'credential_settings'
    PROXY_SETTING_KEY = 'proxy_settings'
    CUSTOMIZED_SETTING_KEY = 'customized_settings'
    LOG_LEVEL_SETTING_KEY = 'log_settings'
    CUSTOMIZED_SETTING_UI_NAME = 'additional_parameters'

    UCC_SCHEMA_VERSION = '3.0.0'

    CUSTOMIZED_VAR_REQUIRED_KEYS = ['label', 'type', 'name', 'required']
    # fix bug https://jira.splunk.com/browse/TAB-1983
    RESERVED_CUSTOMIZED_VAR_NAMES = [
        'disabled', 'url', 'headers', 'name', 'output_mode', 'output_field',
        'owner', 'app', 'sharing'
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

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def __init__(self, appname, service_with_tab_context):
        self._logger = logger.get_global_settings_builder_logger()
        self._appname = appname
        self._app_namespace = global_setting_util.get_app_namespace(
            self._appname)
        self._service_with_tab_context = service_with_tab_context
        self._meta_mgr = meta_manager.create_meta_manager_with_service(
            self._service_with_tab_context, meta_const.GLOBAL_SETTINGS_BUILDER,
            self._appname)
        self._input_meta_mgr = input_meta_util.TAInputMetaMgr(
            self._appname,
            common_util.get_splunkd_uri(self._service_with_tab_context),
            self._service_with_tab_context.token,
            service_with_tab_context=self._service_with_tab_context)

    @property
    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def meta(self):
        meta = self._meta_mgr.get_app_meta_data('global_settings')
        self._logger.debug('get global setting meta from meta store: %s', logger.hide_sensitive_field(meta))
        if meta:
            return meta
        else:
            return {}

    @meta.setter
    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def meta(self, new_meta):
        if new_meta:
            self._logger.debug('save global setting meta:%s', logger.hide_sensitive_field(new_meta))
            self._meta_mgr.set_app_meta_data({'global_settings': new_meta})
        else:
            self.delete_global_settings_meta()

    def is_global_setting_enabled(self):
        return True if self.meta else False

    @property
    def is_log_setting_enabled(self):
        m = self.meta
        return self.LOG_LEVEL_SETTING_KEY in m

    @property
    def is_proxy_setting_enabled(self):
        m = self.meta
        return self.PROXY_SETTING_KEY in m

    @property
    def customized_var_names_and_types(self):
        '''
        return a dict, name is the key, type is the value
        '''
        var_list = self.meta.get(self.CUSTOMIZED_SETTING_KEY, [])
        return {v['name']: v['type'] for v in var_list}

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def delete_global_settings_meta(self):
        self._meta_mgr.delete_app_meta_data()

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def validate_global_setting_meta(self, meta):
        try:
            if self.CUSTOMIZED_SETTING_KEY in meta:
                cus_setting = meta[self.CUSTOMIZED_SETTING_KEY]
                for setting in cus_setting:
                    for k in self.CUSTOMIZED_VAR_REQUIRED_KEYS:
                        if k not in setting:
                            emsg = 'Required field {} not found in customized variable {}.'.format(
                                k, logger.hide_sensitive_field(setting))
                            self._logger.error(emsg)
                            raise CommonException(
                                err_code=11001,
                                options={
                                    'field': k,
                                    'v_name': setting.get('name', 'unknown')
                                },
                                e_message=emsg)
                    if setting['name'] in self.RESERVED_CUSTOMIZED_VAR_NAMES:
                        emsg = 'Global variable name can not be {}.'.format(
                            setting['name'])
                        self._logger.error(emsg)
                        raise CommonException(
                            err_code=11006,
                            options={'var_name': setting['name']},
                            e_message=emsg)
        except CommonException as ce:
            raise ce
        except Exception as e:
            self._logger.error('validate global setting meta fails. %s',
                               traceback.format_exc())
            raise CommonException(
                e_message=e.message,
                err_code=11000,
                options={'message': e.message})

    @property
    def global_account_conf_name(self):
        return global_setting_util.get_global_account_conf_file_name(
            self._appname)

    @property
    def global_settings_conf_name(self):
        return global_setting_util.get_global_settings_conf_file_name(
            self._appname)

    # methods to generate the UCC meta
    def _get_ucc_basic_meta(self):
        current_app = self._service_with_tab_context.apps[self._appname]
        ucc_basic_meta = {
            "name": self._appname,
            "displayName": current_app.content['label'],
            # version is optional
            "version": current_app.content.get('version', 'unknown'),
            "apiVersion": self.UCC_SCHEMA_VERSION,
            "restRoot": self._app_namespace
        }
        return ucc_basic_meta

    def _get_ucc_account_page_meta(self):
        # if the user credential is enabled, enable the acount page
        return {
            "name": "account",
            "title": "Account",
            "table": {
                "header": [{
                    "field": "name",
                    "label": "Account name",
                }, {
                    "field": "username",
                    "label": "Username"
                }],
                "actions": ["edit", "delete", "clone"]
            },
            "entity": [
                {
                    "field": "name",
                    "label": "Account name",
                    "type": "text",
                    "required": True,
                    "help": "Enter a unique name for this account.",
                    "validators": [{
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 50,
                        "errorMsg": "Length of Account name should be between 1 and 50"
                    }, {
                        "type": "regex",
                        "pattern": "^[a-zA-Z]\\w*$",
                        "errorMsg":
                        "Account name must start with a letter and followed by alphabetic letters, digits or underscores."
                    }]
                },
                {
                    "field": "username",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                    "help": "Enter the username for this account.",
                    "options": {
                        "placeholder": "Enter the username here"
                    },
                    "validators": [{
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 200,
                        "errorMsg":
                        "Length of username should be between 1 and 200"
                    }]
                },
                {
                    "field": "password",
                    "label": "Password",
                    "type": "text",
                    "encrypted": True,
                    "required": True,
                    "help": "Enter the password for this account.",
                    "validators": [{
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 8192,  # password max length is 8k
                        "errorMsg":
                        "Length of password should be between 1 and 8192"
                    }]
                }
            ]
        }

    def _get_ucc_logging_page_meta(self):
        return {
            "name": "logging",
            "title": "Logging",
            "entity": [{
                "field": "loglevel",
                "label": "Log level",
                "type": "singleSelect",
                "options": {
                    "disableSearch": True,
                    "autoCompleteFields": [{
                        "label": "DEBUG",
                        "value": "DEBUG"
                    }, {
                        "label": "INFO",
                        "value": "INFO"
                    }, {
                        "label": "WARNING",
                        "value": "WARNING"
                    }, {
                        "label": "ERROR",
                        "value": "ERROR"
                    }, {
                        "label": "CRITICAL",
                        "value": "CRITICAL"
                    }]
                },
                "defaultValue": "INFO"
            }]
        }

    def _get_ucc_proxy_page_meta(self):
        return {
            "name": "proxy",
            "title": "Proxy",
            "entity": [{
                "field": "proxy_enabled",
                "label": "Enable",
                "type": "checkbox"
            }, {
                "field": "proxy_type",
                "label": "Proxy Type",
                "type": "singleSelect",
                "options": {
                    "disableSearch": True,
                    "autoCompleteFields": [{
                        "label": "http",
                        "value": "http"
                    }, {
                        "label": "socks4",
                        "value": "socks4"
                    }, {
                        "label": "socks5",
                        "value": "socks5"
                    }]
                },
                "defaultValue": "http"
            }, {
                "field": "proxy_url",
                "label": "Host",
                "type": "text",
                "validators": [{
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 4096,
                    "errorMsg": "Max host length is 4096"
                }]
            }, {
                "field": "proxy_port",
                "label": "Port",
                "type": "text",
                "validators": [{
                    "type": "number",
                    "range": [1, 65535]
                }]
            }, {
                "field": "proxy_username",
                "label": "Username",
                "type": "text",
                "validators": [{
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 50,
                    "errorMsg": "Max length of username is 50"
                }]
            }, {
                "field": "proxy_password",
                "label": "Password",
                "type": "text",
                "encrypted": True,
                "validators": [{
                    "type": "string",
                    "minLength": 0,
                    "maxLength": 8192,
                    "errorMsg": "Max length of password is 8192"
                }]
            }, {
                "field": "proxy_rdns",
                "label": "Remote DNS resolution",
                "type": "checkbox"
            }],
            "options": {
                "saveValidator":
                "function(formData) { if(!formData.proxy_enabled || formData.proxy_enabled === '0') {return true; } if(!formData.proxy_url) { return 'Proxy Host can not be empty'; } if(!formData.proxy_port) { return 'Proxy Port can not be empty'; } return true; }"
            }
        }

    def _convert_customized_var_setting(self, setting):
        '''
        return the customized var meta in UCC
        '''
        entity = {
            "field": setting['name'],
            "label": setting['label'],
            "type": self.VAR_TYPE_MAPPING[setting['type']],
            "help": setting.get('help_string', ''),
            "required": setting.get('required', False)
        }

        var_type = setting['type']

        if 'default_value' in setting:
            # default value is a list for multi dropdown type and string for other types
            if type(setting['default_value']) == list:
                entity['defaultValue'] = "~".join(setting['default_value'])
            else:
                entity['defaultValue'] = setting['default_value']

        if var_type == 'dropdownlist':
            opt = {
                'disableSearch': True,
                'autoCompleteFields': [{
                    'value': possible_value['value'],
                    'label': possible_value.get('label', '')
                } for possible_value in setting.get('possible_values', [])
                                       if possible_value.get('value')]
            }
            entity['options'] = opt
        elif var_type == 'multi_dropdownlist':
            opt = {
                'delimiter': '~',  # tide char is a hard coded separator
                'items': [{
                    'value': possible_value['value'],
                    'label': possible_value.get('label', '')
                } for possible_value in setting.get('possible_values', [])
                          if possible_value.get('value')]
            }
            entity['options'] = opt
        elif var_type == 'global_account':
            entity['options'] = {'referenceName': 'account'}
        elif var_type == 'radiogroup':
            opt = {
                'items': [{
                    'value': possible_value['value'],
                    'label': possible_value.get('label', '')
                } for possible_value in setting.get('possible_values', [])
                          if possible_value.get('value')]
            }
            entity['options'] = opt
        elif var_type == 'password':
            entity['encrypted'] = True
            entity['validators'] = [{
                'type': 'string',
                'minLength': 0,
                'maxLength': 8192,
                'errorMsg': 'Max length of password is 8192'
            }]
        elif var_type == 'text':
            entity['validators'] = [{
                'type': 'string',
                'minLength': 0,
                'maxLength': 8192,
                'errorMsg': 'Max length of text input is 8192'
            }]

        # update the placeholder
        if setting.get('placeholder'):
            opt = {'placeholder': setting.get('placeholder')}
            if 'options' in entity:
                entity['options'].update(opt)
            else:
                entity['options'] = opt
        return entity

    def _get_customized_page_meta(self, customized_setting_meta):
        # make sure the customized_setting_meta is not empty or None
        assert customized_setting_meta is not None
        entity_list = []
        for setting in customized_setting_meta:
            entity_list.append(self._convert_customized_var_setting(setting))
        assert len(entity_list) > 0
        return {
            "name": self.CUSTOMIZED_SETTING_UI_NAME,
            "title": "Add-on Settings",
            "entity": entity_list
        }

    def _get_ucc_configuration_meta(self, global_setting_meta):
        if not global_setting_meta:
            return None
        ucc_tabs = []

        if self.CREDENTIAL_SETTING_KEY in global_setting_meta:
            ucc_tabs.append(self._get_ucc_account_page_meta())
        if self.PROXY_SETTING_KEY in global_setting_meta:
            ucc_tabs.append(self._get_ucc_proxy_page_meta())
        if self.LOG_LEVEL_SETTING_KEY in global_setting_meta:
            ucc_tabs.append(self._get_ucc_logging_page_meta())
        if self.CUSTOMIZED_SETTING_KEY in global_setting_meta and global_setting_meta[
                self.CUSTOMIZED_SETTING_KEY]:
            ucc_tabs.append(
                self._get_customized_page_meta(global_setting_meta[
                    self.CUSTOMIZED_SETTING_KEY]))
        if not ucc_tabs:
            return None

        return {
            "title": "Configuration",
            "description": "Set up your add-on",
            "tabs": ucc_tabs
        }

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def get_ucc_meta(self, global_setting_meta, use_global_settings=True):
        '''
        the global_setting_meta can be None. Just gen the mod input page
        '''
        if global_setting_meta is not None:
            self.validate_global_setting_meta(global_setting_meta)
        ucc_basic_meta = self._get_ucc_basic_meta()
        configuration_page_meta = {}
        if use_global_settings and global_setting_meta:
            configuration_page_meta = self._get_ucc_configuration_meta(
                global_setting_meta)
        input_page_meta = self._input_meta_mgr.get_ucc_input_meta()

        ucc_meta = {"meta": ucc_basic_meta, "pages": {}}
        if configuration_page_meta:
            ucc_meta['pages']['configuration'] = configuration_page_meta
        if input_page_meta:
            ucc_meta['pages']['inputs'] = input_page_meta
        if len(ucc_meta['pages']) > 0:
            return ucc_meta
        else:
            return None

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def is_input_meta_in_ucc_meta(self, ucc_meta):
        return 'inputs' in ucc_meta.get('pages', {})

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def read_global_configuration(self, global_setting_meta):
        ucc_meta = self.get_ucc_meta(global_setting_meta)
        schema = GlobalConfigSchema(ucc_meta)
        global_config = GlobalConfig(
            common_util.get_splunkd_uri(self._service_with_tab_context),
            self._service_with_tab_context.token, schema)

        accounts = global_config.configs.load().get('account', [])
        settings = global_config.settings.load()
        global_configuration = dict()
        global_configuration['credential_settings'] = [{
            "username": account['username'],
            "password": account['password'],
            "name": account['name']
        } for account in accounts]

        for setting in settings.get('settings', []):
            self._logger.info("setting: {}".format(logger.hide_sensitive_field(setting)))
            if setting['name'] == 'logging':
                global_configuration["log_settings"] = {
                    "log_level": setting.get('loglevel')
                }
            elif setting['name'] == "proxy":
                if 'disabled' in setting:
                    del setting['disabled']
                global_configuration["proxy_settings"] = setting
            else:  # should be customized settings
                global_configuration[
                    "customized_settings"] = global_setting_meta.get(
                    "customized_settings", [])
                for customized_setting in global_configuration[
                    "customized_settings"]:
                    var_name = customized_setting['name']
                    if var_name in setting:
                        customized_setting['value'] = setting[var_name]

        return global_configuration

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def write_global_configuration(self, global_setting_meta, old_meta=None):
        if old_meta is None:
            old_meta = self.meta
        ucc_meta = self.get_ucc_meta(global_setting_meta)
        schema = GlobalConfigSchema(ucc_meta)
        global_config = GlobalConfig(
            common_util.get_splunkd_uri(self._service_with_tab_context),
            self._service_with_tab_context.token, schema)

        all_payload = dict()
        configs_payload = self.get_ucc_configs_content_meta(
            global_setting_meta, old_meta)
        if configs_payload:
            all_payload.update(configs_payload)
        settings_payload = self.get_ucc_settings_content_meta(
            global_setting_meta, old_meta)
        if settings_payload:
            all_payload.update(settings_payload)
        if all_payload:
            self._logger.debug('Save global settings to UCC. payload: %s', logger.hide_sensitive_field(all_payload))
            global_config.save(all_payload)

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def get_ucc_configs_content_meta(self, global_setting_meta, old_meta):
        credential_settings = global_setting_meta.get(
            self.CREDENTIAL_SETTING_KEY, None)
        if not credential_settings:  # None or empty
            return None
        accounts = copy.deepcopy(credential_settings)
        old_accounts = old_meta.get(self.CREDENTIAL_SETTING_KEY, [])
        account_id = 0
        content_meta = []
        for account in accounts:
            if account_id >= len(old_accounts) or old_accounts[account_id] != account:
                account['name'] = 'account' + str(account_id)
                content_meta.append(account)
            account_id += 1
        if content_meta:
            return {"account": content_meta}
        else:
            return None

    @metric_util.function_run_time(tags=['ta_configuration_meta'])
    def get_ucc_settings_content_meta(self, global_setting_meta, old_meta):
        settings_meta = []

        log_settings = global_setting_meta.get(self.LOG_LEVEL_SETTING_KEY, None)
        old_log_settings = old_meta.get(self.LOG_LEVEL_SETTING_KEY, None)
        if log_settings and "log_level" in log_settings and not (
            old_log_settings and log_settings['log_level'] == old_log_settings['log_level']):
            settings_meta.append({
                "name": "logging",
                "loglevel": log_settings['log_level']
            })

        proxy_settings = global_setting_meta.get(self.PROXY_SETTING_KEY, None)
        old_proxy_settings = old_meta.get(self.PROXY_SETTING_KEY, None)
        if proxy_settings and type(proxy_settings) == dict and proxy_settings != old_proxy_settings:
            proxy_settings_cp = copy.deepcopy(proxy_settings)
            proxy_settings_cp['name'] = 'proxy'
            settings_meta.append(proxy_settings_cp)

        customized_settings = global_setting_meta.get(
            self.CUSTOMIZED_SETTING_KEY, None)
        old_customized_settings = old_meta.get(self.CUSTOMIZED_SETTING_KEY, [])
        if customized_settings:
            additional_parameters = {
                item['name']: item['value']
                for item in customized_settings
                }
            old_additional_parameters = {
                item['name']: item['value']
                for item in old_customized_settings
                }
            if additional_parameters != old_additional_parameters:
                additional_parameters['name'] = self.CUSTOMIZED_SETTING_UI_NAME
                settings_meta.append(additional_parameters)

        if settings_meta:
            return {"settings": settings_meta}
        else:
            return None
