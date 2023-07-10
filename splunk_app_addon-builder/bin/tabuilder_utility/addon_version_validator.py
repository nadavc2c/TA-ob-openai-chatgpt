import configparser
import json
import os
from jsoncomment import JsonComment

from aob.aob_common import logger, package_util
from tabuilder_utility.ucc_dir_utils import UccDirUtils
from tabuilder_utility.ucc_global_config_loader import GlobalConfigLoader


class AddonVersionValidator(object):

    def __init__(self, addon_name, addon_dir):
        self.addon_name = addon_name
        self.addon_dir = addon_dir
        self.version_getters = [self.get_aob_meta_version, self.get_app_manifest_version, self.get_app_conf_version,
                                self.get_global_conf_version]
        self.logger = logger.get_builder_util_logger()
        self.jsonReader = JsonComment()

    def validate_addon(self):
        results = []
        addon_version = None
        versions_match = True
        for version_getter in self.version_getters:
            name, version = version_getter()
            if version:
                if not addon_version:
                    addon_version = version
                else:
                    versions_match = versions_match and addon_version == version
            else:
                version = 'not found'
            results.append((name, version))
        if not versions_match:
            return 81, {'addon_name': self.addon_name,
                        'versions': ', '.join(': '.join(name_version) for name_version in results)}
        return None, None

    def get_version_from_json_file(self, filename, path, version_finder):
        conf_path = os.path.join(path, filename)
        version = None
        if os.path.isfile(conf_path):
            with open(conf_path, 'r') as conf:
                try:
                    version = version_finder(self.jsonReader.loads(conf.read()))
                except Exception as exception:
                    self.logger.error(f'Unable to read addon version from {filename}: {str(exception)}')
        else:
            self.logger.warn(f'{str(path)} does not exist')
        return filename, version

    def get_aob_meta_version(self):
        filename = package_util.get_aob_meta_file_name(self.addon_name)
        return self.get_version_from_json_file(filename, self.addon_dir, lambda file: file['basic_builder']['version'])

    def get_app_manifest_version(self):
        return self.get_version_from_json_file('app.manifest', self.addon_dir,
                                               lambda file: file['info']['id']['version'])

    def get_global_conf_version(self):
        filename = GlobalConfigLoader.GLOBAL_CONFIG
        path = UccDirUtils.default_global_config_dir(self.addon_dir)
        return self.get_version_from_json_file(filename, path, lambda file: file['meta']['version'])

    def get_app_conf_version(self):
        filename = 'app.conf'
        default_path = os.path.join(self.addon_dir, 'default', filename)
        version = None
        if os.path.isfile(default_path):
            version = self.get_app_conf_version_internal(default_path)
        else:
            local_path = os.path.join(self.addon_dir, 'local', filename)
            if os.path.isfile(local_path):
                version = self.get_app_conf_version_internal(local_path)
            else:
                self.logger.warn(f'Neither {str(default_path)} nor {str(local_path)} exist')
        return filename, version

    def get_app_conf_version_internal(self, path):
        config = configparser.ConfigParser()
        config.read(path)
        try:
            return config['launcher']['version']
        except Exception as exception:
            self.logger.error(f'Unable to read addon version from app.conf: {str(exception)}')
        return None
