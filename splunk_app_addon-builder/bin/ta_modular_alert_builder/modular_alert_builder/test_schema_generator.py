from builtins import object
import jsl
import json


class ModularAlertConfiguration(jsl.Document):
    class Options(object):
        additional_properties = True


class ModularAlertMetaFields(jsl.Document):
    class Options(object):
        additional_properties = True
    session_key = jsl.StringField(required=True)
    server_uri = jsl.StringField(required=True)
    server_host = jsl.StringField(required=True)
    server_port = jsl.NumberField(required=True)


class ModularAlertResult(jsl.Document):
    class Options(object):
        additional_properties = True


class ModularAlertStdin(jsl.Document):
    alert_mode = jsl.StringField(required=False)
    events_number = jsl.NumberField(required=False, minimum=1)
    search = jsl.StringField(required=False)
    stdin_fields = jsl.DocumentField(ModularAlertMetaFields, as_ref=True,
                                     required=True)
    configuration = jsl.DocumentField(ModularAlertConfiguration, as_ref=True,
                                      required=False)
    results = jsl.ArrayField(jsl.DocumentField(ModularAlertResult,
                                               as_ref=True),
                             required=False)


class ModularAlertTestSetting(jsl.Document):
    class Options(object):
        additional_properties = True

    name = jsl.StringField(required=True)
    ta_root_dir = jsl.StringField(required=False)
    code_file = jsl.StringField(required=False)
    code = jsl.StringField(required=False)
    stdout_file = jsl.StringField(required=False)
    stderr_file = jsl.StringField(required=False)
    code_test_dir = jsl.StringField(required=False)
    input_setting = jsl.DocumentField(ModularAlertStdin, as_ref=True,
                                      required=False)


def generate_alert_test_schema(file_path=None, version=None):
    formated = json.dumps(ModularAlertTestSetting.get_schema(ordered=False),
                          indent=4)
    formated = formated.replace("__main__.", "")

    if file_path:
        with open(file_path, 'w+') as schema_handler:
            schema_handler.write(formated)
    # print json.loads(formated)
    return json.loads(formated)

if __name__ == "__main__":
    generate_alert_test_schema(file_path="./test_schema.json")
