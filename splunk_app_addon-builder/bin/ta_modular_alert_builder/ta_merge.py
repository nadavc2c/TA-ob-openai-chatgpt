import os
import os.path as op
from os.path import dirname as dn
from os.path import basename as bn
from shutil import copy

from aob.aob_common.conf_parser import TABConfigParser
from ta_modular_alert_builder.modular_alert_builder.build_core import alert_actions_merge


def merge(src, dst):
    alert_actions_merge.merge(src, dst)
