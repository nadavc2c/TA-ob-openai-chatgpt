# encoding = utf-8
import validation_engine.base_rule as brule
from tabuilder_utility.temp_manager import TempManager
from aob.aob_common import logger

from validation_app_cert.app_cert import AppCert
from tabuilder_utility.validation_utility import *
from aob.aob_common.metric_collector import metric_util
from validation_app_cert.app_cert_const import *

NAMESPACE = "validation_app_cert"
TA_BUILDER_APP_NAME = "splunk_app_addon-builder"

_LOGGER = logger.get_app_cert_validator_logger()
import logging
_LOGGER.setLevel(logging.DEBUG)

class RuleAppCert(brule.BaseRule):
    def __init__(self, spec):
        super(RuleAppCert, self).__init__(spec)

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def execute(self, validation_context):
        self.splunk_endpoint = validation_context.get_splunk_endpoint()
        self.splunk_session_key = validation_context.get_splunk_session_key()

        self.app_name = validation_context.get_global_property("app_name")
        self.vid = validation_context.get_job_id()
        self.temp_mgr = TempManager()

        self.app_cert = AppCert(self.splunk_endpoint, self.splunk_session_key, self.app_name)
        self.validate()

    def validate(self):
        try:
            res = self.app_cert.run()
        except:
            res = {"error": "7006"}

        # some exceptions
        err = res.get("error")
        if err:
            self.collect_validation_result(err)
            return

        for item in res.get("data"):
            status = item.get("status")
            if status in ("success", ):
                self.collect_validation_result("7000",
                    desc=item.get("desc"),
                    sub_category=item.get("category"))
            elif status in ("error", ):
                self.collect_validation_result("7001",
                    desc=item.get("desc"),
                    sub_category=item.get("category"),
                    solution=item.get("solution"))
            elif status in ("failure", ):
                solution = item.get("solution")
                if item.get("has_messages"):
                    self.collect_validation_result("7004",
                        desc=item.get("desc"),
                        messages=solution,
                        sub_category=item.get("category"))
                else:
                    self.collect_validation_result("7002",
                        desc=item.get("desc"),
                        sub_category=item.get("category"),
                        solution=solution)
