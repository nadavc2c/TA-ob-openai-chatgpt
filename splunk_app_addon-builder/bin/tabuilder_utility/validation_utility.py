# encoding = utf-8

from builtins import str
import os
import random
import time
import shutil

from solnlib.conf_manager import ConfManagerException
from tabuilder_utility.temp_manager import TempManager

MI_CATEGORY = 'modular_input_validation'
BEST_PRACTICE_CATEGORY = 'best_practice_validation'
DATA_MODEL_MAPPING_CATEGORY = 'data_model_mapping_validation'
FIELD_EXTRACT_CATEGORY = 'field_extract_validation'
APP_CERT_CAGETORY = 'app_cert_validation'


ALL_TA_VALIDATORS = [
    {
        "name": BEST_PRACTICE_CATEGORY,
        "label": "Best Practice"
    }, {
        "name": DATA_MODEL_MAPPING_CATEGORY,
        "label": "Data Model Mapping"
    }, {
        "name": FIELD_EXTRACT_CATEGORY,
        "label": "Field Extraction"
    },
#     {
#         "name": "mi_validator",
#         "label": "Modular Input"
#     },
    {
        "name": APP_CERT_CAGETORY,
        "label": "App Precertification"
    }
]
VALIDATION_META_DIR = os.path.sep.join([os.environ["SPLUNK_HOME"], "var",
                                        "lib", "splunk", "modinputs",
                                        "validation_mi"])

# key constant
JOB_ID = "validation_id"
JOB_START = "start_time"
JOB_TARGET_TA = "ta_name"
ENABLE_BEST_PRACTICE = "validate_best_practice"
ENABLE_MI = "validate_mi"
ENABLE_FIELD_EXTRACT = "validate_field_extraction"
ENABLE_APP_CERT = "validate_app_cert"

JOB_PROGRESS = "progress"
JOB_STATUS_STARTED = "job_started"
JOB_STATUS_FINISHED = "job_finished"
JOB_STATUS_ERROR = "job_error"

validation_sourcetype = "splunk:tabuilder:validation"
validation_source = "tabuilder"
validation_introspect_sourcetype = "splunk:tabuilder:introspection:validation"

disabled_filename = "disabled_sourcetypes.txt"

PROPS_BACKUP_SUFFIX = "splunk_ta_builder_back"
PROPS_IN_USE_SUFFIX = "_props_in_use"

def new_validation_id():
    return "v_{}_{}".format(int(time.time()), random.randint(0, 100))

def get_app_stanzas(conf_mgr, conf_name, app_name):
    stanzas = []
    try:
        all_stanzas = conf_mgr.get_conf(conf_name).get_all()
    except ConfManagerException:
        return []

    for name, stanza in list(all_stanzas.items()):
        if stanza.get("eai:appName") == app_name:
            stanza["name"] = name
            stanzas.append(stanza)
    return stanzas


def remove_splunk_fields(stanza):
    ret = {}
    for k, v in list(stanza.items()):
        if k not in ("name", "appName", "userName", "disabled"):
            ret[k] = v
    return ret


def get_temp_csv_name(vid, sourcetype):
    special_chars = {
        ":": "_semi_",
        ",": "_comma_",
    }
    for k, v in list(special_chars.items()):
        sourcetype = sourcetype.replace(k, v)

    fname = "tmp_{}_{}.csv".format(vid, sourcetype)
    return fname

def backup_props_conf(appname):
    local_dir = os.path.join(os.environ['SPLUNK_HOME'], "etc", "apps",
                                 appname, "local")

    local_props = os.path.join(local_dir, "props.conf")
    back_props = os.path.join(local_dir, "props.conf.{}".format(PROPS_BACKUP_SUFFIX))

    local_props_exist = os.path.isfile(local_props)
    if local_props_exist:
        if os.path.isfile(back_props):
            os.remove(back_props)
        os.rename(local_props, back_props)
    else:
        remove_props_flag_path = os.path.join(local_dir, PROPS_BACKUP_SUFFIX)
        if not os.path.isdir(local_dir):
            os.mkdir(local_dir)
        with open(remove_props_flag_path, "w") as f:
            f.write(str(time.time()))
        
def restore_props_conf(appname):
    local_dir = os.path.join(os.environ['SPLUNK_HOME'], "etc", "apps",
                                 appname, "local")

    local_props = os.path.join(local_dir, "props.conf")
    back_props = os.path.join(local_dir, "props.conf.{}".format(PROPS_BACKUP_SUFFIX))
    remove_props_flag_path = os.path.join(local_dir, PROPS_BACKUP_SUFFIX)
    
    should_remove_props = os.path.isfile(remove_props_flag_path)
    local_props_exists = os.path.isfile(local_props)
    
    if local_props_exists and should_remove_props:
        os.remove(local_props)
        os.remove(remove_props_flag_path)
    
    if os.path.isfile(back_props):
        if local_props_exists:
            os.remove(local_props)
        os.rename(back_props, local_props)

def lock_props(appname):
    temp_mgr = TempManager()
    temp_mgr.create_temp_file(appname + PROPS_IN_USE_SUFFIX)
    
def unlock_props(appname):
    temp_mgr = TempManager()
    temp_mgr.delete_temp_file(appname + PROPS_IN_USE_SUFFIX)
    
def wait_for_unlock_props(appname):
    """
    check if the props.conf is in use.
    return: True if not return in 600s; False if success
    """
    temp_mgr = TempManager()
    retry = 60
    index = 0
    while temp_mgr.file_exists(appname + PROPS_IN_USE_SUFFIX):
        time.sleep(10)
        if index > retry:
            return True
        index += 1
    return False