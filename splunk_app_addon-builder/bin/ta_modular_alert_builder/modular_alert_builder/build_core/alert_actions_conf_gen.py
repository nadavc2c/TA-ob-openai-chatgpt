from builtins import object
from os import path as op
import os
import base64

from ta_modular_alert_builder.modular_alert_builder.build_core import arf_consts as ac
from ta_modular_alert_builder.modular_alert_builder.build_core import alert_actions_exceptions as aae
from shutil import copy
from os import linesep
from mako.template import Template
from munch import Munch
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_template import AlertActionsTemplateMgr
from json import loads as jloads
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_helper import write_file
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_merge import remove_alert_from_conf_file


class AlertActionsConfBase(object):
    def __init__(self, input_setting=None, package_path=None, logger=None,
                 template_dir=None, default_settings_file=None,
                 global_settings=None, **kwargs):
        self._alert_conf_name = "alert_actions.conf"
        self._alert_spec_name = "alert_actions.conf.spec"
        self._eventtypes_conf = "eventtypes.conf"
        self._tags_conf = "tags.conf"
        self._app_conf = "app.conf"
        self._all_settings = input_setting
        self._alert_settings = input_setting[ac.MODULAR_ALERTS]
        self._package_path = package_path
        self._logger = logger
        self._global_settings = global_settings

    def get_local_conf_file_path(self, conf_name=None, create_dir_path=True):
        if not self._package_path:
            return None

        if not conf_name:
            conf_name = self._alert_conf_name

        local_path = op.join(self._package_path, "local")
        if not op.exists(local_path) and create_dir_path:
            os.makedirs(local_path)

        return op.join(local_path, conf_name)

    def get_spec_file_path(self, spec_file=None, create_dir_path=True):
        if not self._package_path:
            return None

        if not spec_file:
            spec_file = self._alert_spec_name

        readme_path = op.join(self._package_path, "README")
        if not op.exists(readme_path) and create_dir_path:
            os.makedirs(readme_path)
        return op.join(readme_path, spec_file)

    def get_icon_dir(self, create_dir_path=True):
        icon_dir = op.join(self._package_path, "appserver", "static")
        if not op.exists(icon_dir) and create_dir_path:
            os.makedirs(icon_dir)
        return icon_dir

    def get_icon_name(self, alert):
        return "alert_" + alert[ac.SHORT_NAME] + ".png"

    def get_icon_path(self, alert, create_dir_path=True):
        return op.join(self.get_icon_dir(create_dir_path=create_dir_path),
                       self.get_icon_name(alert))


class AlertActionsConfCleaner(AlertActionsConfBase):

    def __init__(self, input_setting=None, package_path=None, logger=None,
                 default_settings_file=None, deleted_alerts=None, **kwargs):
        if not input_setting or not logger:
            msg = 'status="failed", required_args="input_setting, logger"'
            raise aae.AlertActionsInValidArgs(msg)

        super(AlertActionsConfCleaner, self).__init__(
            input_setting=input_setting,
            package_path=package_path, logger=logger,
            default_settings_file=default_settings_file,
            **kwargs
        )
        self._deleted_alerts = deleted_alerts
        self._current_alert = None

    def clean_alert(self):
        conf_files = [self.get_local_conf_file_path(create_dir_path=False),
                      self.get_spec_file_path(create_dir_path=False),
                      self.get_local_conf_file_path(conf_name=self._eventtypes_conf),
                      self.get_local_conf_file_path(conf_name=self._tags_conf)
                      ]
        for conf_file in conf_files:
            if not op.exists(conf_file):
                continue
            remove_alert_from_conf_file(self._current_alert,
                                        conf_file,
                                        self._logger)

        icon_file = self.get_icon_path(self._current_alert)
        if op.exists(icon_file):
            self._logger.info('event="Remove icon_file %s"', icon_file)
            os.remove(icon_file)

    def clean(self):
        if not self._deleted_alerts:
            self._logger.info('event="No deleted alerts"')
        elif isinstance(self._deleted_alerts, dict) and \
                ac.SHORT_NAME in list(self._deleted_alerts.keys()):
            # suppose it's one alert
            self._current_alert = self._deleted_alerts
            self.clean_alert()
        elif isinstance(self._deleted_alerts, list):
            for alert in self._deleted_alerts:
                self._current_alert = alert
                self.clean_alert()
        else:
            self._logger.error('event="Unsupported alert setting", ' +
                               'deleted_alert="%s"', self._deleted_alerts)


class AlertActionsConfGeneration(AlertActionsConfBase):
    DEFAULT_CONF_TEMPLATE = "alert_actions.conf.template"
    DEFAULT_SPEC_TEMPLATE = "alert_actions.conf.spec.template"
    DEFAULT_SETTINGS_FILE = "alert_actions_conf_default_settings.json"
    DEFAULT_ALERT_ICON = "alerticon.png"
    DEFAULT_EVENTTYPES_TEMPLATE = "eventtypes.conf.template"
    DEFAULT_TAGS_TEMPLATE = "tags.conf.template"
    DEFAULT_APP_TEMPLATE = "app.conf.template"

    def __init__(self, input_setting=None, package_path=None, logger=None,
                 template_dir=None, default_settings_file=None, **kwargs):
        if not input_setting or not logger:
            msg = 'status="failed", required_args="input_setting, logger"'
            raise aae.AlertActionsInValidArgs(msg)

        super(AlertActionsConfGeneration, self).__init__(
            input_setting=input_setting,
            package_path=package_path, logger=logger, template_dir=template_dir,
            default_settings_file=default_settings_file,
            **kwargs
        )

        self._html_fields = [ac.PARAMETERS, ]
        self._remove_fields = [ac.SHORT_NAME] + self._html_fields
        self._temp_obj = AlertActionsTemplateMgr(template_dir)
        self._default_settings_file = default_settings_file or \
            op.join(op.dirname(op.abspath(__file__)),
                    AlertActionsConfGeneration.DEFAULT_SETTINGS_FILE)

    def generate_conf(self):
        self._logger.info('status="starting", operation="generate", ' +
                          'object="alert_actions.conf", object_type="file"')
        template = Template(filename=op.join(
            self._temp_obj.get_template_dir(),
            AlertActionsConfGeneration.DEFAULT_CONF_TEMPLATE))
        alert_obj = Munch.fromDict(self._alert_settings)
        final_string = template.render(mod_alerts=alert_obj)
        text = linesep.join([s.strip() for s in final_string.splitlines()])
        write_file(self._alert_conf_name,
                   self.get_local_conf_file_path(),
                   text,
                   self._logger)
        self._logger.info('status="success", operation="generate", ' +
                          'object="alert_actions.conf", object_type="file"')

    def generate_eventtypes(self):
        self._logger.info('status="starting", operation="generate", ' +
                          'object="eventtypes.conf", object_type="file"')
        template = Template(filename=op.join(
            self._temp_obj.get_template_dir(),
            AlertActionsConfGeneration.DEFAULT_EVENTTYPES_TEMPLATE))
        alert_obj = Munch.fromDict(self._alert_settings)
        final_string = template.render(mod_alerts=alert_obj)
        text = linesep.join([s.strip() for s in final_string.splitlines()])
        file_path = self.get_local_conf_file_path(conf_name=self._eventtypes_conf)
        write_file(self._eventtypes_conf,
                   file_path,
                   text,
                   self._logger)

        # remove the stanza if not checked
        for alert in self._alert_settings:
            if alert.get("active_response") and alert["active_response"].get("sourcetype"):
                continue
            remove_alert_from_conf_file(alert, file_path, self._logger)
        self._logger.info('status="success", operation="generate", ' +
                          'object="eventtypes.conf", object_type="file"')


    def generate_tags(self):
        self._logger.info('status="starting", operation="generate", ' +
                          'object="tags.conf", object_type="file"')
        template = Template(filename=op.join(
            self._temp_obj.get_template_dir(),
            AlertActionsConfGeneration.DEFAULT_TAGS_TEMPLATE))
        alert_obj = Munch.fromDict(self._alert_settings)
        final_string = template.render(mod_alerts=alert_obj)
        text = linesep.join([s.strip() for s in final_string.splitlines()])
        file_path = self.get_local_conf_file_path(conf_name=self._tags_conf)
        write_file(self._tags_conf,
                   file_path,
                   text,
                   self._logger)

        # remove the stanza if not checked
        for alert in self._alert_settings:
            if alert.get("active_response") and alert["active_response"].get("sourcetype"):
                continue
            remove_alert_from_conf_file(alert, file_path, self._logger)
        self._logger.info('status="success", operation="generate", ' +
                          'object="tags.conf", object_type="file"')

    def generate_spec(self):
        self._logger.info('status="starting", operation="generate", ' +
                          'object="alert_actions.conf.spec", object_type="file"')
        template = Template(filename=op.join(
            self._temp_obj.get_template_dir(),
            AlertActionsConfGeneration.DEFAULT_SPEC_TEMPLATE))
        alert_obj = Munch.fromDict(self._alert_settings)
        final_string = template.render(mod_alerts=alert_obj)
        text = linesep.join([s.strip() for s in final_string.splitlines()])
        write_file(self._alert_spec_name,
                   self.get_spec_file_path(),
                   text,
                   self._logger)
        self._logger.info('status="success", operation="generate", ' +
                          'object="alert_actions.conf.spec", object_type="file"')

    def generate_app_conf(self):
        self._logger.info('status="starting", operation="generate", ' +
                          'object="app.conf", object_type="file"')
        template = Template(filename=op.join(
            self._temp_obj.get_template_dir(),
            AlertActionsConfGeneration.DEFAULT_APP_TEMPLATE))
        alert_obj = Munch.fromDict(self._alert_settings)
        global_settings = Munch.fromDict(self._global_settings)
        final_string = template.render(mod_alerts=alert_obj,
                                       global_settings=global_settings)
        text = linesep.join([s.strip() for s in final_string.splitlines()])
        file_path = self.get_local_conf_file_path(conf_name=self._app_conf)
        write_file(self._app_conf,
                   file_path,
                   text,
                   self._logger,
                   merge="item_overwrite")

    def handle(self):
        self.add_default_settings()
        self.handler_all_icons()
        self.generate_conf()
        self.generate_spec()
        self.generate_eventtypes()
        self.generate_tags()
        self.generate_app_conf()

    def handler_all_icons(self):
        for alert in self._alert_settings:
            self.handler_icon(alert)

    def add_default_settings(self):
        default_settings = None
        with open(self._default_settings_file, 'r') as df:
            default_settings = jloads(df.read())

        for alert in self._alert_settings:
            if ac.ALERT_PROPS not in list(alert.keys()):
                alert[ac.ALERT_PROPS] = {}
            for k, v in list(default_settings.items()):
                if k in list(alert[ac.ALERT_PROPS].keys()):
                    continue

                alert[ac.ALERT_PROPS][k] = v
                self._logger.info('status="success", operation="Add default setting", alert_name="%s", "%s"="%s"',
                                  alert[ac.SHORT_NAME], k, v)

    def handler_icon_path(self, one_alert_setting):
        self._logger.info('operation="modify", object="icon path", alert_action="%s"',
                        one_alert_setting[ac.SHORT_NAME])

        if not op.isabs(one_alert_setting[ac.ICON_PATH]):
            msg = '{}="{}", reason="{} is not an absolute path"'.format(
                ac.ICON_PATH, one_alert_setting[ac.ICON_PATH], ac.ICON_PATH)
            raise aae.AlertIconPathInvalid(msg)

        if not op.exists(one_alert_setting[ac.ICON_PATH]):
            msg = '{}="{}", reason="Iconfile doesn\'t exist."'.format(
                ac.ICON_PATH, one_alert_setting[ac.ICON_PATH])
            raise aae.AlertIconFileDoesNotExist(msg)

        icon_path = self.get_icon_path(one_alert_setting)
        if not op.exists(icon_path):
            copy(one_alert_setting[ac.ICON_PATH], icon_path)

        one_alert_setting[ac.ICON_PATH] = op.basename(icon_path)
        return one_alert_setting

    def handler_icon(self, alert_setting):
        if not self._package_path:
            self._logger.info('event="TA package path is None, do nothing", alert_action="%s"',
                              alert_setting[ac.SHORT_NAME])
            return alert_setting

        if ac.ICON_PATH in list(alert_setting.keys()):
            return self.handler_icon_path(alert_setting)
        elif ac.LARGE_ICON in list(alert_setting.keys()):
            icon_file = self.get_icon_path(alert_setting)
            with open(icon_file, 'wb+') as ficon:
                base64_str = base64.b64decode(alert_setting[ac.LARGE_ICON])
                ficon.write(base64_str)

            alert_setting[ac.ICON_PATH] = os.path.basename(icon_file)
        else:
            alert_setting[ac.ICON_PATH] = AlertActionsConfGeneration.DEFAULT_ALERT_ICON
            self._logger.info('event="Use default icon", alert_action="%s"',
                              alert_setting[ac.SHORT_NAME])
            return alert_setting


def generate_alert_actions_conf(input_setting=None, package_path=None,
                                logger=None, **kwargs):
    obj = AlertActionsConfGeneration(input_setting=input_setting,
                                     package_path=package_path,
                                     logger=logger,
                                     **kwargs)
    obj.handle()
    return None


def clean_alert_actions_conf(input_setting=None, package_path=None,
                             logger=None, **kwargs):
    obj = AlertActionsConfCleaner(input_setting=input_setting,
                                  package_path=package_path,
                                  logger=logger, **kwargs)
    obj.clean()
