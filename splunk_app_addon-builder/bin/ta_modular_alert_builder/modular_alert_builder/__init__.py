import os
import json
from os.path import dirname as dn
from ta_modular_alert_builder.modular_alert_builder import schema_generator
from ta_modular_alert_builder.modular_alert_builder import test_schema_generator
from jsonschema import validate
from ta_modular_alert_builder.modular_alert_builder.build_core import parse_envs, move_file_replace_var, tester, delete_generated_alerts
import ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_exceptions as aae
import logging
from traceback import format_exc
from shutil import rmtree
from jsonschema.exceptions import ValidationError


class LoggerAdapter(logging.LoggerAdapter):
    def __init__(self, prefix, logger):
        super(LoggerAdapter, self).__init__(logger, {})
        self.prefix = prefix

    def process(self, msg, kwargs):
        return '[%s] %s' % (self.prefix, msg), kwargs


def NotNoneArgChecks(name, value=None):
    if not value:
        raise aae.AlertActionsInValidArgs('{}="None"'.format(name))


def init_build_components(build_components):
    if not build_components:
        build_components = {}
    if not build_components.get("conf"):
        build_components["conf"] = True
    if not build_components.get("html"):
        build_components["html"] = True
    if not build_components.get("py"):
        build_components["py"] = True
    return build_components


def test(build_setting=None, test_setting=None, short_name=None, logger=None,
         version="1.0.0", template_setting=None, global_settings=None,
         resource_dir=None, resource_lib_dir=None,
         **kwargs):
    NotNoneArgChecks('build_setting', build_setting)
    NotNoneArgChecks('test_setting', test_setting)
    NotNoneArgChecks('logger', logger)
    NotNoneArgChecks('short_name', short_name)
    NotNoneArgChecks('version', version)
    NotNoneArgChecks('resource_dir', resource_dir)
    NotNoneArgChecks('resource_lib_dir', resource_lib_dir)
    NotNoneArgChecks('test_setting.name', test_setting.get("name"))

    logger = LoggerAdapter('ta="{}" version="{}" alert_name="{}"'.format(
        short_name, version, test_setting["name"]),
                           logger)

    # generate schema and validate the input file is right
    logger.info("Generating testing schema")
    test_schema = test_schema_generator.generate_alert_test_schema(
        file_path=None, version=version)

    logger.debug('test_setting="%s"', test_setting)
    logger.debug('test_setting_schema="%s"', test_schema)

    logger.info("Validating the input with schema")
    try:
        validate(test_setting, test_schema)
    except ValidationError as ve:
        logger.error('Failed to validate testing setting, reason="%s"',
                     format_exc())
        raise ve

    alert_test_dir = os.path.join(os.environ['SPLUNK_HOME'], 'var',
                                  'data', 'tabuilder', 'mac', # mac is short for modular alert container, should keep the path as short as possible, TAB-2631
                                  short_name, test_setting["name"])
    if not test_setting.get("test_container_dir"):
        test_setting["test_container_dir"] = alert_test_dir


    need_clean = False
    if not test_setting.get("ta_root_dir"):
        '''
        If the TA is not created yet, then create it under $SPLUNK_HOME/etc/apps
        directory:
        '''
        test_setting["local_ta_dir"] = os.path.join(os.environ['SPLUNK_HOME'],
                                                    'etc', 'apps', short_name)
        logger.info('ta_root_dir="None"')
        # output_dir = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps')
        if os.path.exists(alert_test_dir):
            rmtree(alert_test_dir)

        need_clean= True
        build(input_setting=build_setting,
              output_dir=alert_test_dir,
              logger=logger,
              short_name=short_name, version=version,
              global_settings=global_settings,
              resource_dir=resource_dir,
              resource_lib_dir=resource_lib_dir,
              wrap_logger=False)

        ta_root_dir = os.path.join(test_setting["test_container_dir"],
                                   short_name)
        test_setting["ta_root_dir"] = ta_root_dir
    else:
        test_setting["local_ta_dir"] = test_setting.get("ta_root_dir")

    test_envs = {
        "build_setting": build_setting,
        "test_setting": test_setting,
        "version": version,
        "short_name": short_name,
        "product_id": short_name,
        "template_setting": template_setting,
        "global_settings": global_settings,
        "resource_dir": resource_dir,
        "resource_lib_dir": resource_lib_dir
    }

    test_envs.update(kwargs)
    output = tester(test_envs, logger)
    if need_clean and os.path.exists(alert_test_dir):
        rmtree(alert_test_dir)
    return output


def build(input_setting=None, output_dir=None, template=None, logger=None,
          short_name=None, version="1.0.0", html_setting=None,
          resource_dir=None, resource_lib_dir=None,
          build_components=None, global_settings=None,
          wrap_logger=True,
          **kwargs):

    NotNoneArgChecks('input_setting', input_setting)
    NotNoneArgChecks('logger', logger)
    NotNoneArgChecks('short_name', short_name)
    NotNoneArgChecks('version', version)
    NotNoneArgChecks('resource_dir', resource_dir)
    NotNoneArgChecks('resource_lib_dir', resource_lib_dir)

    if wrap_logger:
        logger = LoggerAdapter('ta="{}" version="{}" opereation="{}"'.format(
            short_name, version, "build"),
                            logger)

    build_components = init_build_components(build_components)

    # generate schema and validate the input file is right
    logger.info("Generating app schema")
    app_schema = schema_generator.generate_app_schema(file_path=None,
                                                      version=version)
    logger.debug('input_setting="%s"', input_setting)
    logger.debug('app_setting_schema="%s"', app_schema)

    logger.info("Validating the input with schema")
    try:
        validate(input_setting, app_schema)
    except ValidationError as ve:
        logger.error('Failed to validate build setting, reason="%s"',
                     format_exc())
        raise ve

    if not template:
        current_dir = dn(os.path.abspath(__file__))
        template = os.path.join(dn(current_dir), "arf_dir_templates",
                                "modular_alert_package")

    pack_folder = template
    pack_setting_path = template + ".settings"
    if not os.path.isfile(pack_setting_path):
        msg = "package schema file {} doesn't exist.".format(pack_setting_path)
        raise aae.AlertActionsInValidArgs(msg)

    with open(pack_setting_path, 'r') as ps_handler:
        package_settings = json.loads(ps_handler.read())

    if "envs" not in package_settings or \
            "product_id" not in package_settings["envs"]:
        msg = "package setting file doesn't contain needed fields: " + \
            repr(package_settings)
        raise aae.AlertActionsInValidArgs(msg)

    envs = {"schema.content": input_setting,
            "short_name": short_name,
            "html_setting": html_setting,
            "version": version,
            "build_components": build_components,
            "global_settings": global_settings,
            "resource_dir": resource_dir,
            "resource_lib_dir": resource_lib_dir
            }
    envs.update(parse_envs(package_settings["envs"], input_setting))
    envs.update(kwargs)

    skip_list = []
    if "scan" in package_settings and "skip" in package_settings["scan"]:
        skip_list = package_settings["scan"]["skip"]

    process_list = []
    if "scan" in package_settings and "process" in package_settings["scan"]:
        process_list = package_settings["scan"]["process"]

    return move_file_replace_var(pack_folder, output_dir, logger, envs,
                                 process_list,
                                 skip_list)

def delete_alerts(build_setting=None, ta_dir=None, logger=None,
          short_name=None, version="1.0.0", deleted_alerts=None,
          global_settings=None, **kwargs):
    NotNoneArgChecks('build_setting', build_setting)
    NotNoneArgChecks('logger', logger)
    NotNoneArgChecks('short_name', short_name)
    NotNoneArgChecks('version', version)

    logger = LoggerAdapter('ta="{}" version="{}" operateion="{}"'.format(
        short_name, version, "delete alert"),
                           logger)

    if not ta_dir:
        '''
        If the TA is not created yet, then create it under $SPLUNK_HOME/etc/apps
        directory:
        '''
        logger.info('ta_dir="%s", deleted_alerts="%s", do nothing', ta_dir,
                    deleted_alerts)
        return

    delete_envs = {
        "build_setting": build_setting,
        "version": version,
        "short_name": short_name,
        "global_settings": global_settings,
        "deleted_alerts": deleted_alerts,
        "ta_dir": ta_dir,
        "product_id": short_name
    }

    delete_generated_alerts(envs=delete_envs, logger=logger, **kwargs)
