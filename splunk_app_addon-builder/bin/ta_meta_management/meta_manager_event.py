from __future__ import division
from builtins import str
from builtins import range
from builtins import object
from past.utils import old_div
import sys

from tabuilder_utility import common_util
from ta_meta_management import meta_client, meta_const

EVENT_COUNT_PER_OBJECT = 1000

class EventMetaManager(object):
    """
    This collection is only for events during unstructured data parsing.
    {
        ta_builder_event_collection: {
            sourcetype:group_id:index: [events],
            ...
        }
    }
    """
    KEY_SEP = ':'

    def __init__(self, splunk_endpoint, splunk_session_key, service=None):
        self.splunk_uri = splunk_endpoint
        self.session_key = splunk_session_key

        if service:
            self.service = service
        else:
            self.service = common_util.create_splunk_service(splunk_session_key, splunk_endpoint)

        self.mgr = meta_client.MetaClient(self.service, meta_const.EVENT_COLLECTION_NAME)

    def load_all_values(self):
        self.all_values = self.mgr.get_state()

    def get_values(self, key=None):
        if not hasattr(self, "all_values"):
            self.load_all_values()
        if key:
            return self.all_values.get(key)
        return self.all_values

    def save_events(self, sourcetype, group_id, events):
        event_count = len(events)
        for item in self.get_key_names(sourcetype, group_id, event_count):
            name = item.get("name")
            start, end = item.get("range")
            self.update_meta_data(name, events[start:end])

    def get_events(self, sourcetype, group_id, start=0, end=0):
        events = []
        for key in self.get_values():
            if self._is_key_in_range(sourcetype, key, group_id, start, end):
                curr_events = self.get_values(key)
                events += curr_events

        return events

    def get_events_with_sourcetypes(self, sourcetypes):
        if not isinstance(sourcetypes, list):
            raise RuntimeError()
        events_dict = {}
        for key, events in list(self.get_values().items()):
            for sourcetype in sourcetypes:
                if self._is_key_in_sourcetype(key, sourcetype):
                    events_dict[key] = events
                    break # break the sourcetype loop
        return events_dict


    def remove_events(self, sourcetype, group_id=None):
        """
        Remove the events in meta.
        When the group_id is None, remove all the sourcetype events;
        otherwise just remove the events within this group
        """
        if group_id:
            prefix = self._get_key_prefix(sourcetype, group_id)
        else:
            prefix = sourcetype

        for key in self.get_values():
            if key.startswith(prefix+self.KEY_SEP):
                self.mgr.delete_state(key)

    def get_key_names(self, sourcetype, group_id, event_count):
        """
        return: the list of sourcetype:group_id:index
        """
        prefix = self._get_key_prefix(sourcetype, group_id)
        res = []
        for i in range(int(old_div(event_count,EVENT_COUNT_PER_OBJECT)) + 1):
            start = i * EVENT_COUNT_PER_OBJECT
            end = (i + 1) * EVENT_COUNT_PER_OBJECT
            item = {
                "name": self.KEY_SEP.join((prefix, str(i))),
                "range": (start, end),
            }
            res.append(item)

            if end >= event_count:
                break
        return res

    def _is_key_in_sourcetype(self, key, sourcetype):
        '''
        the sourcetype may contains colons. We need to find the sourcetype from the tail
        key format is like sourcetype:groupd_id:index. Refer to get_key_names
        '''
        elements = key.rsplit(self.KEY_SEP, 2)
        return elements[0] == sourcetype

    def _get_key_prefix(self, sourcetype, group_id):
        '''
        should make sure there is no colon in the group_id
        '''
        return self.KEY_SEP.join((sourcetype, group_id))

    def _is_key_in_range(self, sourcetype, key, group_id, start=0, end=0):
        prefix = self._get_key_prefix(sourcetype, group_id)
        if not key.startswith(prefix+self.KEY_SEP):
            return False

        event_index = int(key.replace(prefix+self.KEY_SEP, ""))
        if end == 0:
            end = sys.maxsize

        if event_index > old_div(start,EVENT_COUNT_PER_OBJECT) or event_index < old_div(end,EVENT_COUNT_PER_OBJECT):
            return True

        return False

    def update_meta_data(self, key, values):
        self.mgr.update_state(key, values)
        return
