from builtins import object
import copy

from ta_meta_management import meta_manager
from ta_meta_management import meta_const
from tabuilder_utility import builder_exception
from tabuilder_utility import common_util
from aob.aob_common.metric_collector import metric_util
import solnlib.utils as libsutil


'''
    meta object
    {
        "appname": appname,
        "friendly_name": friendly_name,
        "version": version,
        "author": author,
        "description": description,
        "visible": True/False,
        "large_icon": large-icon-uri,
        "small_icon": small-icon-uri,
        "theme": theme-color,
        "build_no": build,
        "tab_version": tab_version,
        "tab_build_no": tab_build
    }
'''

class TABasicMeta(object):

    @metric_util.function_run_time(tags=['basic_builder'])
    def __init__(self, appname, service_with_tab_context):
        self._meta_mgr = meta_manager.create_meta_manager(
            service_with_tab_context.token, common_util.get_splunkd_uri(service_with_tab_context), meta_const.BASIC_BUILDER, appname)
        self._cached_meta = None

    @property
    def theme_color(self):
        return self._cached_meta.get('theme', '#65A637') if self._cached_meta else '#65A637'

    @property
    def meta(self):
        if not self._cached_meta:
            self._cached_meta = self._meta_mgr.get_app_meta_data()
        return self._cached_meta

    @meta.setter
    def meta(self, new_meta):
        self.validate_meta(new_meta)
        self._meta_mgr.set_app_meta_data(new_meta)
        self._cached_meta = copy.deepcopy(new_meta)

    def validate_meta(self, meta):
        if not meta.get('appname'):
            raise builder_exception.CommonException(err_code=2022, e_message='appname not found in basic meta')
        visible = libsutil.is_true(meta.get('visible', False))
        if (visible):
            # check the icon file
            large_uri = meta.get('large_icon', None)
            small_uri = meta.get('small_icon', None)
            if large_uri is None or small_uri is None:
                raise builder_exception.CommonException(err_code=2016, e_message='icon not found in visible app basic meta')

    def get_attribute(self, attribute_name):
        return self._cached_meta.get(attribute_name) if self._cached_meta else None

    def update_meta_attribute(self, attribute, value, persistent=True):
        cloned_meta = copy.deepcopy(self._cached_meta) if self._cached_meta else {}
        cloned_meta[attribute] = value
        self.validate_meta(cloned_meta)
        self._cached_meta = cloned_meta
        if persistent:
            self._meta_mgr.set_app_meta_data(self._cached_meta)
