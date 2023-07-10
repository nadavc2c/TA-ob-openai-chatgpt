from builtins import object
import re
import json
import traceback

import splunklib.binding as binding
from aob.aob_common import logger

from aob.aob_common.metric_collector import metric_util

collection_name_replace = re.compile('[^\w\-]+')


class MetaClient(object):
    '''
    we have to put this as an wrapper for kvstore to support backward compatability
    tashare lib has some structure for the kv store.
    '''

    @metric_util.function_run_time(tags=['meta_client'])
    def __init__(self, service, collection_name):
        self.logger = logger.get_meta_manager_logger()
        self.service = service
        self.collection_name = collection_name_replace.sub('_',
                                                           collection_name)
        self.collection_data = self._get_collection_data()

    @metric_util.function_run_time(tags=['meta_client'])
    def _get_collection_data(self):
        kvstore = self.service.kvstore
        try:
            kvstore.get(name=self.collection_name)
        except binding.HTTPError as e:
            if e.status != 404:
                raise
            fields = {'value': 'string'}
            kvstore.create(self.collection_name, fields=fields)
        collections = kvstore.list(search=self.collection_name)
        for collection in collections:
            if collection.name == self.collection_name:
                return collection.data

        raise Exception('Get collection data %s failed.' %
                        self.collection_name)

    @metric_util.function_run_time(tags=['meta_client'])
    def update_state(self, key, states):
        """
        :states: Any JSON serializable
        :return: None if successful, otherwise throws exception
        """
        record = {"_key": key, "value": json.dumps(states)}
        self.collection_data.batch_save(record)

    @metric_util.function_run_time(tags=['meta_client'])
    def get_state(self, key=None):
        '''
        :key: if it is None, get all the data from collection, as a list
        '''
        if key:
            try:
                record = self.collection_data.query_by_id(key)
                return json.loads(record['value'])
            except binding.HTTPError as e:
                object_not_found = (e.status == 500 and "could not find object"
                                    in e.reason.lower()) or e.status == 404
                if not object_not_found:
                    self.logger.error('Get value from meta fails. key:%s. %s',
                                      key, traceback.format_exc())
                    raise e
                return None
        else:
            documents = self.collection_data.query()
            results = {
                doc['_key']: json.loads(doc.get('value', ''))
                for doc in documents
            }
            return results

    @metric_util.function_run_time(tags=['meta_client'])
    def delete_state(self, key=None):
        '''
        :key: if it is None, delete all the data in the collection
        '''
        try:
            if key:
                self.collection_data.delete_by_id(key)
            else:
                self.collection_data.delete()
                self.service.kvstore.delete(self.collection_name)
        except binding.HTTPError as he:
            if he.status != 404:
                self.logger.error(
                    'Fail to delete kv state. collection:%s, key:%s, error:%s',
                    self.collection_name, key, traceback.format_exc())
                raise he
            self.logger.info(
                'Get 404 error when delete kv state. The data does not exist. collection_name:%s, key:%s',
                self.collection_name, key)
