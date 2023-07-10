# encoding = utf-8

max_thread = 8
task_queue_size = 1024

import threading
import traceback

from executor_service.concurrent.concurrent_executor import ConcurrentExecutor
from validation_engine import utility
from validation_engine import engine_log


class Job(threading.Thread):
    def __init__(self, enabled_rules, validation_context):
        if not isinstance(enabled_rules, list):
            raise IOError("enabled_rules must be a list.")
        super(Job, self).__init__(
            name="Job:{}".format(validation_context.job_id))
        self.daemon = True
        self.rules = enabled_rules
        self.added_rules = {}
        self.rule_groups = {}
        self.rule_count = 0
        self.context = validation_context
        self.id = validation_context.job_id
        self.execution_service = ConcurrentExecutor({
            "thread_max_size": max_thread,
            "task_queue_size": task_queue_size,
            "daemonize_thread": True
        })
        self.logger = engine_log.get_logger()
        self.exc = None
        self.stop = threading.Event()
        self.logger.info("%s is created. %d Enable rules.", self,
                         len(self.rules))

    def initialize(self):
        try:
            self._collect_all_rules()
            return True
        except Exception as e:
            self.logger.error('Error when initialize job %s. %s', self,
                              traceback.format_exc())
            return False

    def __repr__(self):
        return ("ValidationJob:{{ id:{}, rule_count:{} }}".format(
            self.id, self.get_rule_count()))

    def get_rule_count(self):
        return self.rule_count

    def get_validation_context(self):
        return self.context

    def run(self):
        '''
         this should be async call
        '''
        self.execution_service.start()

        try:
            rule_priorities = list(self.rule_groups.keys())
            for p in sorted(rule_priorities):
                if self.stop.is_set():
                    return
                self._dispatch_rules(self.rule_groups[p])
        except Exception as e:
            self.logger.error(
                "[%s] Exception caught in validation job thread. %s",
                self.name, traceback.format_exc())
            self.exc = e
            raise e
        finally:
            self.stop.set()
            self.execution_service.tear_down()

    def kill(self):
        #stop the execution pool, and stop the thread
        self.execution_service.tear_down()
        self.stop.set()

    def _collect_all_rules(self):
        for rule in self.rules:
            p = rule.spec[utility.RULE_PRIORITY]
            if p not in self.rule_groups:
                self.rule_groups[p] = []
                self.added_rules[p] = set()
            if rule.spec[utility.RULE_ID] in self.added_rules[p]:
                self.logger.info(
                    "Rule %s is in the rule group. Do not add it again.", rule)
                continue
            self.rule_groups[p].append(rule)
            self.added_rules[p].add(rule.spec[utility.RULE_ID])
            self.rule_count += 1
        self.logger.debug("%d rules is collected!", self.rule_count)

    # run rules in the job thread
    # def _dispatch_rules(self, rule_list):
    #     return_val = []
    #     for rule in rule_list:
    #         async_func = utility.create_aysnc_rule(rule, self.context)
    #         return_val.append(async_func())
    #     self.logger.debug("[{0}] {1} rules executed. {2}".format(
    #         self.name, len(
    #             rule_list), return_val))

    def _dispatch_rules(self, rule_list):
        '''
        submit rules to thread pool
        '''
        return_val = []
        for rule in rule_list:
            async_func = utility.create_aysnc_rule(rule, self.context)
            return_val.append(self.execution_service.run_io_func_async(
                async_func))
        self.logger.debug("[%s] %d rules dispatched.", self.name,
                          len(return_val))
        while not (not return_val):
            return_val[0].wait(3)  # wait until the first rule is done
            if (self.stop.is_set()):
                self.logger.info("[%s] Validtion job %s stopped.", self.name,
                                 self.id)
                return
            return_val = [v for v in return_val if not v.ready()]
        self.logger.debug("[%s] %d rules executed.", self.name, len(rule_list))
