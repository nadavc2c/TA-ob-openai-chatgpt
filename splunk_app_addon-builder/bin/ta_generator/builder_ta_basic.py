from builtins import object
import os

from aob.aob_common import logger, conf_parser
from ta_generator import ta_static_asset_generator
from ta_generator import ta_basic_meta
from tabuilder_utility import common_util, builder_exception

from aob.aob_common.metric_collector import metric_util

'''
    meta object
    {
        "appname": appname,
        "friendly_name": friendly_name,
        "version": version,
        "author": author,
        "description": description,
        "visible": True/False,
        "large_icon": large-icon-uri,
        "small_icon": small-icon-uri,
        "theme": theme-color,
        "build_no": build,
        "tab_version": tab_version,
        "tab_build_no": tab_build
    }
'''

class TABasicBuilder(object):
    @metric_util.function_run_time(tags=['basic_builder'])
    def __init__(self,
                 appname,
                 uri,
                 session_key,
                 service_with_tab_context=None,
                 service_with_ta_context=None):
        self.__appname = appname
        self.__logger = logger.get_generator_logger()
        self.__parent_dir = os.path.split(os.path.realpath(__file__))[0]
        self.__resource_dir = os.path.join(self.__parent_dir, "resources")
        self.__resource_lib_dir = os.path.join(self.__parent_dir, "resources_lib")
        self.__splunk_home = os.environ['SPLUNK_HOME']
        self.__splunk_app_dir = os.path.join(self.__splunk_home, "etc", "apps")

        if service_with_tab_context:
            self.__service_with_tab_context = service_with_tab_context
        else:
            self.__service_with_tab_context = common_util.create_splunk_service(
                session_key, uri)
        if service_with_ta_context:
            self.__service_with_ta_context = service_with_ta_context
        else:
            self.__service_with_ta_context = common_util.create_splunk_service(
                session_key, uri, self.__appname)

        self.__splunk_uri = uri
        self.__session_key = session_key
        self.__current_ta_dir = os.path.join(self.__splunk_app_dir,
                                             self.__appname)
        self.__asset_generator = ta_static_asset_generator.AssetGenerator(
            self.__resource_dir, self.__current_ta_dir, self.__resource_lib_dir)

        self._basic_meta = ta_basic_meta.TABasicMeta(self.__appname, self.__service_with_tab_context)

    @property
    def asset_generator(self):
        return self.__asset_generator

    def get_meta(self):
        return self._basic_meta.meta

    def get_current_ta_dir(self):
        meta = self._basic_meta.meta
        if meta:
            app_name = meta.get('appname')
            if app_name:
                return os.path.join(self.__splunk_app_dir, app_name)
        return None

    @metric_util.function_run_time(tags=['basic_builder'])
    def _get_tab_version_and_build(self, meta):
        tab_version, tab_build = common_util.get_tab_version_and_build(
            self.__service_with_tab_context)
        meta['tab_version'] = tab_version
        meta['tab_build_no'] = tab_build
        return meta

    @metric_util.function_run_time(tags=['basic_builder'])
    def generate_add_on_builder_conf(self, is_edited=True, overwrite=False):
        if not overwrite and self.__asset_generator.is_add_on_builder_conf_exist():
            self.__logger.info('add_on_builder.conf exists. Do not generate it.')
            return
        meta = {'is_edited': "1" if is_edited else "0"}
        meta = self._get_tab_version_and_build(meta)
        self.__asset_generator.generate_addon_builder_conf(meta)

    @metric_util.function_run_time(tags=['basic_builder'])
    def generate_TA(self, meta, overwrite=False):
        self._basic_meta.validate_meta(meta)
        meta = self._get_tab_version_and_build(meta)
        appname = meta.get("appname", None)
        if 'build_no' not in meta:
            meta['build_no'] = 1
        if appname:
            if self.__appname != appname:
                self.__logger.error("App name in metadata is not consistent")
                raise builder_exception.CommonException(err_code=2023, e_message='App name in metadata is not consistent with the appname in url')
            if not overwrite:
                # can not overwrite the existing ta
                if os.path.isdir(self.__current_ta_dir):
                    raise builder_exception.CommonException(err_code=2024, e_message='App directory {} already exists.'.format(self.__appname), options={'appname': self.__appname})
                if self._basic_meta.meta:
                    raise builder_exception.CommonException(err_code=2025, e_message='App {} already exists in meta store.'.format(self.__appname), options={'appname': self.__appname})
            # when generating TA at the first time, setup is always disabled.
            self.__asset_generator.generate_TA_assets(meta, is_setup_page_enabled=False)
            self.__service_with_tab_context.confs['app'].get('_reload')
            self._basic_meta.meta = meta
        else:
            self.__logger.error("App name is missing")
            raise Exception("App name is missing")
        common_util.reload_splunk_apps(self.__service_with_tab_context)
        return meta

    @metric_util.function_run_time(tags=['basic_builder'])
    def update_TA_basic(self, meta, is_setup_page_enabled):
        self._basic_meta.validate_meta(meta)
        meta = self._get_tab_version_and_build(meta)
        appname = meta.get("appname")
        if appname:
            if self.__appname != appname:
                self.__logger.error("App name in metadata is not consistent")
                raise builder_exception.CommonException(err_code=2023, e_message='App name in metadata is not consistent with the appname in url')

            if not os.path.exists(self.__current_ta_dir):
                emsg = "Directory {} does not exist when updating TA".format(
                    self.__current_ta_dir)
                raise builder_exception.CommonException(err_code=2026, e_message=emsg, options={'dir': self.__current_ta_dir})
            old_meta = self._basic_meta.meta
            if old_meta.get('large_icon') or meta.get('large_icon'):
                meta['build_no'] = old_meta.get('build_no', 1) + 1
            self.__asset_generator.generate_content(meta, is_setup_page_enabled)
            self._basic_meta.meta = meta
            self.__service_with_tab_context.confs['app'].get('_reload')
        else:
            self.__logger.error("App name is missing")
            raise Exception("App name is missing")
        common_util.reload_splunk_apps(self.__service_with_tab_context)
        return meta

    @metric_util.function_run_time(tags=['basic_builder'])
    def regenerate_resource_files(self):
        self.__asset_generator.regenerate_resource_files()

    def cleanup_splunktalib(self):
        self.__asset_generator.cleanup_splunktalib()

    @metric_util.function_run_time(tags=['basic_builder'])
    def enable_ucc_page_in_app_conf(self):
        m = self._basic_meta.meta
        if not m:
            # for existing TA, just change the visible in app.conf
            app_conf = common_util.make_splunk_path(['etc', 'apps', self.__appname, 'local', 'app.conf'])
            if os.path.isfile(app_conf):
                parser = conf_parser.TABConfigParser()
                parser.read(app_conf)
                if not parser.has_section('ui'):
                    parser.add_section('ui')
                parser.set('ui', 'is_visible', '1')
                with open(app_conf, 'w') as fp:
                    parser.write(fp)
        else:
            self.__asset_generator.generate_app_conf(m, is_setup_page_enabled=True)
        common_util.reload_splunk_apps(self.__service_with_tab_context)

    @metric_util.function_run_time(tags=['basic_builder'])
    def disable_ucc_page_in_app_conf(self):
        m = self._basic_meta.meta
        if not m:
            # for existing TA, just change the visible in app.conf
            app_conf = common_util.make_splunk_path(['etc', 'apps', self.__appname, 'local', 'app.conf'])
            if os.path.isfile(app_conf):
                parser = conf_parser.TABConfigParser()
                parser.read(app_conf)
                try:
                    parser.remove_option('ui', 'is_visible')
                    with open(app_conf, 'w') as fp:
                        parser.write(fp)
                except:
                    pass
        else:
            self.__asset_generator.generate_app_conf(m, is_setup_page_enabled=False)
            # should regen the nav xml if the add-on is set as visible
            self.__asset_generator.generate_nav_xml(m, is_setup_page_enabled=False)
        common_util.reload_splunk_apps(self.__service_with_tab_context)

    @metric_util.function_run_time(tags=['basic_builder'])
    def upgrade_from_1_1_0_to_2_0_0(self):
        meta = self._basic_meta.meta
        if meta:
            self.__logger.info("generate the app manifest when upgrade from 1.1.0 to 2.0.0")
            self.__asset_generator.generate_app_manifest(meta)
        else:
            self.__logger.error("Basic builder meta not found when upgrade from 1.1.0 to 2.0.0")

    @metric_util.function_run_time(tags=['basic_builder'])
    def upgrade_from_2_1_2_to_2_2_0(self):
        # if the home.xml exists, means AoB has generate the default.xml and home.xml
        # and there is no global settings. So, do the upgrade
        should_upgrade = os.path.isfile(os.path.join(self.__current_ta_dir, 'local', 'ui', 'views', 'home.xml'))
        if should_upgrade:
            base_file_names = [os.path.join('data', 'ui', 'views', 'home.xml'),
                os.path.join('data', 'ui', 'nav', 'default.xml')]
            target_files = {os.path.join(self.__current_ta_dir, 'local', d): os.path.join(self.__current_ta_dir, 'default', d)
                            for d in base_file_names}
            for f in list(target_files.values()):
                if os.path.isfile(f):
                    raise builder_exception.CommonException(err_code=78,
                        e_message='File {} already exists.'.format(f),
                        options={'dir': f})
            for src, dst in list(target_files.items()):
                dst_dir = os.path.dirname(dst)
                if not os.path.isdir(dst_dir):
                    os.makedirs(dst_dir)
                os.rename(src, dst)
                self.__logger.info('rename %s to %s when upgrading TA %s', src, dst, self.__appname)
        self.__logger.info('upgrade TA %s from 2.1.2 to 2.2.0 finished.', self.__appname)
