from builtins import object
import jsl
import json


class ParameterHelpLink(jsl.Document):
    link_text = jsl.StringField(required=True, default="Learn More")
    link_url_type = jsl.StringField(enum=["internal", "external"],
                                    required=True, default="external")
    link_url = jsl.OneOfField([jsl.UriField(required=True)], required=True)
    link_tip = jsl.StringField(required=False)


class ParameterBase(jsl.Document):
    class Options(object):
        additional_properties = True
    name = jsl.StringField(pattern='[^\s=]+', required=True)
    label = jsl.StringField(required=True)
    required = jsl.BooleanField(required=True)
    default_value = jsl.StringField(required=False)
    help_string = jsl.StringField(required=False)
    possible_values = jsl.DictField(required=False, min_properties=1)
    ctrl_props = jsl.DictField(required=False, min_properties=1)
    help_link = jsl.DocumentField(ParameterHelpLink, as_ref=True,
                                  required=False)


class TextParameter(ParameterBase):
    format_type = jsl.StringField(required=True, enum=["text"])


class DropdownlistParameter(ParameterBase):
    format_type = jsl.StringField(required=True, enum=["dropdownlist"])
    possible_values = jsl.DictField(required=True, min_properties=1)


class PasswordParameter(ParameterBase):
    format_type = jsl.StringField(required=True, enum=["password"])


class SplunksearchdropdownParameter(ParameterBase):
    format_type = jsl.StringField(required=True,
                                  enum=["dropdownlist_splunk_search"])
    ctrl_props = jsl.DictField(required=True,
                               min_properties=3,
                               properties={
                                   "search": jsl.StringField(required=True),
                                   "value_field": jsl.StringField(required=True),
                                   "label_field": jsl.StringField(required=True),
                                   "app": jsl.StringField(required=False),
                                   "earlist": jsl.StringField(required=False),
                                   "latest": jsl.StringField(required=False),
                                   "allow_custom_value": jsl.StringField(required=False),
                                   "max_results": jsl.StringField(required=False),
                               })


class RadioParameter(ParameterBase):
    format_type = jsl.StringField(required=True, enum=["radio"])
    possible_values = jsl.DictField(required=True, min_properties=1)


class TextareaParameter(ParameterBase):
    format_type = jsl.StringField(required=True, enum=["textarea"])


class CheckboxParameter(ParameterBase):
    format_type = jsl.StringField(required=True, enum=["checkbox"])
    value = jsl.NumberField(required=False)
    default_value = jsl.NumberField(required=False)

class Technology(jsl.Document):
    vendor = jsl.StringField(required=True)
    product = jsl.StringField(required=True)
    version = jsl.ArrayField(jsl.StringField(pattern='[\d\.]+'), required=False,
                             min_items=1)


class ModularAlertProps(jsl.Document):
    is_custom = jsl.NumberField(required=False, minimum=0, maximum=1)
    max_results = jsl.NumberField(required=False)
    ttl = jsl.NumberField(required=False)
    payload_format = jsl.StringField(required=False, enum=["xml", "json"])
    track_alert = jsl.NumberField(required=False, minimum=0, maximum=1)


class ModularAlert(jsl.Document):
    short_name = jsl.StringField(required=True)
    label = jsl.StringField(required=True)
    description = jsl.StringField(required=False)
    icon_path = jsl.StringField(required=False)
    largeIcon = jsl.StringField(required=False)
    smallIcon = jsl.StringField(required=False)
    code = jsl.StringField(required=False)
    uuid = jsl.StringField(required=False)
    active_response = jsl.DictField(
        required=False,
        additional_properties=True,
        properties={
            "supports_adhoc": jsl.BooleanField(required=False),
            "drilldown_uri": jsl.StringField(required=False),
            "group": jsl.ArrayField(jsl.StringField(),
                                    required=False, min_items=1),
            "category": jsl.ArrayField(jsl.StringField(),
                                       required=False, min_items=1),
            "task": jsl.ArrayField(jsl.StringField(),
                                   required=True, min_items=1),
            "subject": jsl.ArrayField(jsl.StringField(),
                                      required=True, min_items=1),
            "index": jsl.StringField(required=False,
                                     pattern=r"^[\w\-:]{0,50}$"),
            "sourcetype": jsl.StringField(required=False,
                                          pattern=r"^[\w\-:]{0,50}$"),
            "technology": jsl.ArrayField(
                jsl.DocumentField(Technology, as_ref=True),
                required=True, min_items=1)
        })
    parameters = jsl.ArrayField(
        jsl.OneOfField([jsl.DocumentField(CheckboxParameter, as_ref=True),
                        jsl.DocumentField(DropdownlistParameter, as_ref=True),
                        jsl.DocumentField(RadioParameter, as_ref=True),
                        jsl.DocumentField(PasswordParameter, as_ref=True),
                        jsl.DocumentField(TextareaParameter, as_ref=True),
                        jsl.DocumentField(TextParameter, as_ref=True),
                        jsl.DocumentField(SplunksearchdropdownParameter,
                                          as_ref=True)
                        ]), required=False)
    alert_props = jsl.DocumentField(ModularAlertProps, as_ref=True,
                                    required=False)


class AppInfo(jsl.Document):
    class Options(object):
        additional_properties = True
    product_id = jsl.StringField(required=True)
    short_name = jsl.StringField(pattern='[\S]+', required=True)
    description = jsl.StringField(required=False)
    icon_path = jsl.StringField(required=False)
    version = jsl.StringField(required=False)
    modular_alerts = jsl.ArrayField(jsl.DocumentField(ModularAlert,
                                                      as_ref=True),
                                    required=True)


def generate_app_schema(file_path=None, version=None):
    formated = json.dumps(AppInfo.get_schema(ordered=False), indent=4)
    formated = formated.replace("__main__.", "")

    if file_path:
        with open(file_path, 'w+') as schema_handler:
            schema_handler.write(formated)
    # print json.loads(formated)
    return json.loads(formated)

if __name__ == "__main__":
    generate_app_schema(file_path="./schema.json")
