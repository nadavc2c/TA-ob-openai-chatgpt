# encoding = utf-8

import validation_engine.base_rule
from validation_rules.validation_best_practice import test_matinal


class MatinalRule(validation_engine.base_rule.BaseRule):
    def __init__(self, spec):
        super(MatinalRule, self).__init__(spec)
        self.case = self.spec['case_name']
        self.martinal_test = test_matinal.TestMatinal()

    def execute(self, validation_context):
        self.logger.debug("execute matinal rule %s", self.case)
        result = self.martinal_test.run_test_case(self.case)
        for r in result:
            rid = r.get('result_id', None)
            rparam = r.get('result_param', {})
            self.logger.debug(
                'Best practice %s: get events with rid %s and params %s',
                self.spec['name'], rid, rparam)
            self.collect_validation_result(rid, **rparam)

    def before_execute(self, validation_context):
        # app name is set by TAValidator
        self.app_name = validation_context.get_global_property("app_name")
        self.ta_folder = validation_context.get_global_property('ta_folder')
        self.logger.debug('setup matinal case with ta_folder:%s',
                          self.ta_folder)
        self.martinal_test.setup_class(ta_folder=self.ta_folder)
        self.martinal_test.appname = self.app_name
