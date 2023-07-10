from builtins import object
import copy
import time
import traceback
import logging
import threading

from aob.aob_common import logger
from tabuilder_utility import common_util
from ta_meta_management.meta_const import *
from aob.aob_common.builder_constant import *
from tabuilder_utility.builder_exception import CommonException
import ta_meta_management.meta_client as meta_client

from aob.aob_common.metric_collector import metric_util

_logger = logger.get_meta_manager_logger()
'''
Now: The meta manager can not handle cocurrent meta update.
App meta is a collection and there is a global collection to
store all the apps info.
TODO: support cocurrent meta update
'''


class MetaManager(object):
    """
    Meta data should be pure json data. Do not put BLOB directly in the meta.
    Encode BLOB with base64 and put it into meta.
    project meta state store data structure:
    {
        "app_name": {
                namespace1: {
                    key1: value1
                },
                namespace2: {
                    key1: value1
                },
                namespace3: {
                    key1: value1
                }
            }
    }

    ta builder meta state store data structure:
    {
        "ta_builder_meta_collection": {
            "app_name1": {
            last_modify_time: last_modify_time1,
            wizard_step: step1
            },
            "app_name2": {
            last_modify_time: last_modify_time2,
            wizard_step: step2
            }
            ...
        }
    }
    """

    @metric_util.function_run_time(tags=['meta_manager'])
    def __init__(self,
                 splunk_endpoint,
                 splunk_session_key,
                 namespace,
                 app_name,
                 service=None):
        """
        :splunk_endpoint: splunk management uri
        :splunk_session_key: splunk session key
        :namespace: unique name of the builder, such as fied_extraction_builder
        :app_name: default app name. Could be reset via set_app_name()
        :service: an splunk service object.
        """

        self.namespace = namespace
        self.app_name = app_name

        if service:
            self.service = service
        else:
            self.service = common_util.create_splunk_service(
                splunk_session_key, splunk_endpoint)

        self.tabuilder_meta_state = self._get_ta_builder_meta_state_store()
        self.project_meta_state = self._get_project_meta_state_store()

    @metric_util.function_run_time(tags=['meta_manager'])
    def renew_token(self, session_key):
        self.service.token = session_key

    @metric_util.function_run_time(tags=['meta_manager'])
    def _get_ta_builder_meta_state_store(self):
        return meta_client.MetaClient(self.service, TA_META_COLLECTION_NAME)

    @metric_util.function_run_time(tags=['meta_manager'])
    def _get_project_meta_state_store(self):
        return meta_client.MetaClient(self.service, self.app_name)

    @staticmethod
    def get_current_time():
        return int(time.time())

    @metric_util.function_run_time(tags=['meta_manager'])
    def _update_last_modify_time(self):
        app_meta = self.tabuilder_meta_state.get_state(self.app_name)
        if not app_meta:
            app_meta = {}
        app_meta[LAST_MODIFY_TIME_KEY] = MetaManager.get_current_time()
        self.tabuilder_meta_state.update_state(self.app_name, app_meta)

    @staticmethod
    @metric_util.function_run_time(tags=['meta_manager'])
    def is_app_created_by_aob(service, app):
        '''
        If an TA does not exist or not created by AoB. return False
        An TA might be edited by AoB, but it is not created by Aob.
        For example, adding a modular alert to an existing TA.
        '''
        builder_meta = meta_client.MetaClient(service, TA_META_COLLECTION_NAME)
        m = builder_meta.get_state(app)
        if m:
            project_meta = meta_client.MetaClient(service, app)
            basic_meta = project_meta.get_state(BASIC_BUILDER)
            if basic_meta:
                return True
            else:
                _logger.debug("No basic meta for app:%s", app)
                return False
        else:
            _logger.debug("No builder meta for app:%s", app)
            return False

    @staticmethod
    @metric_util.function_run_time(tags=['meta_manager'])
    def rename_app(service, old_name, new_name):
        """
        Static method to rename app in all namespaces
        :service: an splunk service object
        :old_name: old app name to rename
        :new_name: new app name after rename

        :return: True - rename success.
                 False - rename failure.
        """
        builder_meta = meta_client.MetaClient(service, TA_META_COLLECTION_NAME)
        old_project_meta = meta_client.MetaClient(service, old_name)
        new_project_meta = meta_client.MetaClient(service, new_name)
        if builder_meta.get_state(new_name):
            _logger.error(
                'Can not rename to app name {0}, the target app already exists.'.
                format(new_name))
            return False

        _logger.info("begin to rename add-on from %s to %s", old_name,
                     new_name)
        old_meta = old_project_meta.get_state()
        if old_meta is None:
            _logger.error(
                "Rename add-on fails. Can not find any meta for add-on %s",
                old_name)
            return False

        try:
            for k, v in list(old_meta.items()):
                new_project_meta.update_state(k, v)
            old_project_meta.delete_state()

            old_builder_meta = builder_meta.get_state(old_name)
            builder_meta.update_state(new_name, old_builder_meta)
            builder_meta.delete_state(old_name)
            _logger.debug("update meta %s from app<%s> to app<%s>", logger.hide_sensitive_field(old_meta),
                          old_name, new_name)
        except Exception as e:
            _logger.error("fail to rename app meta. %s",
                          traceback.format_exc())
            return False

        return True

    @staticmethod
    @metric_util.function_run_time(tags=['meta_manager'])
    def delete_app(service, app_name):
        """
        Static method to delete app in all namespaces
        :service: splunk service object
        :app_name: app name to delete
        :return: True -- delete success
                 False -- delete failure
        """
        builder_meta = meta_client.MetaClient(service, TA_META_COLLECTION_NAME)
        project_meta = meta_client.MetaClient(service, app_name)
        try:
            project_meta.delete_state()
            builder_meta.delete_state(app_name)
            _logger.debug("Delete app <%s> meta.", app_name)
        except Exception as e:
            _logger.error("Fail to delete app '%s' meta. %s", app_name,
                          traceback.format_exc())
            return False
        return True

    @staticmethod
    @metric_util.function_run_time(tags=['meta_manager'])
    def get_app_all_meta(service, app):
        """
        Get the meta of app project, including all the namespaces
        :app: the app name
        :return: an dict which contains the meta for app
        {
            basic_builder: {...},
            cim_builder: {...},
        }
        """
        meta_cli = meta_client.MetaClient(service, app)
        m = meta_cli.get_state()
        if not m:
            m = None
        return m

    @staticmethod
    @metric_util.function_run_time(tags=['meta_manager'])
    def load_app_all_meta(service, app, meta, overwrite=False):
        """
        load the meta for the app. If loading fails, exception is thrown
        This method checks if the app already exists in the meta store
        """
        builder_meta = meta_client.MetaClient(service, TA_META_COLLECTION_NAME)
        project_meta = meta_client.MetaClient(service, app)
        app_meta = builder_meta.get_state(app)
        if app_meta:
            if overwrite:
                project_meta.delete_state()
                builder_meta.delete_state(app)
            else:
                raise CommonException(
                    e_message='app {} exists'.format(app),
                    err_code=36,
                    options={'app': app})
        for k, v in list(meta.items()):
            project_meta.update_state(k, v)

        app_meta = {LAST_MODIFY_TIME_KEY: MetaManager.get_current_time()}
        builder_meta.update_state(app, app_meta)

    @staticmethod
    @metric_util.function_run_time(tags=['meta_manager'])
    def get_metas(service, app_names=[], namespace_names=[]):
        """
        Get the metas for multiple app and multiple namespaces
        :app_names: a list of app names
        :namespace_names: a list of namespace names, try to find all these namespace metas in each app context
        :return: a dict, keys are app_names, values are dicts whose keys are namespaces
        {
            app1:
            {
                last_modify_time: 1234,
                wizard_step: step1,
                basic_builder: {...},
                cim_builder: {...},
            },
            app2:
            {
                last_modify_time: 1234,
                wizard_step: step2,
                basic_builder: {...},
                cim_builder: {...},
            }
         }
        """
        if not isinstance(app_names, list):
            raise ValueError("app_names is not a list.")
        if not isinstance(namespace_names, list):
            raise ValueError("namespace_names is not a list.")

        builder_meta = meta_client.MetaClient(service, TA_META_COLLECTION_NAME)
        tabuilder_all_projects = builder_meta.get_state()
        # handle the app_names is empty
        if tabuilder_all_projects and len(app_names) == 0:
            app_names = list(tabuilder_all_projects.keys())
        project_meta_map = {}
        for app in app_names:
            if builder_meta.get_state(app) is None:
                _logger.warning('App %s is not found in builder meta.', app)
                continue
            project_meta_map[app] = meta_client.MetaClient(service, app)

        _logger.info("Get multiple metas from namespace %s, apps %s",
                     namespace_names, app_names)

        return_metas = {}
        for app in list(project_meta_map.keys()):
            app_meta_collection = project_meta_map[app]
            app_meta = {}
            if len(namespace_names) == 0:
                app_meta = app_meta_collection.get_state()
            else:
                for ns in namespace_names:
                    ns_meta = app_meta_collection.get_state(ns)
                    if ns_meta is not None:
                        app_meta[ns] = ns_meta
            if len(app_meta) > 0:
                app_meta.update(tabuilder_all_projects[app])
                return_metas[app] = app_meta
        # _logger.debug('get metas:%s', return_metas)
        return return_metas

    def set_app_name(self, app_name):
        self.app_name = app_name
        self.project_meta_state = self._get_project_meta_state_store()

    def get_app_name(self):
        return self.app_name

    def _get_values_by_namespace(self):
        """
        Get app meta data from the namespace
        :return: None or a dict
        """
        app_meta = self.project_meta_state.get_state(self.namespace)
        return app_meta

    @metric_util.function_run_time(tags=['meta_manager'])
    def get_app_meta_data(self, key=None):
        """
        Get meta data from default namespace & app
        :key: Get the value of this key. Get all the values when it's None
        :return: the values dict or the value for specific key
        """
        values = self._get_values_by_namespace()
        if key and values:
            return values.get(key, None)
        return values

    @metric_util.function_run_time(tags=['meta_manager'])
    def update_app_meta_data(self, key_values, update_last_modify=True):
        """
        Update meta data based on default namespace & app
        merge the key_values into existing meta
        :key_values: a dict to set. Raise exception when it's not a dict
        :return None, or throws exception when fails.
        """
        if not isinstance(key_values, dict):
            raise ValueError("The input parameter should be a dict.")

        app_meta = self.project_meta_state.get_state(self.namespace)
        if app_meta is None:
            app_meta = key_values
        else:
            app_meta = copy.deepcopy(app_meta)
            app_meta.update(key_values)

        self.project_meta_state.update_state(self.namespace, app_meta)
        if update_last_modify:
            self._update_last_modify_time()

        _logger.debug("Update state. app:%s, key: %s, value: %s",
                      self.app_name, self.namespace, logger.hide_sensitive_field(app_meta))

    @metric_util.function_run_time(tags=['meta_manager'])
    def set_app_meta_data(self, key_values, update_last_modify=True):
        """
        Set the meta data based on default namespace & app
        replace the old meta data with the key_values
        :key_values: a dict to set. Raise Exception when it's not dict
        :return None, or throws exception when fails.
        """
        if not isinstance(key_values, dict):
            raise ValueError("The input parameter should be a dict.")
        # force reload cache
        self.project_meta_state.get_state()
        self.project_meta_state.update_state(self.namespace, key_values)
        if update_last_modify:
            self._update_last_modify_time()
        _logger.debug("Set state. app:%s, key:%s, value:%s", self.app_name,
                      self.namespace, logger.hide_sensitive_field(key_values))

    @metric_util.function_run_time(tags=['meta_manager'])
    def delete_app_meta_data(self, key=None, update_last_modify=True):
        """
        Delete values from default namespace & app
        :key: delete this key, or all the keys when it's None
        :return: None, or throws Exceptions
        """
        if key is None:
            self.project_meta_state.delete_state(self.namespace)
            _logger.debug('delete app meta data. app:%s, namespace:%s',
                          self.app_name, self.namespace)
        else:
            app_meta = self.project_meta_state.get_state(self.namespace)
            if app_meta and key in app_meta:
                app_meta = copy.deepcopy(app_meta)
                del app_meta[key]
                self.project_meta_state.update_state(self.namespace, app_meta)
                if update_last_modify:
                    self._update_last_modify_time()
                _logger.debug(
                    'Delete meta success. Key:%s, meta:%s, app:%s, namespace:%s',
                    key, logger.hide_sensitive_field(app_meta), self.app_name, self.namespace)
            else:
                _logger.error(
                    'Delete meta fails. Key %s not found in meta %s. app:%s, namespace:%s',
                    key, logger.hide_sensitive_field(app_meta), self.app_name, self.namespace)

    @staticmethod
    def delete_all_project_metas(service):
        builder_meta = meta_client.MetaClient(service, TA_META_COLLECTION_NAME)
        all_projects = builder_meta.get_state()
        for app_name in list(all_projects.keys()):
            project_meta_store = meta_client.MetaClient(service, app_name)
            project_meta_store.delete_state()
            _logger.debug('Delete the project meta. app:%s', app_name)

        builder_meta.delete_state()
        _logger.debug('Delete tabuilder meta for all project.')


@metric_util.function_run_time(tags=['meta_manager'])
def create_meta_manager(session_key,
                        uri,
                        meta_namespace,
                        appname,
                        max_pool_len=1):
    service_with_tab_context = common_util.create_splunk_service(session_key,
                                                                 uri)
    m = MetaManager(uri, session_key, meta_namespace, appname,
                    service_with_tab_context)
    return m


@metric_util.function_run_time(tags=['meta_manager'])
def create_meta_manager_with_service(service, meta_namespace, appname):
    return MetaManager(None, None, meta_namespace, appname, service)
