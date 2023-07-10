# encoding = utf-8
import re
import os
import shutil
import copy
import mako.template

from aob.aob_common import logger, conf_parser
from aob.aob_common.metric_collector import metric_util

_logger = logger.get_builder_util_logger()


def _delete_dst(src, dst):
    if os.path.isfile(dst):
        os.remove(dst)


FILE_LAMBDAS = {
    'copy': shutil.copy,
    'delete_dst': _delete_dst,
    # TODO: implement the merge conf
    'merge_conf': None,
    'no_op': None  # no op is used to skip the file processing
}


def is_mako_template(path):
    return os.path.isfile(path) and path.endswith('.template')


def _get_target_file_path(template_path):
    l = len('.template')
    return template_path[:-1 * l]


def _render_mako_template(template_path, target_file, render_context):
    '''
    make sure the dirname(target_file) exists
    '''
    t = mako.template.Template(filename=template_path)
    _logger.debug('render tempalte %s to target %s with context: %s',
                  template_path, target_file, render_context)
    content = t.render(**render_context)
    with open(target_file, 'w') as target:
        target.write(content)


@metric_util.function_run_time(tags=['file_content_util'])
def copy_dir(src, dst, mako_context=None):
    '''
    copy the src dir to dst dir recursively. the dst dir will be overwritten
    '''
    if not os.path.isdir(src):
        raise IOError('source directory {} not found.'.format(src))

    if mako_context is None:
        mako_context = {}
    for child in os.listdir(src):
        child_path = os.path.join(src, child)
        if os.path.isfile(child_path):
            if not os.path.isdir(dst):
                os.makedirs(dst)
            if is_mako_template(child_path):
                target_file = os.path.join(dst, _get_target_file_path(child))
                _render_mako_template(child_path, target_file, mako_context)
            else:
                shutil.copy(child_path, dst)
        elif os.path.isdir(child_path):
            copy_dir(child_path, os.path.join(dst, child), mako_context)


def _is_pattern_match(element, patterns):
    for p in patterns:
        if p.match(element):
            return True
    return False


@metric_util.function_run_time(tags=['file_content_util'])
def clean_dst_dir(src, dst, ignore_patterns=None):
    '''
    clean the dst dir according to the src dir hierarchy
    :param: ignore_patterns is a list of regex patterns
    '''
    if not os.path.isdir(src):
        raise IOError('source directory %s not found.', src)
    if not os.path.isdir(dst):
        return
    if ignore_patterns is None:
        ignore_patterns = []
    for child in os.listdir(src):
        child_path = os.path.join(src, child)
        dst_child_path = os.path.join(dst, child)
        if _is_pattern_match(child, ignore_patterns):
            continue
        if os.path.isfile(child_path) and os.path.isfile(dst_child_path):
            os.remove(dst_child_path)
        elif os.path.isdir(child_path):
            clean_dst_dir(child_path, dst_child_path)


def _find_lambda(file_basename, lambdas, default_lambda):
    for pattern, _lambda in list(lambdas.items()):
        if pattern.match(file_basename):
            return _lambda
    return default_lambda


@metric_util.function_run_time(tags=['file_content_util'])
def transform_files(src, dst, lambdas={}, default_lambda=shutil.copy):
    '''
    traverse the src dir and use lambdas to process the src files
    the lambda is a function which has src, dst as its params.
    If no lambdas for the src file, use the default one.
    '''
    if not os.path.isdir(src):
        raise IOError('source directory {} not found.'.format(src))

    for child in os.listdir(src):
        child_path = os.path.join(src, child)
        if os.path.isfile(child_path):
            # find the right lambda
            _lambda = _find_lambda(child, lambdas, default_lambda)
            if _lambda is None:
                continue
            if not os.path.isdir(dst):
                os.makedirs(dst)
            _lambda(child_path, os.path.join(dst, child))
        elif os.path.isdir(child_path):
            transform_files(child_path,
                            os.path.join(dst, child), lambdas, default_lambda)


@metric_util.function_run_time(tags=['file_content_util'])
def _parse_conf_spec(conf_spec_file):
    '''
    return a dict, the keys are the stanza names and the values
                are property names in each stanza
    '''
    spec_sections = {}
    if not os.path.isfile(conf_spec_file):
        return spec_sections
    parser = conf_parser.TABConfigParser()
    parser.read(conf_spec_file)
    default_stanza_keys = []
    for field in parser.fields_outside_stanza:
        elements = field.strip().split('=')
        if len(elements) == 2:
            default_stanza_keys.append(elements[0].strip())
    if parser.has_section('default'):
        for item in parser.items('default'):
            if len(item) == 2:
                default_stanza_keys.append(item)
    spec_sections['default'] = set(default_stanza_keys)
    for section in parser.sections():
        if section == 'default':
            continue
        spec_section = section.strip().strip('[]')
        idx = spec_section.find('<')
        if idx >= 0:
            spec_section = spec_section[0:idx]
        idx = spec_section.find('://')
        if idx >= 0:
            spec_section = spec_section[0:idx]
        section_keys = list(spec_sections[
            spec_section]) if spec_section in spec_sections else list(
                default_stanza_keys)
        for item in parser.items(section):
            if len(item) == 2:
                section_keys.append(item[0].strip())
        spec_sections[spec_section] = set(section_keys)
    return spec_sections


@metric_util.function_run_time(tags=['file_content_util'])
def clean_up_conf_file(conf_file, conf_spec_file):
    '''
    clean up the conf file content according to the conf spec file
    :param conf_file: conf file path
    :param conf_spec_file: spec file path
    '''
    if os.path.isfile(conf_spec_file):
        if os.path.isfile(conf_file):
            spec_sections = _parse_conf_spec(conf_spec_file)
            spec_section_names = sorted(list(spec_sections.keys()),
                                        key=lambda x: len(x), reverse=True)
            parser = conf_parser.TABConfigParser()
            parser.read(conf_file)
            conf_sections = copy.deepcopy(parser.sections())
            for section in conf_sections:
                # filter the section based on spec
                # if the section has some props not in spec, remove it
                section_name = section.strip().strip('[]')
                idx = section_name.find('://')
                if idx >= 0:
                    section_name = section_name[0:idx]
                section_matched = False
                for spec_sec in spec_section_names:
                    if section_name.startswith(spec_sec):
                        # only search for the first match
                        props_in_spec = spec_sections[spec_sec]
                        for item in copy.deepcopy(parser.items(section)):
                            if len(item) == 2 and item[0] not in props_in_spec:
                                parser.remove_option(section, item[0])
                                _logger.debug(
                                    'Remove option:%s, stanza:%s, conf:%s',
                                    item[0], section, conf_file)
                        section_matched = True
                        break

                if not section_matched:
                    parser.remove_section(section)
                    _logger.debug('Remove section:%s, conf:%s', section,
                                  conf_file)
            with open(conf_file, 'w') as fp:
                parser.write(fp)
    else:
        # no spec file. The conf can be removed
        if os.path.isfile(conf_file):
            os.remove(conf_file)
            _logger.debug('No spec found. Remove conf file:%s', conf_file)
