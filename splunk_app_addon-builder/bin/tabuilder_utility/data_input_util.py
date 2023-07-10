from builtins import str
from builtins import range
import copy
import traceback
import re
import subprocess
import os

import jsonpath_rw
from jsonpath_rw.jsonpath import Index, Fields, Root, This
from aob.aob_common import logger
from tabuilder_utility import builder_exception, common_util
from aob.aob_common.metric_collector import metric_util

_logger = logger.get_input_builder_logger()

# CONSTANTS
INPUT_METHOD_REST = 'rest'
INPUT_METHOD_CMD = 'command'
INPUT_METHOD_CUSTOMIZED = 'customized'
ALL_INPUT_METHODS = [
    INPUT_METHOD_CMD, INPUT_METHOD_REST, INPUT_METHOD_CUSTOMIZED
]

REST_URL_NAME = '_rest_api_url'
REST_METHOD_NAME = '_rest_api_method'

EVENT_JPATH_TYPE = 'event_json_path_key'
CKPT_JPATH_TYPE = 'ckpt_json_path_key'
CKPT_ENABLE_TYPE = 'ckpt_enable'
CKPT_VAR_NAME_TYPE = 'ckpt_var_name'
CKPT_INIT_VALUE_TYPE = 'ckpt_initial_value'
CKPT_SOURCE_TIME_FORMAT_TYPE = 'ckpt_source_time_format'
CKPT_TARGET_TIME_FORMAT_TYPE = 'ckpt_target_time_format'
CUSTOMIZED_VAR_TYPE = 'customized_var'

REST_HEADER_KEY = 'rest_header'

CKPT_NAME_PATTERN = re.compile('^[a-zA-Z]\w*$')


@metric_util.function_run_time(tags=['data_input_util'])
def validate_cc_input_meta(meta):
    if meta.get('type') != INPUT_METHOD_REST:
        raise builder_exception.CommonException(
            err_code=3151, e_message='input type is not rest for CC input.')
    url_found = False
    rest_method_found = False
    ckpt_enable = False
    ckpt_var_name_found = False
    ckpt_var = None
    ckpt_jpath = ''
    ckpt_source_time_format = ''
    ckpt_target_time_format = ''
    for opt in meta.get('data_inputs_options', []):
        _opt_name = opt['name']
        _opt_type = opt.get('type')
        if _opt_name == REST_URL_NAME:
            url_found = True
            if not opt.get('value'):
                raise builder_exception.CommonException(
                    err_code=3154,
                    e_message='rest url value is empty. input is {}'.format(
                        meta['name']))
        elif _opt_name == REST_METHOD_NAME:
            rest_method_found = True
            if not opt.get('value'):
                raise builder_exception.CommonException(
                    err_code=3155,
                    e_message='rest method value is empty. input is {}'.format(
                        meta['name']))
        elif _opt_type == EVENT_JPATH_TYPE:
            try:
                path = opt.get('value', '')
                if path != '':
                    jsonpath_rw.parse(opt.get('value', ''))
            except Exception as e:
                raise builder_exception.CommonException(
                    err_code=3162, e_message='Invalid JSON path.')
        elif _opt_type == CKPT_ENABLE_TYPE:
            ckpt_enable = opt.get('value', False)
        elif _opt_type == CKPT_VAR_NAME_TYPE:
            ckpt_var_name_found = True
            ckpt_var = opt.get('value')
        elif _opt_type == CKPT_JPATH_TYPE:
            ckpt_jpath = opt.get('value', '')
        elif _opt_type == CKPT_SOURCE_TIME_FORMAT_TYPE:
            ckpt_source_time_format = opt.get('value', '')
        elif _opt_type == CKPT_TARGET_TIME_FORMAT_TYPE:
            ckpt_target_time_format = opt.get('value', '')
    if not rest_method_found:
        raise builder_exception.CommonException(
            err_code=3153,
            e_message='rest method option is not found in meta, input is {}'.
            format(meta['name']))
    if not url_found:
        raise builder_exception.CommonException(
            err_code=3152,
            e_message='rest url is not found in meta, input is {}'.format(meta[
                'name']))
    if ckpt_enable:
        if not ckpt_var_name_found:
            raise builder_exception.CommonException(
                err_code=3158,
                e_message='ckpt is enabled, but ckpt var name is not found.')
        if not ckpt_var:
            raise builder_exception.CommonException(
                err_code=3159,
                e_message='ckpt is enabled, but ckpt var name is empty.')
        if CKPT_NAME_PATTERN.match(ckpt_var) is None:
            raise builder_exception.CommonException(
                err_code=3161,
                e_message="Checkpinting variable names should start with an \
                alphabetic character, followed by alphanumeric \
                characters or underscores. The name must match the regex \
                '[a-zA-Z]\w*'")
        if not ckpt_jpath:
            raise builder_exception.CommonException(
                err_code=3167, e_message='ckpt json path can not be empty.')
        try:
            if ckpt_jpath != '':
                jsonpath_rw.parse(ckpt_jpath)
        except Exception:
            raise builder_exception.CommonException(
                err_code=3162, e_message='Invalid JSON path.')
        if (ckpt_source_time_format and not ckpt_target_time_format) or (
                not ckpt_source_time_format and ckpt_target_time_format):
            raise builder_exception.CommonException(
                err_code=3168,
                e_message='ckpt_source_time_format and ckpt_target_time_format should be set at the same time.'
            )
        customized_vars = [
            opt for opt in meta.get('data_inputs_options', [])
            if opt.get('type') == CUSTOMIZED_VAR_TYPE
        ]
        if any([ckpt_var == opt['name'] for opt in customized_vars]):
            raise builder_exception.CommonException(
                err_code=3160,
                e_message='ckpt var name `{}` conflict with mod input var name. mod vars:{}'.
                format(ckpt_var, customized_vars))


@metric_util.function_run_time(tags=['data_input_util'])
def process_cc_data_input_meta(meta):
    '''
    need to process the cc data input meta.
    Make the processed meta compatiable with other mod input metas.
    Then, we can use the same code to generate the data inputs.conf and inputs.conf.spec

    :return: return a deepcopy of the meta
    '''
    validate_cc_input_meta(meta)
    ckpt_var_options = get_ckpt_var_options(meta)
    if ckpt_var_options:
        # when ckpt is enabled, process the meta.
        # 1. put the ckpt init value into the customized_options, it is for testing
        # 2. put the ckpt var into the customized_var option list. It should be in inputs.conf
        new_meta = copy.deepcopy(meta)
        customized_options = [
            opt for opt in new_meta.get('customized_options', [])
            if opt['name'] != ckpt_var_options['name']
        ]
        customized_options.append({
            'name': ckpt_var_options['name'],
            'value': ckpt_var_options['default_value']
        })
        ckpt_type = get_ckpt_type_options()
        customized_options.append({
            'name': ckpt_type['name'],
            'value': 'file'
        })
        new_meta['customized_options'] = customized_options
        input_options = new_meta.setdefault('data_inputs_options', [])
        # update the default value. set it as empty. Do not put the value into inputs.conf
        ckpt_var_options['default_value'] = ''
        input_options.append(ckpt_var_options)
        input_options.append(ckpt_type)
        return new_meta
    return meta

def get_ckpt_type_options():
    return {
        'type': 'customized_var',
        'name': 'builtin_system_checkpoint_storage_type',
        'default_value': 'auto',
        'title': 'Checkpoint type',
        'description': '',
        'required_on_edit': False,
        'required_on_create': False,
        "possible_values": [{
            "value": "auto",
            "label": "Auto"
        }, {
            "value": "file",
            "label": "File"
        }],
        "format_type": "dropdownlist"
    }

@metric_util.function_run_time(tags=['data_input_util'])
def get_ckpt_var_options(input_meta):
    if input_meta.get('type') != INPUT_METHOD_REST:
        return None
    is_ckpt_enabled = False
    ckpt_var_name = None
    ckpt_init_value = ''
    for opt in input_meta.get('data_inputs_options', []):
        opt_type = opt.get('type')
        if opt_type == CKPT_ENABLE_TYPE:
            is_ckpt_enabled = True
        elif opt_type == CKPT_INIT_VALUE_TYPE:
            ckpt_init_value = opt.get('value', '')
        elif opt_type == CKPT_VAR_NAME_TYPE:
            ckpt_var_name = opt.get('value')
    if is_ckpt_enabled and ckpt_var_name:
        # when ckpt is enabled and the ckpt var name is set
        # should append a customized var to modinput
        return {
            'type': 'customized_var',
            'name': ckpt_var_name,
            'title': ckpt_var_name,
            'description': 'Initial value of the checkpoint variable',
            'required_on_edit': True,
            'required_on_create': True,
            'format_type': 'text',
            'default_value': ckpt_init_value,
            'placeholder': 'Initial value for the checkpoint variable'
        }

    return None


@metric_util.function_run_time(tags=['data_input_util'])
def parse_MI_output_xml(output_string):
    '''
    This function is used when testing MI, caching all the output_string
    in memory is risky
    :param output_string: the stdout buffered strings
    :return: return a list of events strings
    '''
    from defusedxml import lxml as defused_lxml

    try:
        root = defused_lxml.fromstring(output_string)
        data = root.xpath('/stream/event/data') or []
        events = [str(d.text) for d in data]
        return events
    except Exception as e:
        _logger.error('Fail to parse the stdout string. %s',
                      traceback.format_exc())
        return []


@metric_util.function_run_time(tags=['data_input_util'])
def grep_last_error_log(output_log):
    '''
    this function is used when testing MI. Caching all the log in memory
    '''
    return_err_log = ''
    log_lines = [l for l in output_log.split('\n') if l]
    error_found = False
    # grep the error from the tail
    idx = len(log_lines)
    for l in reversed(log_lines):
        idx = idx - 1
        #FIXME: use specific logic to parse the ERROR.
        # current logic is not perfect. What if there is ERROR in log body
        # the string comes from the logger format. it is hard coded
        if '- [ERROR] - [test]' in l:
            error_found = True
            break
    if error_found:
        log_tail = log_lines[idx:]
        return_err_log = '\n'.join(log_tail)
    _logger.debug(
        'filter the data input dryrun output error log. result_log: %s',
        return_err_log)
    return return_err_log


def _get_jsonpath(match):
    if not match:
        return ''
    p = match.path
    if isinstance(p, Fields):
        return _get_jsonpath(match.context) + '.' + p.fields[0]
    elif isinstance(p, Root):
        return ''
    elif isinstance(p, This):
        return ''
    elif isinstance(p, Index):
        length = len(match.context.value)
        # index may be negnative
        return _get_jsonpath(match.context) + '[' + str((p.index + length) % length) + ']'
    else:
        raise RuntimeError('Unknown path instance:{}'.format(p))


@metric_util.function_run_time(tags=['data_input_util'])
def search_with_json_path(root_obj, jpaths):
    ret = {}
    errs = {}
    for key, jpath in list(jpaths.items()):
        ret[key] = []
        errs[key] = []
        for path in jpath:
            try:
                jpath_expr = jsonpath_rw.parse(path)
                matches = jpath_expr.find(root_obj)
                ret[key].extend([{
                    'value': m.value,
                    'jsonpath': _get_jsonpath(m)
                } for m in matches])
            except:
                errs[key].append(path)
    return ret, errs


@metric_util.function_run_time(tags=['data_input_util'])
def convert_mako_template_string_to_jinja2_template(mako_template_string):
    '''
    the input argument is a mako template string, the string only contains the basic '${xxx}'
    token replace trick. We does not convert any python code here.
    The jinja2 template syntax is '{{}}'

    This function has limitations. It can not handle the mako trick '${"${}"}'. In mako, the template
    will be rendered as "${}" string.
    this fucntion will translate it to '{{"{{}}"}}'

    The complexity is O(n)
    '''
    if not mako_template_string:
        return ''

    left_brace_anchors = set()
    right_brace_anchors = set()
    # stack of tuple (idx, is_mako_brace)
    idx_stack = []
    for idx in range(len(mako_template_string)):
        if mako_template_string[idx] == '{':
            if mako_template_string[idx - 1] == '$':
                idx_stack.append((idx - 1, True))
            else:
                idx_stack.append((idx, False))
        elif mako_template_string[idx] == '}' and len(idx_stack) > 0:
            brace_tuple = idx_stack.pop()
            if brace_tuple[1]:
                left_brace_anchors.add(brace_tuple[0])
                right_brace_anchors.add(idx)

    new_template_buffer = []
    for idx in range(len(mako_template_string)):
        if idx in left_brace_anchors:
            new_template_buffer.append('{{')
        elif (idx - 1) in left_brace_anchors:
            # the left brace has been processed
            continue
        elif idx in right_brace_anchors:
            new_template_buffer.append('}}')
        else:
            new_template_buffer.append(mako_template_string[idx])
    return ''.join(new_template_buffer)


def detect_MI_single_instance_mode(app_bin_dir, declare_module, module_name):
    '''
    return True if MI is single instnace mode
    '''
    detect_single_instance_mode_code = '''
import {declare}

import sys
import {mi_module}

if 'use_single_instance_mode' in dir({mi_module}) and {mi_module}.use_single_instance_mode():
    sys.exit(0)
else:
    sys.exit(911)
'''
    temp_file = os.path.join(app_bin_dir, module_name + '_detect.py')
    splk_python = common_util.make_splunk_path(['bin', 'python'])
    try:
        with open(temp_file, 'w') as f:
            code = detect_single_instance_mode_code.format(
                declare=declare_module, mi_module=module_name)
            f.write(code)
            _logger.debug('detect data input mode. Code:%s', code)
        p_child = subprocess.Popen([splk_python, temp_file],
                              stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT)
        ret = p_child.wait()
        _logger.debug('detect input mode. input:%s, exit:%s', module_name, ret)
        return ret == 0
    except:
        _logger.error('Exception got when detecting the input mode. %s', traceback.format_exc())
    finally:
        if os.path.isfile(temp_file):
            os.remove(temp_file)


def get_input_log_source_stanza(appname):
    return "source::..." + appname.lower() + "*.log*"

def get_cce_log_source_stanza(appname):
    return  "source::..." + re.sub("[^\w]", "_", appname.lower()) + "*.log*"

#TODO: should move this to the UT
# if __name__ ==  '__main__':
#     a = '''
# one - [INFO] - [test]: first line
# two - [ERROR] - [test]: second line
# three - [INFO] - [test]: third line
#     '''
#     print grep_last_error_log(a)
#
#     a = '''
# one - [ERROR] - [test]: 1st line
#     '''
#     print grep_last_error_log(a)
#     print search_with_json_path({'foo': [{'baz': 123}, {'baz': 456}]}, {"class1":['foo[*].baz']})

# print convert_mako_template_string_to_jinja2_template('${abc${def}}')
# print convert_mako_template_string_to_jinja2_template('${"${}"}')
# print convert_mako_template_string_to_jinja2_template('${abc}${def}{}')
# print convert_mako_template_string_to_jinja2_template('${abc}${def}}')
