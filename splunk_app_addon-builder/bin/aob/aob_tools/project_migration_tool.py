# encoding = utf-8
'''
This tool send requests to splunk web to export/import the project
'''
from __future__ import print_function
from builtins import object
import argparse
import os
import logging
import sys
import traceback
import tempfile
import tarfile
import shutil
import re

import requests
import aob.aob_tools
import aob.aob_common.package_util
import aob.aob_tools.log_util

logger = logging.getLogger()
aob.aob_tools.log_util.stream_log_to_stderr(logger)

LOG_LEVEL = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR
}


class SplunkWebSession(object):
    uri_pattern = re.compile(
        '(?P<protocol>\w+)://(?P<host>[\w\.\-]+)(\:(?P<port>\d+))?(/(?P<web_prefix>[\w\-]+))?')

    @classmethod
    def parse_uri(cls, uri):
        matched = cls.uri_pattern.match(uri)
        if matched:
            fields = matched.groupdict()
            return fields['protocol'], fields['host'], fields['port'], fields['web_prefix']
        return None, None, None

    @classmethod
    def create_web_session(cls, uri, username='admin', password='changeme'):
        protocol, host, port, web_prefix = cls.parse_uri(uri)
        if port:
            port = int(port)
        params = {'username': username, 'password': password}
        if protocol:
            params['protocol'] = protocol
        if port:
            params['port'] = port
        if host:
            params['host'] = host
        if web_prefix:
            params['web_prefix'] = web_prefix
        return SplunkWebSession(**params)

    def __init__(self,
                 protocol='http',
                 host='localhost',
                 port=8000,
                 web_prefix=None,
                 username='admin',
                 password='changeme',
                 logger=logger):
        self._protocol = protocol
        self._host = host
        self._port = port
        self._web_prefix = web_prefix
        self._username = username
        self._password = password
        self._logger = logger
        self._url_root = '{}://{}:{}'.format(self._protocol, self._host,
                                                   self._port)
        if self._web_prefix:
            self._url_root = self._url_root + "/" + self._web_prefix + "/en-US"
        else:
            self._url_root = self._url_root + "/en-US"
        self._session = None
        self._web_token = None

    def download(self, path, **params):
        assert self._session, 'session is not logged in.'
        url = '{}/{}'.format(self._url_root, path)
        self._logger.info('DOWNLOAD %s', url)
        resp = self._session.get(url, params=params, stream=True)
        resp.raise_for_status()
        return resp

    def get(self, path, **params):
        assert self._session, 'session is not logged in.'
        url = '{}/{}'.format(self._url_root, path)
        self._logger.info('GET %s', url)
        resp = self._session.get(url, params=params)
        self._logger.debug('Response: %s', resp.text)
        resp.raise_for_status()
        return resp

    def post(self,
             path,
             data,
             content_type=None,
             add_splunk_key=True,
             multipart=False):
        assert self._session, 'session is not logged in.'
        url = '{}/{}'.format(self._url_root, path)
        if content_type == 'JSON' or content_type == 'application/json':
            content_type = 'application/json'
            data = json.dumps(data)
        headers = {'Content-Type': content_type}

        if add_splunk_key:
            if not self._web_token:
                raise Exception('session is not logged in.')
            headers['X-Requested-With'] = 'XMLHttpRequest'
            headers['X-Splunk-Form-Key'] = self._web_token

        self._logger.info('POST %s', url)
        if multipart:
            resp = self._session.post(url, files=data, headers=headers)
        else:
            resp = self._session.post(url, data=data, headers=headers)
        self._logger.debug('Response: %s', resp.text)
        resp.raise_for_status()
        return resp

    def login(self):
        self._session = requests.Session()
        resp = self.get('')
        resp = self.post(
            path='account/login',
            data={
                'cval': resp.cookies['cval'],
                'username': self._username,
                'password': self._password,
                'set_has_logged_in': 'false'
            },
            add_splunk_key=False)
        self._web_token = resp.cookies['splunkweb_csrf_token_{}'.format(
            self._port)]

    def logout(self):
        self.get('account/logout')
        self._session = None


def copy_tree(src, dst):
    '''
    copy all the content in src directory to dst directory,
    overwrite the existing files
    '''
    assert os.path.isdir(src), 'src directory not found.'
    src = os.path.abspath(src)
    dst = os.path.abspath(dst)

    src_len = len(src)
    for src_root, dirs, files in os.walk(src):
        dst_root = dst + src_root[src_len:]
        if not os.path.isdir(dst_root):
            os.makedirs(dst_root)
        for fname in files:
            shutil.copy(os.path.join(src_root, fname), dst_root)


def export_project_to_dir(app, out_dir, splunk_web_uri, user, password):
    logger.info('Begin exporting project:%s to directory:%s', app, out_dir)
    session = SplunkWebSession.create_web_session(splunk_web_uri, user,
                                                  password)
    session.login()
    export_link = "custom/splunk_app_addon-builder/app_migrate/export_app?app=" + app
    download_link = "custom/splunk_app_addon-builder/app_migrate/download_exported_app"
    try:
        resp = session.post(export_link, data={'app': app})
        resp.raise_for_status()
        temp_file_fd, temp_file_name = tempfile.mkstemp(
            prefix=app, suffix=".tgz")

        resp = session.download(download_link, app=app)
        if resp.headers['Content-Type'] != 'application/x-download':
            raise Exception('fail to download project {}. Error:{}'.format(
                app, resp.text))
        with open(temp_file_name, 'wb') as temp_file:
            for chunk in resp.iter_content(chunk_size=128000):
                temp_file.write(chunk)
        os.close(temp_file_fd)
        logger.debug("Download the exported project to temp file:%s",
                     temp_file_name)
        temp_dir = tempfile.mkdtemp()
        with tarfile.open(temp_file_name, mode='r:*') as tar:
            tar.extractall(temp_dir)
            logger.debug("extract the downloaded project tgz to folder %s",
                         temp_dir)
        app_root = os.path.join(temp_dir, app)
        if not os.path.isdir(app_root):
            logger.debug("app root directory %s not found.", app_root)
            logger.error("The exported project may be corrupted.")
            raise IOError("Project root not found.")
        copy_tree(app_root, os.path.join(out_dir, app))
        logger.info('%s is exported to dir %s', app, out_dir)
    except Exception as e:
        logger.error("Fail to export the project:%s. Error:%s", app,
                     traceback.format_exc())
        raise e
    finally:
        session.logout()


def import_project(project_dir, splunk_web_uri, user, password):
    # get the project name from the app.conf
    app_conf = os.path.join(project_dir, 'local', 'app.conf')
    if not os.path.isfile(app_conf):
        raise RuntimeError('{} not found. The directory structure is not correct.'.format(app_conf))
    app = aob.aob_common.package_util.get_app_name(app_conf)
    if not app:
        raise RuntimeError('Fail to get app name from %s. Please validate the configuration content.' % app_conf)
    logger.info("Begin importing project:%s to splunk:%s", app, splunk_web_uri)
    session = SplunkWebSession.create_web_session(splunk_web_uri, user,
                                                  password)
    session.login()

    temp_file, temp_file_name = tempfile.mkstemp(suffix=".tgz", prefix=app)
    with tarfile.open(temp_file_name, "w:gz") as tar:
        tar.add(project_dir, arcname=app)
    os.close(temp_file)

    logger.info("Generate the project compressed file:%s", temp_file_name)
    temp_file = open(temp_file_name, 'rb')
    target_url = "custom/splunk_app_addon-builder/app_migrate/import_app"
    try:
        resp = session.post(
            target_url, data={"app_package_file": temp_file}, multipart=True)
        resp.raise_for_status()
        if 'err_code' in resp.json():
            raise Exception('Fail to import TA {}. Error:{}'.format(app, resp.text))
        logger.info("Project:%s is imported.", app)
    except Exception as e:
        logger.error("Fail to import project:%s. Error:%s", app,
                     traceback.format_exc())
        raise e
    finally:
        session.logout()


def main():
    parser = argparse.ArgumentParser(description="This tool can export the TA project from AoB instance to target folder. Or import the TA project from source folder to AoB instance.")
    parser.add_argument(
        "-l",
        "--log_level",
        help="the log level. Default:INFO",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    parser.add_argument(
        "-o",
        "--output_dir",
        help="the output directory to store the project",
        type=str,
        default="exported_projects")
    parser.add_argument(
        "-t", "--ta_name", help="project name", default="", type=str)
    parser.add_argument(
        "-u",
        "--user",
        help="splunk user name. Default:admin",
        default="admin",
        type=str)
    parser.add_argument(
        "-p",
        "--password",
        help="splunk password. Default:changeme",
        default="changme",
        type=str)
    parser.add_argument(
        "-s",
        "--splunk_web",
        help="splunk web uri. Default: http://localhost:8000",
        default="http://localhost:8000",
        type=str)
    parser.add_argument(
        "-a",
        "--action",
        help="export or import the project. Default:export",
        default='export',
        choices=['export', 'import'])
    parser.add_argument(
        "-i",
        "--input_directory",
        help="the project directory, it is used when importing the project",
        default="",
        type=str)
    parser.add_argument(
        "-v",
        "--version",
        help="show the version",
        dest="version",
        action="store_true"
    )
    args = parser.parse_args()
    if args.version:
        print("project_migration_tool version:" + aob.aob_tools.__version__)
        sys.exit(0)
    llevel = LOG_LEVEL[args.log_level.upper()]
    if llevel != logging.INFO:
        logger.setLevel(llevel)

    if args.action.lower() == 'export':
        if not args.ta_name:
            raise IOError("the ta project name can not be empty.")
        output_dir = args.output_dir
        if not os.path.isdir(output_dir):
            os.makedirs(output_dir)
        export_project_to_dir(args.ta_name, output_dir, args.splunk_web,
                              args.user, args.password)
    else:
        if not args.input_directory:
            raise IOError("project directory is not set.")
        if not os.path.isdir(args.input_directory):
            raise IOError("input directory {} not found.".format(
                args.input_directory))
        import_project(args.input_directory, args.splunk_web, args.user,
                       args.password)

if __name__ == "__main__":
    main()
