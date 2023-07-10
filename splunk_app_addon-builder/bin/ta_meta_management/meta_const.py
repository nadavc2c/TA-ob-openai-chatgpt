# encoding = utf-8
from aob.aob_common import builder_constant

TA_META_COLLECTION_NAME = "ta_builder_meta_collection"
EVENT_COLLECTION_NAME = "ta_builder_event_collection"

# define the global constant for each builder.
# the meta store will use these names as namespaces
BASIC_BUILDER = 'basic_builder'
SOURCETYPE_BUILDER = 'sourcetype_builder'
DATA_INPUT_BUILDER = 'data_input_builder'
GLOBAL_SETTINGS_BUILDER = 'global_settings_builder'
FIELD_EXTRACT_BUILDER = 'field_extraction_builder'
CIM_MAPPING_BUILDER = 'cim_mapping_builder'
VALIDATION_BUILDER = 'validation_builder'
ALERT_ACTION_BUILER = 'alert_action_builder'

META_NAME_SPACES = [
    BASIC_BUILDER, SOURCETYPE_BUILDER, DATA_INPUT_BUILDER,
    GLOBAL_SETTINGS_BUILDER, FIELD_EXTRACT_BUILDER, CIM_MAPPING_BUILDER,
    VALIDATION_BUILDER, ALERT_ACTION_BUILER
]

APP_CONTEXT = 'ta_context'
TA_VALIDATION_NS = 'validation'

WIZARD_STEP = 'wizard_step'
LAST_MODIFY_TIME_KEY = "last_modify_time"
VERSION_KEY = "version"
AUTHOR_KEY = "author"
NAME_KEY = "name"
ID_KEY = "id"
BUILT_KEY = 'built_by_tabuilder'
LARGE_ICON_KEY = 'large_icon'
VISIBLE_KEY = 'visible'

# basic builder
FRIENDLY_NAME_KEY = "friendly_name"
