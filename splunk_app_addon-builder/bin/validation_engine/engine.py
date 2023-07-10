# encoding = utf-8

from builtins import object
import traceback
import os
import json
import sys

from validation_engine import job
from validation_engine import validation_context
from validation_engine import engine_log
from validation_engine import base_rule
from validation_engine import utility


class Engine(object):
    def __init__(self,
                 splunk_server_uri="https://127.0.0.1:8089",
                 splunk_session_key=None,
                 conf_file=None,
                 logger=None):
        if logger:
            engine_log.set_logger(logger)
        self.logger = engine_log.get_logger()
        default_conf = os.path.join(os.path.split(__file__)[0], "engine.cfg")
        with open(default_conf, 'r') as f:
            self.conf = json.load(f)
            # resolve the content dir
            if os.path.isabs(self.conf['content']):
                self.content_path = self.conf['content']
            else:
                self.content_path = os.path.realpath(os.path.join(
                    os.path.split(__file__)[0], self.conf['content']))
            self.logger.info("Load engine default conf!")
        if conf_file and os.path.isfile(conf_file):
            with open(conf_file, 'r') as f:
                customer_conf = json.load(f)
                if not isinstance(customer_conf, dict):
                    self.logger.error("Skip invalid engine configuration <%s>!",
                                   customer_conf)
                else:
                    self.conf.update(customer_conf)
                    self.logger.info(
                        "Merge custom engine configuration <%s> to default conf.",
                        customer_conf)
                    if 'content' in self.conf:
                        if os.path.isabs(self.conf['content']):
                            self.content_path = self.conf['content']
                        else:
                            self.content_path = os.path.realpath(os.path.join(
                                os.path.split(os.path.realpath(conf_file))[
                                    0], self.conf['content']))
        else:
            self.logger.debug("Custom engine conf file <%s> not found.",
                              conf_file)
        engine_log.set_log_level(utility.get_log_level(self.conf['loglevel']))
        self.logger.debug("Init engine with conf <%s>", self.conf)
        self.splunk_server = splunk_server_uri
        self.session_token = splunk_session_key
        self.rules_by_category = {}
        self.rule_ids = {}  # use this to dedup rules
        self.active_jobs = {}
        # add content path to sys path to load rules
        sys.path.insert(0, self.content_path)

        self.logger.debug(
            "validation engine created. splunk_uri:%s, session_key:%s, content:%s",
            self.splunk_server, self.session_token, self.content_path)

    def start(self):
        # scan content_path, load all rules
        rule_specs = []
        for root_dir, sub_dirs, files in os.walk(self.content_path):
            for f in files:
                if f.endswith(".rule"):
                    rule_specs.append(os.path.join(root_dir, f))

        rules = []
        for spec in rule_specs:
            try:
                r = utility.create_rule_with_spec_file(spec)
                # skip the disabled rules
                if r is not None:
                    rules.append(r)
            except Exception as e:
                self.logger.error(
                    "Fail to load rule with spec %s. \nException: %s", spec,
                    traceback.format_exc())
        self.logger.debug("begin to register %d rules to engine.", len(rules))
        s, f = self.register_rules(rules)
        self.logger.debug("%d rules are added, %d rules fail to add.", len(s),
                          len(f))
        for c in list(self.rules_by_category.keys()):
            self.logger.debug("%d rules in category %s",
                              len(self.rules_by_category[c]), c)

    def _add_rule(self, rule):
        category = rule.spec[utility.RULE_CATEGORY]
        if not category in self.rule_ids:
            self.rule_ids[category] = set()
        if rule.spec[utility.RULE_ID] in self.rule_ids[category]:
            self.logger.warning(
                "rule <%s> exists in engine. Can not be added twice.",
                rule.spec)
            return False
        else:
            if category not in self.rules_by_category:
                self.rules_by_category[category] = []
            self.rules_by_category[category].append(rule)
            self.rule_ids[category].add(rule.spec[utility.RULE_ID])
            return True

    def register_rules(self, rule_list):
        success_ids = []
        fail_ids = []
        for r in rule_list:
            assert isinstance(r, base_rule.BaseRule), "Invalid param type"
            if self._add_rule(r):
                success_ids.append(r.spec[utility.RULE_ID])
            else:
                fail_ids.append(r.spec[utility.RULE_ID])
        return (success_ids, fail_ids)

    def start_validation_job(self, validation_job_id,
                             enabled_validation_categories, options):
        '''
        engine would put all the options into the context with namespace "global", options is a dict
        @return: return the validation job object.
        '''
        self.logger.debug("enabled categories: %s for job %s",
                          enabled_validation_categories, validation_job_id)
        if validation_job_id in self.active_jobs:
            self.logger.warning("[Engine] job <%s> has been started!",
                                validation_job_id)
            return self.active_jobs[validation_job_id]

        enabled_rules = []
        for category in enabled_validation_categories:
            if category in self.rules_by_category:
                enabled_rules.extend(self.rules_by_category[category])
            else:
                self.logger.error("[Engine] rule category <%s> not found!",
                                  category)
        # create a job and start it
        self.logger.debug("[Engine] found %d enabled rules",
                          len(enabled_rules))
        context = validation_context.Context(self, validation_job_id)
        # put options in Context
        for k, v in list(options.items()):
            context.set_global_property(k, v)
        validation_job = job.Job(enabled_rules, context)
        inited = validation_job.initialize()
        if not inited:
            raise Exception('fail to init validation job {}'.format(
                validation_job))
        validation_job.start()
        self.active_jobs[validation_job_id] = validation_job
        self.logger.debug("[Engine] validation job (%s) started.",
                          validation_job)
        return validation_job

    def kill_validation_job(self, validation_job_id):
        if validation_job_id in self.active_jobs:
            job = self.active_jobs[validation_job_id]
            self.logger.info("[Engine] kill validation job:%s", job)
            job.kill()
            del self.active_jobs[validation_job_id]
        else:
            self.logger.error("[Engine] Can not find validation job: %s",
                              validation_job_id)

    def get_active_validation_jobs(self):
        return list(self.active_jobs.values())

    def remove_finished_job(self, job_id):
        if job_id in self.active_jobs:
            self.logger.debug("[Engine] remove job %s from active job pool.",
                              job_id)
            del self.active_jobs[job_id]
        else:
            self.logger.error("[Engine] active job %s not found!", job_id)
