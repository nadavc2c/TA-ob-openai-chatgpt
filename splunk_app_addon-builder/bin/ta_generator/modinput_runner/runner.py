import re
import os
import json
import signal
import platform
import subprocess
import traceback
import os.path as op
import copy

from mako.template import Template

import solnlib.modular_input.checkpointer as ckpt
from aob.aob_common import logger
from tabuilder_utility.common_util import make_splunk_path

runner_logger = logger.get_input_builder_logger()

CKPT_DIR = op.dirname(op.abspath(__file__))
OPTION_FILE = "{}/option.txt".format(
    os.path.split(os.path.realpath(__file__))[0])

OPTION_FILE_CONTENT = '''<?xml version='1.0' encoding='UTF-8'?>
<input>
<server_host>localhost</server_host>
<server_uri>${server_uri | x}</server_uri>
<session_key>${session_key | x}</session_key>
<checkpoint_dir>${checkpoint_dir | x}</checkpoint_dir>
<configuration>
<stanza name='${input_name | x}://aob_test'>
<param name='index'>add_on_builder_index</param>
<param name='host'>localhost</param>
<param name="start_by_shell">false</param>
<param name='sourcetype'>${sourcetype | x}</param>
<param name="interval">${interval | x}</param>
% for option in options:
<param name='${option["name"]}'>${option["value"] | x}</param>
% endfor
</stanza>
</configuration>
</input>
'''

CKPT_NAME = 'modinput_runner'
CKPT_KEY = 'testing_process'

GLOBALSETTINGS = "global_settings"
DATA_INPUTS_OPTIONS = "data_inputs_options"
AOB_TEST_FLAG = 'AOB_TEST'
'''
CKPT structure
{
    CKPT_KEY: {
        <test_id>: {
            'pid': process_id,
            'app': app name,
            'input': mod input name
        },
        <test_id>: {
            ...
        }
        ...
    }
}
'''


def create_kill_flag(pdir, tid):
    p = op.join(pdir, "{}.kill".format(tid))
    with open(p, 'w') as f:
        f.write(tid)


def has_kill_flag(pdir, tid):
    p = op.join(pdir, "{}.kill".format(tid))
    return op.exists(p)


def clean_kill_flag(pdir, tid):
    p = op.join(pdir, "{}.kill".format(tid))
    if op.isfile(p):
        os.remove(p)


def _encode_options(customized_options):
    options = copy.deepcopy(customized_options)
    for option in customized_options:
        # value can be type of string and list, use json to convert should be enough
        option['value'] = json.dumps(option['value'])
        options.append(option)
    return options


class CodeRunner(object):
    def __init__(self, app, meta):
        self._app = app
        self._input_name = meta['name']
        self._code = meta['code']
        self._options = _encode_options(meta['customized_options'])
        self._file_path = meta['modinput_file']
        self._test_id = meta['test_id']
        self._server_uri = meta['server_uri']
        self._session_key = meta['session_key']
        self._checkpoint_dir = meta['checkpoint_dir']
        self._ckpter = ckpt.FileCheckpointer(CKPT_DIR)
        self._globalsettings = meta.get('global_settings', None)
        self._data_inputs_options = meta['data_inputs_options']
        self._interval = meta.get('interval', 30)
        self._sourcetype = meta['sourcetype']

    def run(self):
        self._before_run()
        try:
            ret = self._run()
        except Exception as e:
            runner_logger.error('Get error when testing modular input %s, %s',
                                self._file_path, traceback.format_exc())
            raise e
        finally:
            self._after_run()
        return ret

    def _before_run(self):
        with open(self._file_path, 'w') as f:
            f.write(self._code)

    def _after_run(self):
        if os.path.isfile(self._file_path):
            runner_logger.debug('Remove file %s after testing.',
                                self._file_path)
            os.remove(self._file_path)

    def _get_splunk_bin(self):
        if os.name == 'nt':
            splunk_bin = 'splunk.exe'
        else:
            splunk_bin = 'splunk'
        return make_splunk_path(('bin', splunk_bin))

    def _run(self):
        '''
        return: 3 element tuple
        (return_code, raw_stdout_out, raw_stderr_out)
        '''
        ckpt = self._ckpter.get(CKPT_NAME)
        if ckpt is None:
            ckpt = {}
        if CKPT_KEY not in ckpt:
            ckpt[CKPT_KEY] = {}
        input_scheme = Template(OPTION_FILE_CONTENT).render(
            server_uri=self._server_uri,
            session_key=self._session_key,
            checkpoint_dir=self._checkpoint_dir,
            options=self._options,
            interval=self._interval,
            input_name=self._input_name,
            sourcetype=self._sourcetype)
        # runner_logger.debug('input stream:' + input_scheme)
        # use python3 for test by default
        if os.path.isfile(make_splunk_path(('bin', "python3"))) \
                or os.path.isfile(make_splunk_path(('bin', "python3.exe"))):
            cmd2 = [self._get_splunk_bin(), 'cmd', 'python3', self._file_path]
        else:
            cmd2 = [self._get_splunk_bin(), 'cmd', 'python', self._file_path]
        # make it the same as core
        cwd = "C:\Windows\system32" if platform.system() == "Windows" else '/'
        # prepare the env
        child_env = os.environ.copy()
        child_env[AOB_TEST_FLAG] = 'true'
        if self._globalsettings:
            child_env[GLOBALSETTINGS] = json.dumps(self._globalsettings)
        child_env[DATA_INPUTS_OPTIONS] = json.dumps(self._data_inputs_options)
        runner_logger.debug("Start the test subprocess with env:%s",
                            logger.hide_sensitive_field({
                                GLOBALSETTINGS: self._globalsettings,
                                DATA_INPUTS_OPTIONS: self._data_inputs_options
                            }))
        try:
            child2 = subprocess.Popen(
                cmd2,
                stdin=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdout=subprocess.PIPE,
                cwd=cwd,
                env=child_env)
            ckpt[CKPT_KEY][self._test_id] = {
                'pid': child2.pid,
                'app': self._app,
                'input': self._input_name
            }
            self._ckpter.update(CKPT_NAME, ckpt)
            stdout_str, stderr_str = child2.communicate(input=input_scheme.encode())
            stdout_str = stdout_str.decode()
            stderr_str = stderr_str.decode()
            retcode = child2.returncode
            del ckpt[CKPT_KEY][self._test_id]
            if not has_kill_flag(CKPT_DIR, self._test_id):
                # normal exist, not killed
                self._ckpter.update(CKPT_NAME, ckpt)
            return retcode, stdout_str, stderr_str
        except subprocess.CalledProcessError as e:
            runner_logger.error('Fail to execute the test process:%s. %s',
                                e.cmd, traceback.format_exc())
            return e.returncode, '', e.output


class CodeChecker(object):
    def __init__(self):
        self._ckpter = ckpt.FileCheckpointer(CKPT_DIR)

    def check_pid(self, test_id):
        ckpt = self._ckpter.get(CKPT_NAME)
        if ckpt is not None and CKPT_KEY in ckpt and test_id in ckpt[CKPT_KEY]:
            return True
        else:
            return False


class CodeKiller(object):
    def __init__(self):
        self._ckpter = ckpt.FileCheckpointer(CKPT_DIR)

    def kill_all(self, app, input_name):
        # we need to refactor the ckpt structure, put the app name in it
        ckpt = self._ckpter.get(CKPT_NAME)
        if ckpt is not None and CKPT_KEY in ckpt:
            deleted = []
            for test_id, content in ckpt[CKPT_KEY].items():
                if content['app'] == app and content['input'] == input_name:
                    try:
                        if platform.system() == "Windows":
                            subprocess.Popen("taskkill /F /T /PID {0}".format(
                                content['pid']))
                        else:
                            os.kill(content['pid'], signal.SIGTERM)
                        deleted.append(test_id)
                    except:
                        runner_logger.debug(
                            'fail to kill process %s in killall.',
                            content['pid'])
                        continue
            for tid in deleted:
                del ckpt[CKPT_KEY][tid]
            self._ckpter.update(CKPT_NAME, ckpt)
        return

    def kill_pid(self, test_id):
        create_kill_flag(CKPT_DIR, test_id)
        ckpt = self._ckpter.get(CKPT_NAME)
        if ckpt is not None and CKPT_KEY in ckpt and test_id in ckpt[CKPT_KEY]:
            try:
                pid = ckpt[CKPT_KEY][test_id]['pid']
                if platform.system() == "Windows":
                    subprocess.Popen("taskkill /F /T /PID {0}".format(pid))
                else:
                    os.kill(pid, signal.SIGKILL)
            except:
                runner_logger.debug(
                    'Kill process %s fails. Maybe the process is done.',
                    ckpt[CKPT_KEY][test_id]['pid'])
            del ckpt[CKPT_KEY][test_id]
            self._ckpter.update(CKPT_NAME, ckpt)
        clean_kill_flag(CKPT_DIR, test_id)
        return
