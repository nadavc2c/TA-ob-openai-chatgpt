# encoding = utf-8
from builtins import object
import traceback
import json
import re
from validation_engine import engine_log
from mako.template import Template


class BaseRule(object):
    REQUIRED_RULE_ATTR = ["id", "name", "category", "remedy_suggestion"]
    DEFAULT_RULE_ATTR = {
        "description": "",
        "dependency": "",
        "priority": 0,
        "weight": 1,
        "comment": "",
        "validation_results": {}
    }

    @staticmethod
    def preprocess_spec(spec):
        for i in BaseRule.REQUIRED_RULE_ATTR:
            if i not in spec:
                raise IOError("Attribute {} not found in spec {}!".format(
                    i, spec))
        return spec

    def __init__(self, rule_spec):
        if not isinstance(rule_spec, dict):
            raise IOError("Rule spec {} is not a dict!".format(rule_spec))

        self.logger = engine_log.get_logger()
        self.spec = dict(BaseRule.DEFAULT_RULE_ATTR)
        self.spec.update(rule_spec)
        self.logger.debug("Rule %s is created with rule_spec dict %s.",
                          self.spec, rule_spec)

        self.spec = BaseRule.preprocess_spec(self.spec)

    def __repr__(self):
        return "Validation Rule <{}>".format(self.spec)

    def run(self, validation_context, auto_remedy=False):
        self.context = validation_context
        self.logger.debug("Execute before_execute hook. rule:%s", self)
        self.before_execute(validation_context)
        self.logger.debug("Execute execute hook. rule:%s", self)
        ret = self.execute(validation_context)
        validation_context.set_property("rule_return_code", self.spec["name"],
                                        ret)
        self.after_execute(validation_context)
        self.logger.debug("Execute after_execute hook. rule:%s", self)
        if auto_remedy:
            try:
                self.remedy(ret, validation_context)
            except Exception as e:
                self.logger.error(
                    "Fail to auto remedy rule %s, return code %d. Exception: %s",
                    self.spec, ret, traceback.format_exc())

    def execute(self, validation_context):
        '''
        subclass must implement this
        '''
        raise NotImplementedError("validate method must be overwrite!")

    # 2 hook methods for validation
    def before_execute(self, validation_context):
        pass

    def after_execute(self, validation_context):
        pass

    def remedy(self, ret_value, validation_context):
        '''
        implement this remedy function.
        ret_value is the value return from execute method.
        '''
        pass

    def collect_validation_result(self, message_id, **params):
        spec_results = self.spec.get("validation_results").get(message_id)
        spect_text = json.dumps(spec_results)
        template = Template(text=spect_text)
        result = template.render(**params)
        result = re.sub("[\r\n\t\b]+", " ", result)
        actual_event = json.loads(result)

        event = {
            "validation_id": self.context.get_job_id(),
            "ta_name": self.context.get_global_property("app_name",
                                                        "unknown add-on name"),
            "rule_name": self.spec.get("name", "unknown rule name"),
            "category": self.spec.get("category", "unknown category"),
            "ext_data": {"is_visible": True},
            "message_id": message_id,
        }

        event.update(actual_event)

        self.context.collect_result_event(event)
        return event
