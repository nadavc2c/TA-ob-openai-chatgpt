#!/usr/bin/python

from __future__ import print_function
from __future__ import absolute_import
import os
import sys
from os.path import dirname as dn
lib_root = os.path.dirname(dn(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(lib_root, 'splunk_app_add_on_builder'))
from solnlib.log import Logs
from optparse import OptionParser
import json
from . import modular_alert_builder
from traceback import format_exc
from .modular_alert_builder.build_core import alert_actions_exceptions as aae
from aob.aob_common import logger

main_logger = logger.get_modular_alert_testing_logger()


def start_tester(build_setting_file=None, test_setting_file=None,
                 short_name=None, logger=None, version=None,
                 global_settings=None,
                 template_setting=None,
                 **kwargs):
    '''
    test_setting_file = {
        "name": "",
        "input_setting":{
            "alert_mode":,
            "stdin_fields": {
                "session_key":,
                "server_uri":,
            }
            "results": [],
            "configurations": {},
        },
        "ta_root_dir": ,
        "code_file":,
        "stdout_file":
        "stderr_file":
    }
    '''
    if not test_setting_file or not os.path.exists(test_setting_file):
        raise aae.AlertTestSettingFileDoesNotExist(
            'test_setting_file="{}"'.format(test_setting_file))

    if not build_setting_file or not os.path.exists(build_setting_file):
        raise aae.AlertTestSettingFileDoesNotExist(
            'build_setting_file="{}"'.format(build_setting_file))

    test_setting = None
    try:
        with open(test_setting_file, 'r') as sf:
            test_setting = json.loads(sf.read())
    except ValueError as e:
        msg = 'operation="Load setting file", object="{}", status="failed", '\
        'reason="{}"'.format(test_setting_file, format_exc())
        raise aae.AlertTestJsonFileLoadFailure(msg)

    build_setting = None
    try:
        with open(build_setting_file, 'r') as sf:
            build_setting = json.loads(sf.read())
    except ValueError as e:
        msg = 'operation="Load setting file", object="{}", status="failed", '\
        'reason="{}"'.format(build_setting_file, format_exc())
        raise aae.AlertTestJsonFileLoadFailure(msg)

    l_logger = logger or g_logger
    return modular_alert_builder.test(build_setting=build_setting,
                                      test_setting=test_setting,
                                      short_name=short_name,
                                      version=version,
                                      logger=l_logger,
                                      template_setting=template_setting,
                                      global_settings=global_settings,
                                      **kwargs)


if __name__ == "__main__":
    parser = OptionParser()
    parser.add_option("--short_name", dest="short_name",
                      help="The short name of tested TA")
    parser.add_option("--setting_file", dest="test_setting_file",
                      help="The test setting file. Which should be in json")
    parser.add_option("--build_setting_file", dest="build_setting_file",
                      help="The alert build setting file. Which should be in json")
    parser.add_option("--version", dest="version", default="1.0.0",
                      help="The version of the tested TA.")
    parser.add_option("--test_template_dir", dest="test_template_dir",
                      help="The location of test template file")
    parser.add_option("--template_declare_file", dest="template_declare_file",
                      help="The template of import declare file.")
    parser.add_option("--input_template_dir", dest="input_template_dir",
                      help="The location of input template file with absolute path.")
    parser.add_option("--template_input_file", dest="template_input_file",
                      help="The template of input declare file with absolute path.")
    parser.add_option("--template_lookup_dir", dest="lookup_dir",
                      help="The template of input declare file with absolute path.")

    (options, args) = parser.parse_args()
    template_setting = {
        "test_template_setting": {
            "template_dir": options.test_template_dir,
            "template_declare_file": options.template_declare_file
        },
        "input_template_setting": {
            "template_dir": options.input_template_dir,
            "template_input_file": options.template_input_file,
            "template_lookup_dir": options.lookup_dir
        }
    }
    print(start_tester(test_setting_file=options.test_setting_file,
                       build_setting_file=options.build_setting_file,
                       short_name=options.short_name,
                       logger=g_logger,
                       version=options.version,
                       template_setting=template_setting
                       ))
