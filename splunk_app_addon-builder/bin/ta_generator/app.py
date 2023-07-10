# encoding = utf-8

from builtins import object
import os

from aob.aob_common import logger
from tabuilder_utility import upgrade_util
from aob.aob_common.conf_parser import TABConfigParser

class App(object):
    """
    The splunk app object
    """
    BUILDER_VERSION = 'builder_version'
    BUILDER_BUILD = 'builder_build'
    IS_EDITED = 'is_edited'

    def __init__(self, app_name, service):
        self._app_path = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps',
                                      app_name)
        if not os.path.isdir(self._app_path):
            raise Exception("App directory {} not found.".format(
                self._app_path))
        self._app = app_name
        self.logger = logger.get_app_instance_logger()
        self.tabuilder_conf = {}
        self.conf_parser = None
        self._service = service
        self.tabuilder_conf_file = os.path.join(self._app_path, 'default',
                                           'addon_builder.conf')
        self.logger.info("App instance '%s' is created.", self._app)

    def is_powered_by_tab(self):
        return os.path.isfile(self.tabuilder_conf_file)

    def _load_tabuilder_conf(self):
        if not self.conf_parser:
            self.conf_parser = TABConfigParser()
            if os.path.isfile(self.tabuilder_conf_file):
                self.conf_parser.read(self.tabuilder_conf_file)
        self.tabuilder_conf = self.conf_parser.item_dict()

    def get_tabuilder_version(self):
        """
        get the tabuilder version for this app.
        """
        self._load_tabuilder_conf()
        tab_version = '1.0.1'  # no tab_conf, it is 1.0.1
        if 'base' in self.tabuilder_conf:
            base = self.tabuilder_conf['base']
            tab_version = base.get(App.BUILDER_VERSION, '1.0.1')
        return tab_version

    def get_tabuilder_build(self):
        self._load_tabuilder_conf()
        return self.tabuilder_conf.get('base', {}).get(App.BUILDER_VERSION, None)

    def update_tabuilder_version(self, version, build=None):
        self._load_tabuilder_conf()
        if 'base' not in self.tabuilder_conf:
            self.conf_parser.add_section('base')

        self.conf_parser.set('base', App.BUILDER_VERSION, version)
        if build:
            self.conf_parser.set('base', App.BUILDER_BUILD, build)
        with open(self.tabuilder_conf_file, "w") as f:
            self.conf_parser.write(f)

    def update_is_edited_flag(self, is_edited):
        self._load_tabuilder_conf()
        if 'base' not in self.tabuilder_conf:
            self.conf_parser.add_section('base')
        flag = '1' if is_edited else '0'
        self.conf_parser.set('base', App.IS_EDITED, flag)
        with open(self.tabuilder_conf_file, 'w') as f:
            self.conf_parser.write(f)

    def upgrade(self, ta_builder=None):
        latest_tab_version, latest_tab_build = upgrade_util.get_latest_tabuilder_version(self._service)
        if not latest_tab_version:
            raise Exception("tabuilder version is unknown.")
        current_tab_version = self.get_tabuilder_version()
        if ta_builder:
            self.logger.debug(
                "Try to upgrade app %s from verison %s to version %s",
                self._app, current_tab_version, latest_tab_version)
            ta_builder.upgrade(current_tab_version, latest_tab_version)
        self.logger.debug("Upgrade app %s successfully.", self._app)
        self.update_tabuilder_version(latest_tab_version, latest_tab_build)
