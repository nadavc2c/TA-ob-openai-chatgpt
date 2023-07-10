# encoding = utf-8
'''
This tool build the exported TA project to the TA package file.
'''
from __future__ import print_function
import logging
import argparse
import os
import sys
import re

import aob.aob_tools
import aob.aob_tools.log_util
from aob.aob_common import logger, package_util, conf_parser

LOG_LEVEL = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR
}

g_logger = logger.get_package_add_on_logger(level=logging.INFO)
aob.aob_tools.log_util.stream_log_to_stderr(g_logger)
g_logger.setLevel(logging.INFO)


def package_add_on(project_dir, app_name, build_number, package_file_path):
    package_util.package_add_on(
        app_name, project_dir, package_file_path, build_number=build_number)


def get_app_name_version_build_no(project_dir):
    dft_conf_file = os.path.join(project_dir, 'default', 'app.conf')
    local_conf_file = os.path.join(project_dir, 'local', 'app.conf')
    if not os.path.isfile(dft_conf_file) and not os.path.isfile(
            local_conf_file):
        raise IOError('app.conf not found in {}'.format(project_dir))
    dft_ver = 'unknown'
    local_ver = 'unknown'
    dft_name = None
    local_name = None
    dft_build_no = 0
    local_build_no = None
    if os.path.isfile(local_conf_file):
        local_parser = conf_parser.TABConfigParser()
        local_parser.read(local_conf_file)
        local_conf = local_parser.item_dict()
        local_name = local_conf.get('package', {}).get('id')
        local_ver = local_conf.get('launcher', {}).get('version')
        local_build_no = local_conf.get('install', {}).get('build')
    if os.path.isfile(dft_conf_file):
        dft_parser = conf_parser.TABConfigParser()
        dft_parser.read(local_conf_file)
        dft_conf = dft_parser.item_dict()
        dft_name = dft_conf.get('package', {}).get('id')
        dft_ver = dft_conf.get('launcher', {}).get('version')
        dft_build_no = dft_conf.get('install', {}).get('build', 0)
    name = local_name if local_name else dft_name
    ver = local_ver if local_ver else dft_ver
    build_no = local_build_no if local_build_no is not None else dft_build_no
    if not name:
        raise IOError('Can not get app id from app.conf')
    return name, ver, build_no


def get_output_file_path(out_dir, app_name, version, build_no):
    app_name = re.sub('\s+', '', app_name)
    version = re.sub('\s+', '', version)
    return os.path.join(out_dir, '{}-{}-{}.spl'.format(app_name, version,
                                                       build_no))


def main():
    parser = argparse.ArgumentParser(
        description=
        "This tool is used to package the TA project from the exported content to the final release package."
    )
    parser.add_argument(
        "-l",
        "--log_level",
        help="the log level. Default:INFO",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    parser.add_argument(
        "-b",
        "--build_number",
        help="the build number for this build",
        default=-1,
        type=int)
    parser.add_argument(
        "-o",
        "--output_dir",
        help="the output package path",
        type=str,
        default="/tmp")
    parser.add_argument(
        "-i",
        "--input_directory",
        help="The project directory which contains the  ",
        default="",
        type=str)
    parser.add_argument(
        "-v",
        "--version",
        help="show the version",
        dest="version",
        action="store_true")
    args = parser.parse_args()
    if args.version:
        print("package_add_on version:" + aob.aob_tools.__version__)
        sys.exit(0)
    llevel = LOG_LEVEL[args.log_level.upper()]
    if llevel != logging.INFO:
        g_logger.setLevel(llevel)

    if not args.input_directory:
        raise IOError("project directory is not set.")
    if not os.path.isdir(args.input_directory):
        raise IOError(
            "input directory {} not found".format(args.input_directory))
    if not os.path.isdir(args.output_dir):
        raise IOError("output dir not found.")

    app, version, build_no = get_app_name_version_build_no(
        args.input_directory)
    if args.build_number >= 0:
        build_no = args.build_number
    output_package = get_output_file_path(args.output_dir, app, version,
                                          build_no)

    if os.path.isfile(output_package):
        os.remove(output_package)
    package_util.set_package_util_logger(g_logger)
    package_add_on(args.input_directory, app, build_no, output_package)
    g_logger.info("Build TA package from directory %s to file %s",
                  args.input_directory, output_package)


if __name__ == "__main__":
    main()
