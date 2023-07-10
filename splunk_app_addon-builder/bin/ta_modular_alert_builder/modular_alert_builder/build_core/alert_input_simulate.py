from builtins import str
from builtins import range
from builtins import object
from ta_modular_alert_builder.modular_alert_builder.build_core import arf_consts as ac
from os import remove
from os import path as op
import json
from traceback import format_exc
import time
import gzip
import csv
import copy
from ta_modular_alert_builder.modular_alert_builder.build_core import alert_actions_exceptions as aae
from munch import Munch
from mako.template import Template
from mako.lookup import TemplateLookup
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_template import AlertActionsTemplateMgr
import splunklib.client as client
import splunklib.results as results


def simulate_alert_input(alert_input_setting=None, logger=None,
                         results_dir=None,
                         template_setting=None):
    sim_obj = AlertInputSimulator(alert_input_setting=alert_input_setting,
                                  logger=logger,
                                  template_setting=template_setting)
    return sim_obj


class SearchCreater(object):
    def __init__(self, alert_input_setting, logger):
        self._logger = logger
        self._setting = alert_input_setting
        self._spl = self._setting.get("search")
        self._events_num = self._setting.get("events_number")
        self.session_key = self._setting["stdin_fields"]["session_key"]
        self.server_host = self._setting["stdin_fields"]["server_host"]
        self.server_port = self._setting["stdin_fields"]["server_port"]

    def get_results(self):
        service = client.connect(host=self.server_host,
                                 port=self.server_port,
                                 token=self.session_key)
        query = self._spl + "|head " + str(self._events_num)
        self._logger.info('query="%s"', query)
        job = service.jobs.create(query)

        #wait till the search ready
        while not job.is_ready():
            time.sleep(0.5)
        parsed_results = []
        for rul in results.ResultsReader(job.results()):
            parsed_results.append(copy.deepcopy(rul))

        return {
            "sid": job.sid,
            "results": parsed_results
        }

    def create(self):
        return self.get_results()


class AlertInputSimulator(object):
    CURRENT_DIR = op.dirname(op.abspath(__file__))
    DEFAULT_EVENT_DEFAULT_SETTING_FILE = op.join(CURRENT_DIR,
                                                 "alert_results.default.json")
    DEFAULT_TEMPLATE_INPUT = "alert_input.template"

    def __init__(self, alert_input_setting=None, logger=None, results_dir=None,
                 template_setting=None):
        '''
        alert_input_setting is a dict like:
        {
            "event_default_setting_file": /abspath/to/a/json/file,
            "alert_mode": "single" or "combined",
            "stdin_fields": {
                "session_key": sfowiefjhwoeig,
                "server_uri": ...,
                ...
                },
            "configuration": {
                # Those are fields and values from param.*
                "custom_field1": "custom_value1",
                "custom_field2": "custom_value2",
            }
        }
        '''
        self._setting = alert_input_setting
        self._default_setting = None
        self.get_default_setting()
        self._logger = logger
        self._tmp_setting = template_setting
        self.init_settings()
        self._clean_files = []
        self._results_dir = results_dir or AlertInputSimulator.CURRENT_DIR

    def init_settings(self):
        if self._setting:
            self._alert_mode = self._setting.get("alert_mode") or \
                self._default_setting.get("alert_mode")
            self._configuration = self._setting.get("configuration") or {}
            self._stdin_data = self._setting.get("stdin_fields") or \
                self._default_setting.get("stdin_fields")
        else:
            self._alert_mode = None
            self._configuration = {}
            self._stdin_data = {}

        if self._tmp_setting:
            self._tmp_mgr = AlertActionsTemplateMgr(
                self._tmp_setting.get("template_dir"))
            self._template_input = self._tmp_setting.get("template_input_file") or \
                AlertInputSimulator.DEFAULT_TEMPLATE_INPUT
            self._tmp_lookup_dir = self._tmp_setting.get("template_lookup_dir")
        else:
            self._tmp_mgr = AlertActionsTemplateMgr()
            self._template_input = AlertInputSimulator.DEFAULT_TEMPLATE_INPUT
            self._tmp_lookup_dir = None

    def get_default_setting(self):
        setting_file = self._setting.get("event_default_setting_file") or \
            AlertInputSimulator.DEFAULT_EVENT_DEFAULT_SETTING_FILE

        try:
            with open(setting_file, 'r') as ds:
                    self._default_setting = json.loads(ds.read())
        except IOError:
            msg = 'operation="read", object="{}", status="failed", reason="{}"'.format(
                setting_file, format_exc())
            raise aae.AlertActionsFailedToLoadInputSettingJson(msg)

        self._default_setting_file = setting_file

    def merge_with_default_setting(self):
        merged_setting = {}
        for k, v in list(self._default_setting.items()):
            if k == "sample_result":
                continue
            if isinstance(v, dict):
                merged_setting[k] = copy.deepcopy(v)
                if self._setting.get(k):
                    merged_setting[k].update(self._setting.get(k))
            else:
                merged_setting[k] = self._setting.get(k) or v

        '''
        # handle events
        if not self._setting.get(ac.RESULTS):
            merged_setting[ac.RESULTS] = self._default_setting.get(ac.RESULTS)
        else:
            merged_setting[ac.RESULTS] = []
            default_result = self._default_setting[ac.RESULTS][0]
            for result in self._setting[ac.RESULTS]:
                tmp = copy.deepcopy(default_result)
                tmp.update(result)
                for k, v in tmp.items():
                    if k in ["_time", "_index_time"] and not tmp.get(k):
                        tmp[k] = time.time()
                merged_setting[ac.RESULTS].append(tmp)
        '''

        for k, v in list(self._setting.items()):
            if k not in list(merged_setting.keys()):
                merged_setting[k] = v

        self._logger.debug('merged_setting="%s"', merged_setting)
        return merged_setting

    def generate_sample_results(self, setting):
        sample_result = self._default_setting.get("sample_result")
        if not sample_result:
            self._logger.error('event="No sample result in default_setting",' +
                               'default_setting="%s"',
                               self._default_setting)
            return

        results = []
        self._logger.info('event="Generate %s results from sample"',
                          setting["events_number"])
        for num in range(setting["events_number"]):
            rsl = copy.deepcopy(sample_result)
            rsl["_time"] = time.time()
            rsl["timestamp"] = time.time() + 1
            rsl["_index_time"] = time.time() + 2
            results.append(rsl)
        return results

    def generate_input_setting(self):
        # merge
        merged_setting = self.merge_with_default_setting()

        search_obj = SearchCreater(merged_setting, self._logger)
        search_results = search_obj.create()
        merged_setting["stdin_fields"]["sid"] = search_results["sid"]
        merged_setting["results"] = search_results["results"]
        if not merged_setting.get("results"):
            merged_setting["results"] = self.generate_sample_results(merged_setting)

        # simulate from template file
        setting_obj = Munch.fromDict(merged_setting)
        tmp_lookup = None
        if self._tmp_lookup_dir:
            tmp_lookup = TemplateLookup(directories=[self._tmp_lookup_dir])

        template_path = self._template_input
        if not op.isabs(self._template_input):
            template_path = op.join(self._tmp_mgr.get_template_dir(),
                                    self._template_input)
        template = Template(filename=template_path, lookup=tmp_lookup)
        render_input = template.render(alert_input_setting=setting_obj)
        render_input = render_input.replace(" None,", " null,")
        render_input = render_input.replace('"\s*None\s*",', " null,")
        render_input = render_input.replace(" None", " null")
        return render_input

    def write_results_file(self, header, results, index=None):
        if index:
            file_name = "result" + str(index) + ".csv.gz"
        else:
            file_name = "results" + ".csv.gz"
        file_path = op.join(self._results_dir, file_name)
        self._clean_files.append(file_path)

        try:
            with gzip.open(file_path, 'wt') as gf:
                cw = csv.DictWriter(gf, header)
                cw.writeheader()
                cw.writerows(results)
        except IOError:
            msg = 'operation="write", object="simed result", to="{}",'\
                'status="failed", reason="{}"'.format(file_path, format_exc())
            raise aae.AlertTestWritingFileFailure(msg)
        return file_path

    def generate_alert_stdin(self):
        input_setting = self.generate_input_setting()
        try:
            inputs = json.loads(input_setting)
        except ValueError:
            msg = 'input_setting="{}", status="failed", reason="{}"'.format(
                input_setting, format_exc())
            raise aae.AlertActionsFailedToLoadInputSettingJson(msg)

        arf_inputs = []
        self._logger.info('alert_mode="%s"', self._alert_mode)
        if self._alert_mode == "Single":
            # For each event, generate an stdin input
            for index, result in enumerate(inputs[ac.RESULTS]):
                input = {}
                input.update(inputs[ac.STDIN_FIELDS])
                input[ac.RESULTS_FILE] = self.write_results_file(list(result.keys()),
                                                                 [result],
                                                                 index+1)
                input[ac.RESULT] = result
                arf_inputs.append(copy.deepcopy(input))
            self._logger.info('arf_inputs="%s"', arf_inputs)
            return arf_inputs
        elif self._alert_mode == "Combined":
            # write all events in one stdin input
            input = {}
            input.update(inputs[ac.STDIN_FIELDS])
            input[ac.RESULTS_FILE] = self.write_results_file(
                list(inputs[ac.RESULTS][0].keys()), inputs[ac.RESULTS])
            input[ac.RESULT] = inputs[ac.RESULTS][0]
            return [input]
        else:
            msg = 'operation="Simulate alert input", status="failed", '
            'reason="alertmode {} is not supported"'.format(self._alert_mode)
            raise aae.AlertTestInputUnsupportedMode(msg)

    def clean_up(self):
        self._logger.info('operate="clean_up", object="clean_files"'.format())
        for file in self._clean_files:
            if not op.isfile(file):
                continue
            try:
                remove(file)
            except Exception:
                self._logger.error('operate="delete", object="{}", '\
                                   'status="failed", reason="{}"'.format(
                                       file, format_exc()))
            self._logger.debug('operate="clean_up", object="{}", '.format(
                file))

    def simulate(self):
        results = self.generate_alert_stdin()
        return results
