import tab_declare

import logging
import sys
import traceback
import json
import re

from ta_meta_management import meta_manager, meta_const
from ta_generator.builder_ta_validation import TAValidationBuilder
from aob.aob_common import logger, builder_constant
from tabuilder_utility.builder_exception import CommonException
import solnlib.log as log
from tabuilder_utility.validation_utility import *
from tabuilder_utility import common_util

_LOGGER = logger.get_validation_logger()

"""
This is the validation backend process for Splunk Add-on Builder.

"""
def update_log_level(level):
    log_level = logging.INFO
    level = level.lower()
    if level == "debug":
        log_level = logging.DEBUG
    elif level == "info":
        log_level = logging.INFO
    elif level == "error":
        log_level = logging.ERROR
    else:
        log_level = logging.INFO
    _LOGGER.info("set the loglevel to %s", level)
    log.Logs().set_level(log_level, "validation_mi")
    return log_level

def print_scheme():
    """
    Print splunk TA scheme for filed extraction modular input
    """

    print("""<scheme>
    <title>Splunk Add-on Builder validation modular input</title>
    <description>Splunk Add-on Builder validation modular input</description>
    <use_external_validation>true</use_external_validation>
    <streaming_mode>xml</streaming_mode>
    <use_single_instance>False</use_single_instance>
    <endpoint>
      <args>
        <arg name="name">
        </arg>
        <arg name="loglevel">
           <required_on_create>0</required_on_create>
           <required_on_edit>0</required_on_edit>
        </arg>
        <arg name="validation_id">
           <required_on_create>1</required_on_create>
           <required_on_edit>1</required_on_edit>
        </arg>
        <arg name="validators">
           <required_on_create>1</required_on_create>
           <required_on_edit>1</required_on_edit>
        </arg>

      </args>
    </endpoint>
    </scheme>
    """)

def validate():
    """
    Validate the parameters for validation modular input
    """
    modinputs = sys.stdin.read()
    if not modinputs:
        return 0

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
    for tag in config.keys():
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
    Start validation in backend
    """
    modinputs = sys.stdin.read()

    input_conf = parse_modinput_configs(modinputs)
    _LOGGER.setLevel(input_conf.get("loglevel", logging.INFO))

    mi = ValidationMI(input_conf)
    mi.run()

class ValidationMI(object):
    def __init__(self, conf):
        self.conf = conf
        self.checkpoint_dir = conf.get("checkpoint_dir")
        self.app_name = conf.get("name").replace("validation_mi://", "").strip()

        self.checkpoint_file = os.path.join(self.checkpoint_dir, self.app_name)
        self.splunk_endpoint = conf.get("server_uri")
        self.splunk_session_key = conf.get("session_key")
        self.validators = re.split(r"\s*,\s*", conf.get("validators", ""))
        self.vid = conf.get("validation_id")

        self.validation_builder = TAValidationBuilder(self.splunk_endpoint,
            self.splunk_session_key, self.app_name)
        self.meta_mgr = meta_manager.create_meta_manager(conf.get("session_key"),
            conf.get("server_uri"), meta_const.VALIDATION_BUILDER, self.app_name)

    def check_if_start(self):
        """
        If the input is the monitor process, remove all the other inputs and quit;
        Else if the input has been started, do nothing but waiting for removing;
        Else start the validation.
        """
        _LOGGER.info("Start to check if need to run the validation.")
        if self.app_name == builder_constant.VALIDATION_MONITOR_MI:
            _LOGGER.info("Remove all the previous validations.")
            input_type = builder_constant.VALIDATION_MI
            data_inputs = self.validation_builder.tab_conf_mgr.get_data_input(input_type)

            for data_input in data_inputs:
                name = data_input.get("name")
                if name == builder_constant.VALIDATION_MONITOR_MI:
                    continue
                vb = TAValidationBuilder(self.splunk_endpoint, self.splunk_session_key, name)
                vb.remove_validation_status()
                vb.cancel_validation_job()

            _LOGGER.info("Remove all the checkpoints.")
            for f in os.listdir(self.checkpoint_dir):
                os.remove(os.path.join(self.checkpoint_dir, f))
            return False
        else:
            _LOGGER.info("Check if the validation has been started before...")
            if os.path.isfile(self.checkpoint_file):
                _LOGGER.info("It's been started. Just skip it.")
                return False
            _LOGGER.info("It's a new validation. Start running...")
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

    def run(self):
        if not self.check_if_start():
            return

        self.create_checkpoint()

        _LOGGER.info("Start validation...")
        self.validation_builder.update_validation_status(JOB_STATUS_STARTED, progress=0.0)
        try:
            progress = 0.0
            job = self.validation_builder.get_validation_job(self.validators, self.vid)
            while progress != 1.0:
                self.validation_builder.update_validation_status(JOB_STATUS_STARTED, progress=progress)
                progress = self.validation_builder.get_job_progress(job)

                events = self.validation_builder.get_validation_results(job)
                _LOGGER.debug("Get {} results.".format(len(events)))

                self.index_events(events)
                sys.stdout.flush()
                time.sleep(5)
        except CommonException as e:
            error = {
                "err_code": e.get_err_code(),
                "err_args": e.get_options()
            }
            self.validation_builder.update_validation_status(JOB_STATUS_ERROR, error=error)
        except Exception as e:
            tb = traceback.format_exc()
            error = {
                "message": str(e),
                "traceback": traceback.format_exc(),
            }

            _LOGGER.error("Validation failed. Traceback: {}".format(tb))
            self.validation_builder.update_validation_status(JOB_STATUS_ERROR, error=error)

        _LOGGER.info("Update status.")
        self.validation_builder.update_validation_status(JOB_STATUS_FINISHED, progress=1.0)

        self.remove_checkpoint()

    def index_events(self, events):
        if not events:
            return

        fmt = ("<event><time>{0}</time><source>{1}</source>"
                   "<sourcetype>{2}</sourcetype><host>{3}</host>"
                   "<index>{4}</index><data><![CDATA[ {5} ]]></data></event>")
        print("<stream>")
        for event in events:
            output =  fmt.format(time.time(), validation_source,
                validation_sourcetype, self.conf.get("host"), self.conf.get("index"), json.dumps(event))
            print(output)
        print("</stream>")

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
        common_util.initialize_apm()
        run()
        _LOGGER.info("End validation")
    sys.exit(0)
