from builtins import object
import logging
import os
import shutil

from ta_meta_management import meta_manager, meta_const
from aob.aob_common import builder_constant, logger
from tabuilder_utility import tab_conf_manager, \
    workspace_util, common_util, validation_utility, search_util, builder_exception
from tabuilder_utility.ko_util import ko_common_util, sourcetype_util
from validation_engine.engine import Engine
from ta_generator import builder
import tarfile

_LOGGER = logger.get_validation_logger(logging.INFO)

class TAValidationBuilder(object):
    """
    Data structure of the validation meta:
    {
        app_name: {
            validation_id: id,
            status: started | finished | error,
            error: {
                err_code: 4001,
                err_args: {app_name: test},
                message:
                traceback:
            },
            progress: 0.3,
            validators: ["best_practice_validation", "app_cert_validation", ...]
        }
    }
    """

    def __init__(self, splunk_uri, session_key, app_name):
        self.splunk_uri = splunk_uri
        self.session_key = session_key
        self.app_name = app_name
        self.service = common_util.create_splunk_service(session_key,
                                                         splunk_uri, app_name)
        self.meta_mgr = meta_manager.create_meta_manager(
            session_key, splunk_uri, meta_const.TA_VALIDATION_NS, app_name)
        self.conf_mgr = tab_conf_manager.create_tab_conf_manager(
            session_key, splunk_uri, app_name)
        self.tab_conf_mgr = tab_conf_manager.create_tab_conf_manager(
            session_key, splunk_uri, builder_constant.ADDON_BUILDER_APP_NAME)
        self.engine = Engine(splunk_uri, session_key)
        self.engine.start()
        self.ta_folder = None

    def start_validation_job(self, validators):
        input_type = builder_constant.VALIDATION_MI
        vid = validation_utility.new_validation_id()
        key_values = {
            "validation_id": vid,
            "validators": ",".join(validators),
        }
        self.cancel_validation_job()
        self.meta_mgr.update_app_meta_data({
            "validators": validators,
            "status": validation_utility.JOB_STATUS_STARTED,
            "validation_id": vid,
        }, update_last_modify=False)
        self.tab_conf_mgr.create_data_input(input_type, self.app_name,
                                            key_values)
        return vid

    def cancel_validation_job(self):
        self.delete_data_input()
        self.delete_checkpoint()
        self.delete_meta()
        validation_utility.restore_props_conf(self.app_name)

    def delete_data_input(self):
        input_type = builder_constant.VALIDATION_MI
        self.tab_conf_mgr.delete_data_input(input_type, self.app_name)

    def delete_checkpoint(self):
        splunk_home = os.environ["SPLUNK_HOME"]
        checkpoint_file = os.path.join(
            splunk_home, "var", "lib", "splunk", "modinputs",
            builder_constant.VALIDATION_MI, self.app_name)
        if os.path.isfile(checkpoint_file):
            os.remove(checkpoint_file)

    def delete_meta(self):
        self.meta_mgr.set_app_meta_data({}, update_last_modify=False)

    def load_last_validation_status(self):
        metadata = self.meta_mgr.get_app_meta_data()
        if not metadata:
            return None

        vid = metadata.get("validation_id")
        validators = metadata.get("validators")
        status = metadata.get("status", validation_utility.JOB_STATUS_FINISHED)
        if vid and status in (validation_utility.JOB_STATUS_STARTED, validation_utility.JOB_STATUS_FINISHED):
            return {"validation_id": vid, "validators": validators}
        return None

    def get_validation_status(self):
        meta = self.meta_mgr.get_app_meta_data() or {}
        return meta

    def remove_all_validation_data_inputs(self):
        """
        Cleanup the data inputs except the monitor data input
        """
        input_type = builder_constant.VALIDATION_MI
        data_inputs = self.tab_conf_mgr.get_data_input(input_type)

        for data_input in data_inputs:
            name = data_input.get("name")
            if name == builder_constant.VALIDATION_MONITOR_MI:
                continue
            self.cancel_validation_job()

    def get_validation_job(self, validators, vid):
        pre_params = self.job_pre_condition(vid, validators)

        options = {validation_utility.JOB_TARGET_TA: self.app_name}
        if self.ta_folder:
            options["ta_folder"] = self.ta_folder
        job = self.engine.start_validation_job(
            validation_job_id=vid,
            enabled_validation_categories=validators,
            options=options)

        context = job.get_validation_context()
        context.set_global_property("app_name", self.app_name)

        self.set_context(context, pre_params)
        return job

    def job_pre_condition(self, vid, validators):
        res = {"errors": []}

        # create the ta_folder when best_practice validation is enabled
        if validation_utility.BEST_PRACTICE_CATEGORY in validators:
            self.ta_folder = self._generate_ta_folder()

        # get the raw events when field_extraction validation is enabled
        if validation_utility.FIELD_EXTRACT_CATEGORY in validators:
            search_result_dir = "search_results_{}".format(vid)
            res['search_result'] = search_result_dir

            sourcetypes = sourcetype_util.get_app_sourcetypes(self.conf_mgr)
            valid_sourcetypes = []
            # validate the sourcetype name
            for sourcetype in sourcetypes:
                if sourcetype_util.is_sourcetype_valid(sourcetype):
                    valid_sourcetypes.append(sourcetype)
                else:
                    err = {"message_id": "101", "options":{"sourcetype": sourcetype}}
                    res["errors"].append(err)

            res["sourcetypes"] = valid_sourcetypes

            app_stanzas = self.conf_mgr.get_conf_stanza("props", curr_app_only=True, remove_default_properties=True)
            validation_utility.backup_props_conf(self.app_name)

            try:
                ko_common_util.remove_extractions_from_props(app_stanzas, self.app_name)
                err_sourcetypes = search_util.dump_events(self.service, vid, valid_sourcetypes, search_result_dir)

                for sourcetype in err_sourcetypes:
                    err = {"message_id": "100", "options": {"sourcetype": sourcetype}}
                    res["errors"].append(err)

            except Exception as e:
                raise e
            finally:
                validation_utility.restore_props_conf(self.app_name)
        return res

    def set_context(self, context, key_values):
        for k, v in list(key_values.items()):
            context.set_property("validation_field", k, v)

    @classmethod
    def get_validation_results(cls, job):
        context = job.get_validation_context()
        events = context.fetch_result_events(1000)
        return events

    @classmethod
    def get_job_progress(cls, job):
        context = job.get_validation_context()
        total_count = job.get_rule_count()
        fail_count = context.get_failure_rule_count()

        if fail_count > 0:
            ce = builder_exception.CommonException(err_code=6013)
            raise ce

        success_count = context.get_success_rule_count()
        finished_count = success_count + fail_count
        progress = 1.0 * finished_count / total_count
        return progress

    def update_validation_status(self, status, progress=None, error=None):
        if error is None:
            error = {}
        meta = self.meta_mgr.get_app_meta_data() or {}

        meta["status"] = status

        if progress:
            meta["progress"] = progress

        if error:
            meta["error"] = error

        self.meta_mgr.update_app_meta_data(meta, update_last_modify=False)

    def remove_validation_status(self):
        self.meta_mgr.delete_app_meta_data(update_last_modify=False)

    def _generate_ta_folder(self):
        '''
        copy the project to a target folder and merge the conf,
        because best practice validator will not scan the local conf folder
        return the generated folder
        '''
        target_folder = os.path.join(builder_constant.ADDON_BUILDER_APP_NAME,
                                     'local', 'validation', self.app_name)
        # copy the ta project to package workspace dir
        app_path = common_util.make_splunk_path(['etc', 'apps', self.app_name])
        tabuilder = builder.TABuilder(self.app_name, self.splunk_uri,
                                      self.session_key)
        tgz_file = workspace_util.package_app(tabuilder)

        validation_package_workspace = common_util.make_splunk_path(['etc', 'apps', builder_constant.ADDON_BUILDER_APP_NAME, 'local', 'validation'])
        ta_folder = os.path.join(validation_package_workspace, self.app_name)
        if os.path.isdir(ta_folder):
            shutil.rmtree(ta_folder)
        with tarfile.open(tgz_file, 'r:*') as tf:
            tf.extractall(validation_package_workspace)

        return target_folder
