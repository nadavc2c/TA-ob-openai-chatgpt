"""
This module is used to filter and reload PATH.
"""

import os
import sys

ta_name = 'splunk_app_addon-builder'
ta_lib_name = 'splunk_app_add_on_builder'

import lxml
sys.modules['lxml'] = lxml

sys.path.insert(0, os.path.sep.join([os.path.dirname(__file__), ta_lib_name]))