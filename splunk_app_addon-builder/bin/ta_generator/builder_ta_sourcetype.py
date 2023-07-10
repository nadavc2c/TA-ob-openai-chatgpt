from builtins import object
import os
import sys



sys.path.append(os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps',
                             'splunk_app_addon-builder', 'bin'))
from sourcetype_builder.sourcetype_builder import SourcetypeBuilder
from tabuilder_utility import common_util
from aob.aob_common.metric_collector import metric_util

class TASourcetypeBuilder(object):
    @metric_util.function_run_time(tags=['sourcetype_builder'])
    def __init__(self, app_name, splunk_uri, session_key, service_with_tab_context=None, service_with_ta_context=None):
        if service_with_ta_context:
            self.service = service_with_ta_context
        else:
            self.service = common_util.create_splunk_service(session_key, splunk_uri, app_name)
        self.splunk_endpoint = splunk_uri
        self.splunk_session_key = session_key
        if not service_with_tab_context:
            service_with_tab_context = common_util.create_splunk_service(session_key, splunk_uri)
        self.st_builder = SourcetypeBuilder(app_name, splunk_uri, session_key, service_with_tab_context, self.service)

    @metric_util.function_run_time(tags=['sourcetype_builder'])
    def create_sourcetype(self, sourcetype, key_values, fail_if_sourcetype_exists=True):
        return self.st_builder.create_sourcetype(sourcetype, key_values, fail_if_sourcetype_exists)

    def import_sourcetype(self, sourcetype, source_app=None, key_values=None):
        self.st_builder.import_sourcetype(sourcetype, source_app, key_values)

    def update_sourcetype(self, sourcetype, key_values, check_exist=False):
        return self.st_builder.update_sourcetype(sourcetype, key_values, check_exist)

    def delete_sourcetype(self, sourcetype=None):
        self.st_builder.delete_sourcetype(sourcetype)

    def get_all_sourcetype_names(self):
        return self.st_builder.get_all_sourcetype_names()

    def get_sourcetype_summary(self):
        return {'sourcetype_count': len(self.get_all_sourcetype_names())}

    def get_sourcetypes(self):
        return self.st_builder.get_sourcetype_meta()

    def update_meta(self, sourcetype, key_values):
        self.st_builder.update_meta(sourcetype, key_values)

    def get_index_time_extractions(self):
        return self.st_builder.get_index_time_extractions()
