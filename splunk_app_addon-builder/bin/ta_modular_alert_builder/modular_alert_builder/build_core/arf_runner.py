from builtins import object
import os
import os.path as op
import json
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_template import AlertActionsTemplateMgr
from tabuilder_utility.common_util import make_splunk_path
from mako.template import Template
import subprocess
from shutil import copy, copytree, rmtree
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_input_simulate import simulate_alert_input
from ta_modular_alert_builder.modular_alert_builder.build_core import alert_actions_exceptions as aae
from ta_modular_alert_builder.modular_alert_builder.build_core import alert_actions_helper as aah
from traceback import format_exc
from threading import Thread
from os.path import dirname as dn
import sys
import errno
from ta_modular_alert_builder.modular_alert_builder.build_core import arf_consts as ac
from tabuilder_utility import common_util


DEFAULT_TIMEOUT = 180
AOB_TEST_FLAG = 'AOB_TEST'
GLOBALSETTINGS = "global_settings"


class ARFTestRunner(object):
    CURRENT_DIR = op.dirname(op.abspath(__file__))
    TEMP_CODE_TEST_DIR = op.join(CURRENT_DIR, "code_test")
    DECLARE_FILE = "test_import_declare.py.template"

    def __init__(self, envs, logger,
                 all_template_setting=None, **kwargs):
        '''
        all_template_setting = {
            "test_template_setting" :
                {
                "template_dir": ,
                "template_declare_file": ,
                },
            "input_template_setting" :
                {
                "template_dir":,
                "template_input_file":,
                "template_lookup_dir":,
                }
        }
        '''
        self._envs = envs
        self._logger = logger
        self._input_sim_obj = None
        self._build_setting = self._envs.get("build_setting")
        self._ta_name = self._build_setting.get(ac.SHORT_NAME)
        self._lib_dir = common_util.get_python_lib_dir_name(self._ta_name)
        self._test_setting = self._envs["test_setting"]
        self._test_global_settings = self._envs.get("global_settings")
        self._package_dir = self._test_setting.get("ta_root_dir")
        self._local_ta_dir = self._test_setting.get("local_ta_dir")
        self._code_test_dir = op.join(
            self._test_setting.get("test_container_dir"), "code_test")
        self._stdout_file = self._test_setting.get("stdout_file")
        self._stderr_file = self._test_setting.get("stderr_file")
        self._timeout = self._test_setting.get("timeout") or DEFAULT_TIMEOUT
        self._all_template_setting = all_template_setting
        self.init_template_setting()
        self._temp_mgr = AlertActionsTemplateMgr(
            template_dir=self._template_dir)
        self._child_proc = None
        self.init_test_env()
        self._subprocess_out = {
            "stderr": "",
            "stdout": ""
        }

    def init_code_file(self):
        self._test_code_file = self._test_setting.get("code_file")
        if self._test_code_file:
            copy(self._test_code_file, self._code_test_dir)
            return

        orig_main_code_file = op.join(self._package_dir, "bin",
                                      self._test_setting.get("name") + ".py")
        self._test_code_file = op.join(self._code_test_dir,
                                       self._test_setting.get("name") + ".py")

        if not op.exists(op.dirname(self._test_code_file)):
            os.makedirs(op.dirname(self._test_code_file))
        # if op.exists(self._test_code_file):
        #     os.remove(self._test_code_file)
        copy(orig_main_code_file, self._test_code_file)

        self._test_code = self._test_setting.get("code")
        if self._test_code:
            file_path = op.join(self._package_dir, "bin", self._lib_dir,
                                self._test_setting.get("name") + "_helper.py")
            if not op.exists(op.dirname(file_path)):
                os.makedirs(op.dirname(file_path))
            with open(file_path, 'w+') as fp:
                fp.write(self._test_code)
            return

        raise aae.AlertTestCodeFileNotExistFailure('test_setting={}'.format(
            self._test_setting))

    def init_test_env(self):
        self._alert_name = self._test_setting.get("name")
        self._temp_code_test_dir = self._test_setting.get("temp_code_test_dir") \
            or ARFTestRunner.TEMP_CODE_TEST_DIR
        if op.exists(self._code_test_dir):
            rmtree(self._code_test_dir)
        copytree(self._temp_code_test_dir, self._code_test_dir)

        self.init_code_file()
        return

    def init_template_setting(self):
        self._template_setting = None
        self._template_dir = None
        self._template_declare_file = ARFTestRunner.DECLARE_FILE
        self._input_template_setting = None
        if not self._all_template_setting:
            return

        self._template_setting = self._all_template_setting.get(
            "test_template_setting")
        self._input_template_setting = self._all_template_setting.get(
            "input_template_setting")
        if not self._template_setting:
            return

        self._template_dir = self._template_setting.get("template_dir")
        if self._template_setting.get("template_declare_file"):
            self._template_declare_file = self._template_setting["template_declare_file"]

    def get_new_declare_file_path(self):
        return op.join(self._code_test_dir,
                       self._lib_dir + "_declare.py")

    def prepare_declare_file(self):
        # Generate a new declare file, which will add the code test directory as
        # the first element of sys.path. Then the subprocess will import the
        # overwriten logger_helper with an additonal stderr steamhandler so
        # that all output including logger's will be redirect to stderr
        template_declare = self._template_declare_file
        if not op.isabs(self._template_declare_file):
            template_declare = op.join(self._temp_mgr.get_template_dir(),
                                       self._template_declare_file)

        try:
            self._template = Template(filename=template_declare)
            final_content = self._template.render(
                package_root_path=aah.split_path(self._package_dir),
                local_ta_dir=aah.split_path(self._local_ta_dir)
            )
        except Exception:
            msg = 'operation="render declare file", file="{}", '\
                'status="failed", reason="{}"'.format(template_declare,
                                                      format_exc())
            raise aae.AlertTestWritingFileFailure(msg)

        file_path = self.get_new_declare_file_path()

        try:
            with open(file_path, 'w+') as fp:
                fp.write(final_content)
        except IOError:
            msg = 'operation="write", object="{}", '\
                'status="failed", reason="{}"'.format(template_declare,
                                                      format_exc())
            raise aae.AlertTestWritingFileFailure(msg)

    def prepare(self):
        self.prepare_declare_file()

        # copy the main py file to relocate directory
        self._py_file = op.join(self._code_test_dir,
                                op.basename(self._test_code_file))

        # simulate alert input
        input_setting = self._test_setting.get("input_setting")
        self._input_sim_obj = simulate_alert_input(
            alert_input_setting=input_setting,
            logger=self._logger,
            results_dir=self._code_test_dir,
            template_setting=self._input_template_setting)
        self._inputs = self._input_sim_obj.simulate()

    def read_stdpipe_and_write(self, from_pipe, to_file, backup_pipe, out_type):
        if to_file:
            try:
                with open(to_file, 'w+') as sf:
                    while True:
                        line = from_pipe.readline()
                        if not line:
                            break
                        sf.write(line)
                        self._subprocess_out[out_type] += line
            except IOError:
                msg = 'operation="write", content="{}", to="{}" '\
                    'status="failed", reason="{}"'.format(line,
                                                          to_file,
                                                          format_exc())
                raise aae.AlertTestResultWritingFailure(msg)
        else:
            while True:
                line = from_pipe.readline()
                if not line:
                    break
                # if backup_pipe:
                #     backup_pipe.write(line)
                self._subprocess_out[out_type] += line.decode()

    def write_test_result(self, output=None, error=None):
        try:
            with open(self._stdout_file, 'w+') as sf:
                sf.write(output)
        except IOError:
            msg = 'operation="write", content="{}", to="{}", '\
                'status="failed", reason="{}"'.format(output,
                                                      self._stdout_file,
                                                      format_exc())
            raise aae.AlertTestWritingFileFailure(msg)

        try:
            with open(self._stderr_file, 'w+') as sf:
                sf.write(error)
        except IOError:
            msg = 'operation="write", content="{}", to="{}" '\
                'status="failed", reason="{}"'.format(error,
                                                      self._stderr_file,
                                                      format_exc())
            raise aae.AlertTestResultWritingFailure(msg)

    def kill_subprocess(self):
        if not self._child_proc:
            return
        try:
            self._child_proc.kill()
        except OSError as oe:
            if oe.errno == errno.ESRCH:
                self._logger.info('operation="kill", object="process", pid="%s"'
                                  ', status="success"', self._child_proc.pid)
            else:
                msg = 'operation="kill", object="process", pid="%s", status="failed"'.format(self._child_proc.pid)
                raise aae.AlertTestKillingSubprocessFailure(msg)
        else:
            self._logger.info('operation="kill", object="process", pid="%s", '\
                              'status="success"', self._child_proc.pid)

    def _get_splunk_bin(self):
        if os.name == 'nt':
            splunk_bin = 'splunk.exe'
        else:
            splunk_bin = 'splunk'
        return make_splunk_path(('bin', splunk_bin))

    def start_subprocess(self):
        self.prepare()

        # use python3 for test by default
        if os.path.isfile(make_splunk_path(('bin', "python3"))) \
                or os.path.isfile(make_splunk_path(('bin', "python3.exe"))):
            cmd = [self._get_splunk_bin(), 'cmd', 'python3', self._py_file, "--execute"]
        else:
            cmd = [self._get_splunk_bin(), 'cmd', 'python', self._py_file, "--execute"]
        # cmd = ["python", self._py_file, "--execute"]
        for one_input in self._inputs:
            try:
                child_env = os.environ.copy()
                child_env[AOB_TEST_FLAG] = 'true'
                child_env[GLOBALSETTINGS] = json.dumps(self._test_global_settings.get('settings', {}))
                self._child_proc = subprocess.Popen(cmd,
                                                    stdin=subprocess.PIPE,
                                                    stderr=subprocess.PIPE,
                                                    stdout=subprocess.PIPE,
                                                    cwd=self._code_test_dir,
                                                    env=child_env)
                self._logger.info('operation="start subprocess", pid="%s", '\
                                  'status="success", input="%s"',
                                  self._child_proc.pid, one_input)
            except subprocess.CalledProcessError as e:
                self._logger.info('operation="start subprocess", pid="%s", '\
                                  'status="failed", input="%s", reason="%s"',
                                  self._child_proc.pid, one_input, e.output)

            self._stderr_thd = Thread(target=self.read_stdpipe_and_write,
                                   args=(self._child_proc.stderr,
                                         self._stderr_file, sys.stderr,
                                         "stderr"))
            self._stdout_thd = Thread(target=self.read_stdpipe_and_write,
                                   args=(self._child_proc.stdout,
                                         self._stdout_file, sys.stdout,
                                         "stdout"))
            self._stderr_thd.daemon = True
            self._stdout_thd.daemon = True
            self._child_proc.stdin.write(json.dumps(one_input).encode())
            self._child_proc.stdin.close()
            self._stderr_thd.start()
            self._stdout_thd.start()

            self._stdout_thd.join(self._timeout)
            self._stderr_thd.join(self._timeout)
            if self._stderr_thd.is_alive() or self._stdout_thd.is_alive():
                msg = 'pid="{}" alert="{}" timeout={}'.format(
                    self._child_proc.pid, self._alert_name, self._timeout)
                self.kill_subprocess()
                raise aae.AlertTestSubprocessTimeoutFailure(msg)

            self._child_proc.wait()
            self._subprocess_out["exit_code"] = self._child_proc.returncode
            '''
            output, error = self._child_proc.communicate(
                                           input=json.dumps(one_input)+"\n")
            self.write_test_result(output, error)
            '''

    def clean_up(self):
        if self._input_sim_obj:
            self._input_sim_obj.clean_up()

        # if op.exists(self._code_test_dir):
        #     rmtree(self._code_test_dir)

    def run(self):
        try:
            self.start_subprocess()
        finally:
            self.clean_up()

        return self._subprocess_out
