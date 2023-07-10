import json
import os

from aob.aob_common import logger
from tabuilder_utility.app_util import multi_key_lookup
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.ucc_api_version import APIVersion

logger = logger.get_builder_util_logger()


class GlobalConfigLoader:
    GLOBAL_CONFIG = "globalConfig.json"
    MINIMUM_REQUIRED_VERSION_WITH_UCC_SUPPORT = 4
    UNSUPPORTED_HOOKS = ["onChange", "onRender", "onSave", "onSaveSuccess"]

    def __init__(self, ta_root):
        self.global_config, self.global_config_path = GlobalConfigLoader.load_global_config(ta_root)

    @staticmethod
    def locate_global_config(ta_root):
        return [
            os.path.join(ta_root, GlobalConfigLoader.GLOBAL_CONFIG),
            os.path.join(ta_root, "appserver", "static", "js", "build", GlobalConfigLoader.GLOBAL_CONFIG, ),
        ]

    # Based on the examples we analyzed so far, the offending code is usually plced under
    # for elem in $(pages::configuration::tabs)
    #   elem::options::(onChange or onRender or onSave or onSaveSuccess)
    @staticmethod
    def remove_unsupported_hooks(current_global_config_path, global_config_as_dict):
        all_tabs = multi_key_lookup(
            global_config_as_dict, ("pages", "configuration", "tabs")
        )
        anything_was_removed = False
        if all_tabs:
            for tab in all_tabs:
                for hook in GlobalConfigLoader.UNSUPPORTED_HOOKS:
                    if multi_key_lookup(tab, ("options", hook)):
                        del tab["options"][hook]
                        anything_was_removed = True
        if anything_was_removed:
            with open(current_global_config_path, "w") as f:
                json.dump(global_config_as_dict, f, sort_keys=True, indent=4)
        return global_config_as_dict, current_global_config_path

    @staticmethod
    def load_global_config(ta_root):
        for current in GlobalConfigLoader.locate_global_config(ta_root):
            logger.info(f"Checking {current}")
            if os.path.exists(current):
                with open(current) as current_config:
                    try:
                        return GlobalConfigLoader.remove_unsupported_hooks(current, json.loads(current_config.read()))
                    except Exception as e:
                        raise CommonException(e_message=str(e), err_code=76)
        logger.warn(f'No globalConfig found for TA {ta_root}')
        return None, None

    def extract_api_version(self):
        if self.global_config:
            try:
                return APIVersion(self.global_config["meta"]["apiVersion"])
            except KeyError:
                pass
        return None

    def requires_upgrade(self):
        api_version = self.extract_api_version()
        if api_version:
            current_api_version = api_version.major()
            if current_api_version:
                try:
                    api_version_as_integer = int(current_api_version)
                    return api_version_as_integer < GlobalConfigLoader.MINIMUM_REQUIRED_VERSION_WITH_UCC_SUPPORT
                except ValueError:
                    pass
        return False
