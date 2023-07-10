#!/usr/bin/python

# import splunk_app_addon_builder
from __future__ import absolute_import
import os
import sys
lib_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(lib_root, 'splunk_app_add_on_builder'))

from os.path import dirname as d
from os.path import sep
from . import modular_alert_builder
from .modular_alert_builder.build_core import check_file_name
from solnlib.log import Logs
from optparse import OptionParser
import json
from aob.aob_common import logger


main_logger = logger.get_modular_alert_builder_logger()

def start_builder(short_name=None, build_setting_file=None, dir_template=None,
                  output_dir=None, version="1.0.0", logger=None,
                  html_setting=None, only_build_py=False, **kwargs):
    local_logger = logger or main_logger
    current_dir = d(os.path.abspath(__file__))
    if not os.path.isabs(build_setting_file):
        build_setting_file = os.path.sep.join([current_dir,
                                               build_setting_file])

    input_setting = None
    with open(build_setting_file, "r") as bsf:
        setting_content = bsf.read()
        input_setting = json.loads(
            check_file_name(setting_content,
                            {"short_name": short_name, "version": version})
        )

    build_components = {
        "html": True,
        "conf": True,
        "py": True
    }

    if only_build_py:
        build_components["html"] = False
        build_components["conf"] = False

    template = sep.join([current_dir, "arf_dir_templates", dir_template])
    return modular_alert_builder.build(input_setting=input_setting,
                                       short_name=short_name,
                                       template=template, output_dir=output_dir,
                                       logger=local_logger,
                                       version=version,
                                       html_setting=html_setting,
                                       build_components=build_components,
                                       **kwargs)

if __name__ == "__main__":
    parser = OptionParser()
    parser.add_option("--short_name", dest="short_name",
                      help="the short name of TA")
    parser.add_option("--setting_file", dest="build_setting_file",
                      help="The setting file which should be in json format")
    parser.add_option("--directory-template", dest="dir_template",
                      help="TA's template directory",
                      default="modular_alert_package")
    parser.add_option("--output_dir", dest="output_dir",
                      help="The output directory of generated TA. If not set, then all files' content will print to stdout.")
    parser.add_option("--version", dest="version", default="1.0.0",
                      help="The version of the TA")
    parser.add_option("--html_home", dest="html_home",
                      help="The home page of html")
    parser.add_option("--html_theme", dest="html_theme",
                      help="The theme of html")
    parser.add_option("--html_template", dest="html_template",
                      help="The template of html")
    parser.add_option("--only_build_py", dest="only_build_py",
                      action="store_true", default=False,
                      help="Only build py part")
    (options, args) = parser.parse_args()
    html_setting = {
        "html_home": options.html_home,
        "html_theme": options.html_theme,
        "html_template": options.html_template
    }

    output = start_builder(short_name=options.short_name,
                           build_setting_file=options.build_setting_file,
                           dir_template=options.dir_template,
                           output_dir=options.output_dir,
                           version=options.version,
                           only_build_py=options.only_build_py,
                           html_setting=html_setting)
    # print output
