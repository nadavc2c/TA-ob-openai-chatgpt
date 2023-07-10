import json
import os
import shutil
import tarfile
from builtins import object
from builtins import str

from aob.aob_common import logger, global_setting_util, package_util, conf_parser
from aob.aob_common.builder_constant import ADDON_BUILDER_APP_NAME
from ta_generator import builder, builder_ta_input
from ta_generator.ta_static_asset_repository import AssetRepository
from ta_meta_management import meta_manager, meta_util, meta_manager_event, meta_const
from tabuilder_utility import common_util
from tabuilder_utility import workspace_util
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.ucc_migration_utils import UccMigration
from tabuilder_utility.addon_version_validator import AddonVersionValidator

_logger = logger.get_builder_util_logger()


class AppMigrator(object):
    EVENT_FILE = package_util.get_dumped_event_file_name()

    def __init__(self, app, splunk_uri, session_key):
        self.app = app
        self.tabuilder = builder.TABuilder(
            app, uri=splunk_uri, session_key=session_key)
        self.service = self.tabuilder.tab_service

    def _get_export_package_name(self, workspace):
        ver = package_util.get_app_version(workspace).replace(".", "_")
        return '{}_{}_export.tgz'.format(self.app, ver)

    def get_exported_file_full_path(self, workspace):
        return workspace_util.get_package_file_full_path_with_package_name(
            self._get_export_package_name(workspace))

    def _dump_add_on_project_meta(self, workspace):
        '''
        dump all the meta data from KVstore
        '''
        meta = meta_manager.MetaManager.get_app_all_meta(
            self.service, self.app)
        if not meta:
            raise CommonException(
                e_message='fail to get the meta for project ' + self.app,
                err_code=34,
                options={'app': self.app})
        meta = meta_util.remove_user_credential_in_meta(meta)
        output_file = os.path.join(
            workspace, package_util.get_aob_meta_file_name(self.app))
        with open(output_file, 'w') as f:
            json.dump(meta, f)
        _logger.info('dump the app %s meta', self.app)
        return meta

    def _dump_sample_events(self, sourcetype_list, workspace):
        mgr = meta_manager_event.EventMetaManager(
            None, None, service=self.service)
        sample_events = mgr.get_events_with_sourcetypes(sourcetype_list)
        events_file = os.path.join(workspace, self.EVENT_FILE)
        with open(events_file, 'w') as f:
            json.dump(sample_events, f)
        _logger.info(
            'exporting project:%s, dump all the events in sourcetypes:%s',
            self.app, ','.join(sourcetype_list))

    def export_project(self):
        # copy the ta project to package workspace dir
        app_path = common_util.make_splunk_path(['etc', 'apps', self.app])
        package_workspace = common_util.make_splunk_path(
            ['var', 'data', 'tabuilder', 'export_ta', self.app])
        # not packaging the project, do not merge the confs
        workspace_util.prepare_app_package_workspace(package_workspace,
                                                     app_path, self.tabuilder)
        # remove the local UCC conf files, UCC conf may be encrypted
        confs = [
            self.app + '_credential.conf', self.app + '.conf',
            self.app + '_customized.conf', 'password.conf', 'passwords.conf'
        ]
        confs.extend(global_setting_util.get_ucc_conf_file_names(self.app))
        for c in set(confs):
            conf_path = os.path.join(package_workspace, 'local', c)
            if os.path.isfile(conf_path):
                os.remove(conf_path)
                _logger.debug('Remove the UCC conf ' + c)
        # remove all the inputs stanza configured in UCC, it is runtime info
        local_inputs = os.path.join(package_workspace, 'local', 'inputs.conf')
        if os.path.isfile(local_inputs):
            parser = conf_parser.TABConfigParser()
            parser.read(local_inputs)
            to_be_delete_sections = [s for s in parser.sections() if len(s.split("://")) == 2]
            for s in to_be_delete_sections:
                parser.remove_section(s)
            if to_be_delete_sections:
                with open(local_inputs, 'w') as fp:
                    parser.write(fp)
                _logger.debug('update the local inputs.conf.')

        # export the meta to the package_workspace
        meta = self._dump_add_on_project_meta(package_workspace)
        if meta_const.SOURCETYPE_BUILDER in meta:
            sourcetypes = list(meta[meta_const.SOURCETYPE_BUILDER].keys())
            if sourcetypes:
                self._dump_sample_events(sourcetypes, package_workspace)

        AppMigrator._rm_hidden_files(package_workspace)

        download_file = self.get_exported_file_full_path(package_workspace)
        if os.path.isfile(download_file):
            os.remove(download_file)
        with tarfile.open(download_file, "w:gz") as tar:
            tar.add(package_workspace, arcname=self.app)
        return download_file

    @staticmethod
    def _is_hidden_path(path):
        return path and path[0] == '.'

    @classmethod
    def _rm_hidden_files(cls, app_root_dir):
        '''
        All hidden files should be removed. There is no hidden files in the projects.
        '''
        if app_root_dir:
            for root, dirs, files in os.walk(app_root_dir):
                for d in dirs:
                    if AppMigrator._is_hidden_path(d):
                        p = os.path.join(root, d)
                        shutil.rmtree(p)
                        _logger.info('Remove hidden directory %s in project.',
                                     p)
                for f in files:
                    if AppMigrator._is_hidden_path(f):
                        p = os.path.join(root, f)
                        os.remove(p)
                        _logger.info('Remove hidden file %s in project.', p)

    @classmethod
    def _read_app_meta(cls, app_root_dir):
        if app_root_dir:
            for root, dirs, files in os.walk(app_root_dir):
                for fname in files:
                    _logger.debug('read_app_meta, Check file %s', fname)
                    if fname.endswith('.aob_meta'):
                        app_name = fname[0:fname.find('.aob_meta')]
                        meta_file = os.path.join(root, fname)
                        with open(meta_file, 'r') as meta_f:
                            _logger.info('Read project meta from file %s',
                                         meta_file)
                            return (app_name, json.load(meta_f))
        return (None, None)

    @classmethod
    def import_project(cls, app_package_file, service):
        '''
        app_package_file should be the full file path.
        No return value. If fails, an exception is thrown
        '''

        temp_dir = UccMigration().import_addon(app_package_file)
        AppMigrator._rm_hidden_files(temp_dir)
        app_name, meta = cls._read_app_meta(temp_dir)
        if not app_name:
            raise CommonException(
                e_message='can not load ta meta.', err_code=35)
        extracted_app_root = os.path.join(temp_dir, app_name)
        if not os.path.isdir(extracted_app_root):
            raise CommonException(
                e_message=
                'package root directory is not consistent with app_name.',
                err_code=38)
        validation_code, validation_args = AddonVersionValidator(app_name, extracted_app_root).validate_addon()
        # check if the app already exists in apps dir
        app_root = common_util.make_splunk_path(['etc', 'apps', app_name])
        if os.path.isdir(app_root):
            raise CommonException(
                e_message='can not load ta meta. App dir already exists.',
                err_code=37,
                options={'app': app_name})

        meta_manager.MetaManager.load_app_all_meta(
            service, app_name, meta, overwrite=False)
        # load the events to meta
        events_file = os.path.join(extracted_app_root, cls.EVENT_FILE)
        if os.path.isfile(events_file):
            with open(events_file, 'r') as fp:
                events = json.load(fp)
                mgr = meta_manager_event.EventMetaManager(
                    None, None, service=service)
                for key, value in list(events.items()):
                    mgr.update_meta_data(key, value)
        # remove all the UCC related confs, UCC confs may be encrypted
        ucc_files = [
            os.path.join(extracted_app_root, 'local', i)
            for i in global_setting_util.get_ucc_conf_file_names(app_name)
        ]
        _logger.debug('All UCC files:%s', ucc_files)
        for f in ucc_files:
            if os.path.isfile(f):
                _logger.debug('remove ucc file:%s', f)
                os.remove(f)

        cls.handle_imported_package_readme(extracted_app_root)
        # move the dir to the etc/apps
        shutil.move(extracted_app_root, os.path.dirname(app_root))
        # regenerate the inputs.conf, in case there is some encrypted fields in the stanza
        input_builder = builder_ta_input.TAInputBuilder(
            app_name, common_util.get_splunkd_uri(service), service.token)
        input_builder.regenerate_inputs_conf()
        _logger.debug('regen inputs.conf when importing TA:%s', app_name)

        # cleanup the meta files
        events_file = os.path.join(app_root, cls.EVENT_FILE)
        if os.path.isfile(events_file):
            os.remove(events_file)
        os.remove(
            os.path.join(app_root,
                         package_util.get_aob_meta_file_name(app_name)))
        # reload the apps
        common_util.reload_splunk_apps(service)
        # return the basic info for this app
        brief_meta = meta_util.get_project_brief_meta(service, app_name)
        if validation_code:
            validation_meta = {
                'warn_code': validation_code,
                'warn_args': validation_args
            }
            brief_meta.update({'version_validation': validation_meta})
        return brief_meta

    @classmethod
    def handle_imported_package_readme(cls, app_root_dir):
        if not os.path.isfile(os.path.join(app_root_dir, AssetRepository.README_NAME)):
            _logger.warn(f'{AssetRepository.README_NAME} not found in {str(app_root_dir)}')
            asset_repository = AssetRepository()
            asset_repository.copy_readme(app_root_dir)

    @classmethod
    def get_import_package_full_path(cls, file_name):
        import_dir = common_util.make_splunk_path(
            ['etc', 'apps', ADDON_BUILDER_APP_NAME, 'local', 'import'])
        if not os.path.isdir(import_dir):
            os.makedirs(import_dir)
        return os.path.join(import_dir, file_name)


def export_ta_projects(projects, splunk_uri, session_key):
    if isinstance(projects, list):
        packages = []
        for p in projects:
            migrator = AppMigrator(p, splunk_uri, session_key)
            package = migrator.export_project()
            packages.append(package)
            return packages
    else:
        migrator = AppMigrator(projects, splunk_uri, session_key)
        return migrator.export_project()
