# encoding = utf-8

from future import standard_library
standard_library.install_aliases()
from builtins import object
import queue
import threading
import time

from validation_engine import engine_log
'''
Engine creates a context object for each validation job.
Validation rules use context object to pass arguments and write output events
'''

VALIDATION_ID = "validation_id"
VALIDATION_TIME = "validation_time"


class Context(object):
    global_namespace = "global_options"

    def __init__(self, engine, validation_id):
        self.engine = engine
        if engine:
            self.splunk_uri = self.engine.splunk_server
            self.session_key = self.engine.session_token
        else:
            self.splunk_uri = "https://127.0.0.1:8089"
            self.session_key = None
        self._result_queue = queue.Queue()
        self.job_id = validation_id
        self._prop_dict = {}
        self._prop_dict_lock = threading.Lock()
        self.failure_rule_count = 0
        self.success_rule_count = 0
        self._rule_count_lock = threading.Lock()
        self.logger = engine_log.get_logger()
        self.logger.debug(
            "validation context is created. splunk_uri:%s, splunk_session_key:%s",
            self.splunk_uri, self.session_key)

    def incr_failure_rule(self, delta=1):
        if delta <= 0:
            return None
        with self._rule_count_lock:
            self.failure_rule_count = self.failure_rule_count + delta
            return self.failure_rule_count

    def get_failure_rule_count(self):
        return self.failure_rule_count

    def incr_success_rule(self, delta=1):
        if delta <= 0:
            return None
        with self._rule_count_lock:
            self.success_rule_count = self.success_rule_count + delta
            return self.success_rule_count

    def get_success_rule_count(self):
        return self.success_rule_count

    def get_splunk_endpoint(self):
        return self.splunk_uri

    def get_splunk_session_key(self):
        return self.session_key

    def get_job_id(self):
        return self.job_id

    def result_queue_size(self):
        return self._result_queue.qsize()

    def collect_result_event(self, event):
        if not isinstance(event, dict):
            self.logger.error(
                "validation result event is not dict. Job=%s event=%s",
                self.job_id, event)
            return

        # add some common fields in events
        if VALIDATION_ID not in event:
            event[VALIDATION_ID] = self.job_id
        if VALIDATION_TIME not in event:
            event[VALIDATION_TIME] = int(time.time())
        self._result_queue.put(event)
        self.logger.debug("Job:%s, Collect event:%s. Queue Size:%d",
                          self.job_id, event, self._result_queue.qsize())

    def fetch_result_events(self, batch_size=3):
        fetch_count = 0
        results = []

        while fetch_count <= batch_size and not self._result_queue.empty():
            event = self._result_queue.get()
            self.logger.debug("Job:%s.  Fetch event:%s. Queue Size:%d",
                              self.job_id, event, self._result_queue.qsize())
            results.append(event)
            fetch_count += 1

        return results

    '''
        the property functions are used to share data among rules
    '''

    def set_property(self, namespace, key, value):
        with self._prop_dict_lock:
            if namespace not in self._prop_dict:
                self._prop_dict[namespace] = {}
            self.logger.debug("Job:%s, Set property. NS:%s, Key:%s, Value:%s",
                              self.job_id, namespace, key, value)
            self._prop_dict[namespace][key] = value
        self.logger.debug("set all properties: %s", self._prop_dict)

    def get_property(self, namespace, key, default_value=None):
        value = default_value
        with self._prop_dict_lock:
            if namespace in self._prop_dict:
                value = self._prop_dict[namespace].get(key, default_value)
        self.logger.debug("Job:%s, Get property. NS:%s, Key:%s, Value:%s",
                          self.job_id, namespace, key, value)
        self.logger.debug("get all properties: %s", self._prop_dict)
        return value

    def set_global_property(self, key, value):
        self.set_property(Context.global_namespace, key, value)

    def get_global_property(self, key, default_value=None):
        return self.get_property(Context.global_namespace, key, default_value)
