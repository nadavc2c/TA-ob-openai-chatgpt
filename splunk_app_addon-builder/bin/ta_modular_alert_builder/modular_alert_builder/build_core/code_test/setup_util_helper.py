from importlib import import_module
from json import loads
import os.path as op
import traceback
from pkgutil import find_loader
import re


# not used anymore, should be deleted in future
def get_setup_util(ta_name, splunk_uri, session_key, logger):
    lib_dir = re.sub("[^\w]+", "_", ta_name.lower())
    loader = find_loader(lib_dir + "_setup_util")
    if not loader:
        logger.debug('module="%s" doesn\'t exists, no global setting available',
                     lib_dir + "_setup_util")
        return None

    try:
        setup_util_module = import_module(lib_dir + "_setup_util")
    except ImportError:
        logger.error('Failed to import module: "%s", reason="%s"',
                     lib_dir + "_setup_util", traceback.format_exc())
        return None

    class Mocked_Setup_Util(setup_util_module.Setup_Util):
        def __init__(self, uri, session_key, logger):
            super(Mocked_Setup_Util, self).__init__(uri, session_key, logger)

        def _parse_conf(self):
            all_settings = {}
            global_settings_file = op.join(op.dirname(op.abspath(__file__)),
                                           "global_settings.json")
            if not op.exists(global_settings_file):
                return all_settings

            try:
                with open(global_settings_file, 'r') as handler:
                    all_settings = loads(handler.read())
            except Exception as e:
                logger.error('Failed to read the global settings, reason="%s"',
                             traceback.format_exc())
                raise e
            logger.debug('global_settings="%s"', all_settings)
            return all_settings

    return Mocked_Setup_Util(splunk_uri, session_key,
                             logger)
