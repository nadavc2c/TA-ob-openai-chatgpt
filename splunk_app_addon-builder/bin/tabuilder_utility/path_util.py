import os
from aob.aob_common import builder_constant
from tabuilder_utility import common_util

def get_tabuilder_app_root():
    return get_app_root(builder_constant.ADDON_BUILDER_APP_NAME)

def get_app_root(appname):
    return common_util.make_splunk_path(('etc', 'apps', appname))

# the dir which contains all the uploaded icon files
def get_icon_upload_dir():
    return os.path.join(get_tabuilder_app_root(), 'local', 'ta_icon_upload')

def get_icon_final_dir():
    return os.path.join(get_tabuilder_app_root(), 'local', 'ta_icon_final')

def get_splunk_csv_output_path():
    run_path = common_util.make_splunk_path(("var", "run", "splunk"))

    # for Splunk 6.4.0 or higher version, one folder "csv" is added
    fpath = os.path.join(run_path, "csv")
    if os.path.isdir(fpath):
        return fpath

    # for Splunk 6.3.*, there is no "csv" folder
    return run_path

def get_resources_lib_dir():
    return os.path.join(get_tabuilder_app_root(), "bin", "ta_generator", "resources_lib")
