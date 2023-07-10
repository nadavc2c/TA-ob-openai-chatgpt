from __future__ import print_function
from builtins import str
from builtins import object
import tab_declare

import logging
import sys
import os
import traceback
import time
import re

from ta_meta_management import meta_manager, meta_const
from field_extraction_builder.regex_loader import RegexLoader
from ta_generator.builder_ta_extraction import TAExtractionBuilder
from tabuilder_utility import common_util, temp_manager
from tabuilder_utility.builder_exception import CommonException
from aob.aob_common import logger, builder_constant

_LOGGER = logger.get_field_extraction_builder_logger()

"""
This is the field extraction backend process for Splunk Add-on Builder.
Note that it does NOT output any events but write KVStore with following format:

{
    sourcetype: {
        "regex_results_temp": {
            "last_indextime": 1461062518,
            "status": {
                "finished": True,
                "progress": 0.9,
            }
            "error": {
                "err_code": 3000,
                "err_args": {},
            },
            "groups": [
                {
                    "group_id": sourcetype_1,
                    "regex": { # class Regex
                        "regex": "(.*?) to other (.*?) host",
                        "token": "$$ipv4$$ to host: bytes $$number$$",
                        "fields" : ["field_name1", "field_name2"],
                        "capture_group_count": 0,
                        "enabled": True,
                        "regex_with_possible_values": "(.*?) to other (test1|test2) host",
                        "possible_values": [None, set(["test1", "test2"])],
                        "customized": False, # if the regex is customized by users
                    },
                    "seed": { # class SeedEvent
                        "token": "$$ipv4$$/$$port$$ to dest",
                        "words": ["word1", " ", "#", ":", "word2", "$$number$$", "/"],
                        "count": 0,
                        "shared_str_indexes" : [[1,2,3,4], [8,9,10,11,12,13]],
                        "insert_str_points" : { 5 : "insert1", 10 : "insert2"},
                    },
                    "events": [...], # raw events within this group
                }
            ]
        }
    }
}
"""


def print_scheme():
    """
    Print splunk TA scheme for filed extraction modular input
    """

    print("""<scheme>
    <title>Splunk Add-on Builder field extraction modular input</title>
    <description>Splunk Add-on Builder field extraction modular input</description>
    <use_external_validation>true</use_external_validation>
    <streaming_mode>xml</streaming_mode>
    <use_single_instance>False</use_single_instance>
    <endpoint>
      <args>
        <arg name="name">
        </arg>
        <arg name="app_name">
           <required_on_create>1</required_on_create>
           <required_on_edit>1</required_on_edit>
        </arg>
        <arg name="batch_size">
           <required_on_create>0</required_on_create>
           <required_on_edit>0</required_on_edit>
        </arg>
        <arg name="incremental_merge">
           <required_on_create>0</required_on_create>
           <required_on_edit>0</required_on_edit>
        </arg>
      </args>
    </endpoint>
    </scheme>
    """)


def validate():
    """
    Validate the parameters for field extraction modular input
    """
    modinputs = sys.stdin.read()
    if not modinputs:
        return 0

    input_config = parse_modinput_configs(modinputs)
    try:
        int(input_config.get("batch_size"))
    except:
        raise ValueError("The batch_size must be an integer.")


def parse_modinput_configs(config_str):
    """
    @config_str: modinput XML configuration feed by splunkd
    """

    import defusedxml.minidom as xdm

    config = {
        "server_host": None,
        "server_uri": None,
        "session_key": None,
        "checkpoint_dir": None,
    }
    root = xdm.parseString(config_str).documentElement
    for tag in list(config.keys()):
        nodes = root.getElementsByTagName(tag)
        if not nodes:
            _LOGGER.error("Invalid config, missing %s section", tag)
            raise Exception("Invalid config, missing %s section", tag)

        if (nodes[0].firstChild and
                nodes[0].firstChild.nodeType == nodes[0].TEXT_NODE):
            config[tag] = nodes[0].firstChild.data
        else:
            _LOGGER.error("Invalid config, expect text ndoe")
            raise Exception("Invalid config, expect text ndoe")

    confs = root.getElementsByTagName("configuration")

    if confs:
        stanzas = confs[0].getElementsByTagName("stanza")
        stanza = stanzas[0]
    else:
        items = root.getElementsByTagName("item")
        stanza = items[0]

    if not stanza:
        _LOGGER.error("Invalid config, missing <item> or <stanza> section")
        raise Exception("Invalid config, missing <item> or <stanza> section")

    stanza_name = stanza.getAttribute("name")
    if not stanza_name:
        _LOGGER.error("Invalid config, missing name")
        raise Exception("Invalid config, missing name")

    config["name"] = stanza_name
    params = stanza.getElementsByTagName("param")
    for param in params:
        name = param.getAttribute("name")
        if (name and param.firstChild and
                param.firstChild.nodeType == param.firstChild.TEXT_NODE):
            config[name] = param.firstChild.data
    return config


def usage():
    """
    Print usage of this binary
    """

    hlp = "%s --scheme|--validate-arguments|-h"
    print(hlp % sys.argv[0], file=sys.stderr)
    sys.exit(1)


def run():
    """
    Start field extraction in backend
    """
    # TODO: remove test code
    modinputs = sys.stdin.read()

    #     with open("/Users/cheney/Documents/Git/TA/app-addon-builder/package/bin/input.xml", "r") as f:
    #         modinputs = f.read()
    input_conf = parse_modinput_configs(modinputs)
    #     input_conf['session_key'] = session_key
    input_conf["batch_size"] = int(input_conf.get("batch_size"))
    mi = FieldExtractionMI(input_conf)
    mi.run(False)


class FieldExtractionMI(object):
    def __init__(self, conf):
        self.conf = conf
        self.app_name = conf.get("app_name")
        self.checkpoint_dir = conf.get("checkpoint_dir")
        self.sourcetype = conf.get("name").replace("field_extraction_mi://", "").strip()
        self.checkpoint_file = self._get_checkpoint_file()
        self.tmp_mgr = temp_manager.TempManager()
        self.loader = RegexLoader()
        self.splunk_endpoint = conf.get("server_uri")
        self.splunk_session_key = conf.get("session_key")
        self.extraction_builder = TAExtractionBuilder(self.splunk_endpoint,
                                                      self.splunk_session_key, self.app_name)

        self.batch_size = conf.get("batch_size")
        if self.batch_size > 10000:
            _LOGGER.warn("The event batch size is {} > 10000, use 10000".format(self.batch_size))
            self.batch_size = 10000

        self.meta_mgr = meta_manager.create_meta_manager(conf.get("session_key"),
                                                         conf.get("server_uri"), meta_const.FIELD_EXTRACT_BUILDER,
                                                         self.app_name)

    def _get_checkpoint_file(self):
        sourcetype = re.sub(r"[^\w]", "__splunk_tab_special_char__", self.sourcetype)
        return os.path.join(self.checkpoint_dir, sourcetype)

    def save_status(self, progress):
        metadata = {
            "status": {
                "progress": progress,
                "finished": False,
            },
        }
        self._merge_meta_results(metadata)

    def check_if_start(self):
        """
        If the input is the monitor process, remove all the other inputs and quit;
        Else if the input has been started, do nothing but waiting for removing;
        Else start the parsing.
        """
        _LOGGER.info("Start to check if need to run the extraction for unstructured data.")
        if self.sourcetype == builder_constant.FIELD_EXTRACTION_MONITOR_MI:
            _LOGGER.info("Remove all the previous unstructured data extractions.")
            self.extraction_builder.remove_all_unstructured_data_inputs()

            _LOGGER.info("Remove all the checkpoints.")
            for f in os.listdir(self.checkpoint_dir):
                os.remove(os.path.join(self.checkpoint_dir, f))
            return False
        else:
            _LOGGER.info("Check if the extraction has been started before...")
            if os.path.isfile(self.checkpoint_file):
                _LOGGER.info("It's been started. Just skip it.")
                return False
            _LOGGER.info("It's a new extraction. Start running...")
            return True

    def create_checkpoint(self):
        # create checkpoint file
        _LOGGER.debug("Create check point file: {}".format(self.checkpoint_file))
        if not os.path.isdir(self.checkpoint_dir):
            os.makedirs(self.conf.get("checkpoint_dir"))
        with open(self.checkpoint_file, "w") as f:
            f.write(str(time.time()))

    def remove_checkpoint(self):
        os.remove(self.checkpoint_file)

    def run(self, incremental_merge):
        if not self.check_if_start():
            return

        self.create_checkpoint()

        _LOGGER.info("Start parsing...")
        self.start_parsing()
        try:
            if incremental_merge:
                last_indextime = self.get_last_indextime()
                events, indextime = self.extraction_builder.get_events(self.sourcetype, self.batch_size, last_indextime)
                self.set_last_indextime(indextime)

                groups = self.meta_mgr.get_app_meta_data("groups")
                new_groups = self.loader.merge_events(events, groups, self.save_status)
                self.meta_mgr.update_app_meta_data({"groups": groups + new_groups})
            else:
                _LOGGER.info("Parse new events.")
                self.extraction_builder.run(self.sourcetype, self.save_status)
        except CommonException as e:
            self.write_error(e.get_err_code(), e.get_options())
        except Exception as e:
            _LOGGER.error("Field extraction failed for sourcetype {}.".format(self.sourcetype))
            _LOGGER.error("Traceback: {}".format(traceback.format_exc()))
            self.write_error()

        _LOGGER.info("End parsing.")
        self.end_parsing()

        self.remove_checkpoint()

    def write_error(self, err_code=None, args=None):
        if not err_code:
            err_code = 4016

        err_dict = {"err_code": err_code}

        if args:
            err_dict['err_args'] = args

        self._merge_meta_results({"error": err_dict})

    def set_last_indextime(self, indextime):
        self._merge_meta_results({"last_indextime": indextime})

    def get_last_indextime(self):
        meta = self._get_meta_results()
        indextime = meta.get("last_indextime", 0)
        _LOGGER.info("Get last indextime {} as the checkpoint.".format(indextime))
        return indextime

    def start_parsing(self):
        status = {
            "finished": False,
            "progress": 0.0,
        }
        self._merge_meta_results({"status": status})

    def end_parsing(self):
        status = {
            "finished": True,
            "progress": 1.0,
        }
        self._merge_meta_results({"status": status})

    def _get_meta_results(self):
        meta = self.meta_mgr.get_app_meta_data(self.sourcetype) or {}
        return meta.get("regex_results_temp", {})

    def _set_meta_results(self, key_values):
        meta = self.meta_mgr.get_app_meta_data(self.sourcetype) or {}
        meta.update({"regex_results_temp": key_values})
        self.meta_mgr.update_app_meta_data({self.sourcetype: meta})

    def _merge_meta_results(self, key_values):
        meta = self._get_meta_results()
        meta.update(key_values)
        self._set_meta_results(meta)


if __name__ == "__main__":
    args = sys.argv
    if len(args) > 1:
        if args[1] == "--scheme":
            print_scheme()
        elif args[1] == "--validate-arguments":
            sys.exit(validate())
        elif args[1] in ("-h", "--h", "--help"):
            usage()
        else:
            usage()
    else:
        run()
        _LOGGER.info("End field extraction")
    sys.exit(0)
