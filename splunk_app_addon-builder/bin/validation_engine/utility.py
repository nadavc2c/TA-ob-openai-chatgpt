# encoding = utf-8
from builtins import str
import sys
import traceback
import json
import logging

from validation_engine import engine_log

RULE_EXE = "rule_execution_status"
RULE_RET = "rule_return_value"

RULE_CATEGORY = "category"
RULE_NAME = "name"
RULE_CLASS = "class"
RULE_ID = "id"
RULE_PRIORITY = "priority"
RULE_DISABLE = "disabled"

g_logger = engine_log.get_logger()


def get_log_level(level_string):
    log_level = logging.INFO
    level = level_string.lower()
    if level == "info":
        log_level = logging.INFO
    elif level == "error":
        log_level = logging.ERROR
    elif level == "warning":
        log_level = logging.WARNING
    elif level == "debug":
        log_level = logging.DEBUG
    return log_level


def create_rule_with_spec_file(spec_file):
    with open(spec_file, 'r') as f:
        return create_rule_with_spec(json.load(f))


def _get_rule_class(rule_class_full_name):
    components = rule_class_full_name.split(".")
    if len(components) < 2:
        raise IOError("rule class name <{}> is not valid!".format(
            rule_class_full_name))

    mod = __import__(rule_class_full_name.rsplit('.', 1)[0])
    g_logger.debug("Load module <%s> %s. Module attrs:%s", components[0], mod,
                   dir(mod))
    for comp in components[1:]:
        mod = getattr(mod, comp)
    return mod


def create_rule_with_spec(spec):
    '''
    spec is a dict which contains the rule metas
    '''
    if not isinstance(spec, dict):
        raise IOError("Spec <{}> is not a dict! Bad input.".format(spec))
    if RULE_CLASS not in spec:
        raise IOError("{} not found in spec!".format(RULE_CLASS))
    if spec.get(RULE_DISABLE, False) == True:
        g_logger.info("Rule <%s> is disabled.", spec[RULE_ID])
        return None

    clz = _get_rule_class(spec[RULE_CLASS])
    g_logger.debug("Load rule class %s success!", spec[RULE_CLASS])
    return clz(spec)


def create_aysnc_rule(rule, context):
    def async_rule():
        try:
            rule.run(context)
            g_logger.debug("Run rule: %s", rule)
            context.incr_success_rule()
        except Exception as e:
            g_logger.error(
                "Validation job: %s, rule: %s, status: failure.\n %s",
                context.job_id, str(rule), traceback.format_exc())
            context.incr_failure_rule()

        g_logger.debug("Validation job: %s, rule: %s, status: success",
                       context.job_id, str(rule))

    return async_rule


def dump_all_threads():
    code = []
    for threadId, stack in list(sys._current_frames().items()):
        code.append("\n# ThreadID: %s" % threadId)
        for filename, lineno, name, line in traceback.extract_stack(stack):
            code.append('File: "%s", line %d, in %s' %
                        (filename, lineno, name))
            if line:
                code.append("    %s" % (line.strip()))

    return "\n".join(code)
