from future import standard_library
standard_library.install_aliases()
from builtins import object
from validation_app_cert.rest_client import send_request
from tabuilder_utility import common_util
from ta_generator.builder import TABuilder
from tabuilder_utility import workspace_util
from tabuilder_utility.builder_exception import CommonException
from aob.aob_common import logger, builder_constant

import json
import time
import re
import urllib.parse
from requests.auth import HTTPBasicAuth
from tabuilder_utility.validation_utility import *
from aob.aob_common.metric_collector import metric_util
from validation_app_cert.app_cert_const import *

_LOGGER = logger.get_app_cert_validator_logger()
import logging
_LOGGER.setLevel(logging.DEBUG)



class AppCert(object):
    def __init__(self, splunk_uri, splunk_session_key, app_name):
        self.app_name = app_name
        self.conf_mgr = common_util.create_conf_mgr(splunk_session_key, splunk_uri, builder_constant.ADDON_BUILDER_APP_NAME)
        self.check_names = set()
        self.tabuilder = TABuilder(app_name, splunk_uri, splunk_session_key)
        self.headers = {}

    def get_package_path(self):
        return workspace_util.package_app(self.tabuilder)

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def run(self):
        self.app_conf = self._get_app_cert_conf()
        self.set_headers()

        start_time = time.time()
        res = self.start_validation()
        err = res.get("error")
        if err:
            return {"error": err}

        req_id = res.get("req_id")
        _LOGGER.debug("Get App cert request id: {}".format(req_id))

        success, res = self.get_status(req_id)
        interval = self.app_conf.get("interval", 10)
        timeout = self.app_conf.get("timeout", 1800)
        while not success:
            _LOGGER.debug("Waiting for App cert finished. Sleep {} seconds.".format(interval))
            time.sleep(interval)
            success, res = self.get_status(req_id)

            # check if it's already timeout
            curr_time = time.time()
            duration = curr_time - start_time
            _LOGGER.debug("Currently App cert validation takes {} seconds".format(duration))
            if duration > timeout:
                _LOGGER.warn("Stop App cert validation since it's timeout after {} seconds".format(timeout))
                return {"error": "7005"}

        if not res:
            _LOGGER.error("App cert failed for request id {}.".format(req_id))
            return {"error": "7003"}

        _LOGGER.debug("App cert finished. Get the final results.")
        data = self._get_completed_results(req_id)

        _LOGGER.debug("Get tatally {} validation results.".format(len(res)))
        return {"data": data}

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def start_validation(self):
        try:
            pkg_path = self.get_package_path()
        except:
            _LOGGER.error("Package app {} failed.".format(self.app_name))
            return {"error": "7006"}

        uri = urllib.parse.urljoin(self.app_conf.get("server"), "/v1/app/validate")
        files = {"app_package": pkg_path}
        status, content = self._send_request(uri, method="POST",
            headers=self.headers, files=files, allowed_status=(200, 404))

        if status == 404 or not content:
            _LOGGER.error("Cannot get request id of App cert validation.")
            return {"error": "7003"}

        content = json.loads(content)
        req_id = content.get("request_id")
        return {"req_id": req_id}

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def get_status(self, req_id):
        uri = urllib.parse.urljoin(self.app_conf.get("server"), "/v1/app/validate/status/{}".format(req_id))
        status, content = self._send_request(uri, method="GET", headers=self.headers)
        if status != 200:
            _LOGGER.error("Failed to get App certification results by request id: {}".format(req_id))
            return True, None

        content = json.loads(content)

        success = content.get("status") == "SUCCESS"
        return success, content

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def get_report(self, req_id):
        uri = urllib.parse.urljoin(self.app_conf.get("server"), "/v1/app/report/{}".format(req_id))
        status, content = self._send_request(uri, method="GET", headers=self.headers)
        if status != 200:
            _LOGGER.error("Cannot get the report: {}, msg: {}".format(status, content))
            return None

        content = json.loads(content)

        return content

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def get_token(self):
        uri = self.app_conf.get("auth_endpoint")
        username = self.app_conf.get("username")
        password = self.app_conf.get("password")
        status, content = self._send_request(uri, method="GET",
                                            auth=HTTPBasicAuth(username, password))

        token = None
        if content:
            content = json.loads(content)
            token = content.get("data", {}).get("token")

        if not token:
            if not status:
                _LOGGER.error("Request timeout for App Certification authentication.")
                ce = CommonException()
                ce.set_err_code(6006)
                raise ce
            elif status == 401:
                _LOGGER.error("Authentication failed for App Certification.")
                ce = CommonException()
                ce.set_err_code(6005)
                raise ce

        return token

    def set_headers(self):
        token = self.get_token()
        headers = {"authorization": "bearer {}".format(token)}
        self.headers = headers

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def get_checks(self):
        uri = self.app_conf.get("auth_endpoint")
        username = self.app_conf.get("username")
        password = self.app_conf.get("password")
        status, content = self._send_request(uri, method="GET",
                                            auth=HTTPBasicAuth(username, password))
        if status != 200:
            _LOGGER.error("Test connection failed for App Certification.")
            ce = CommonException()
            ce.set_err_code(6006)
            raise ce

        content = json.loads(content)
        return content

    @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def validate_settings(self, key_values):
        if not key_values:
            return
        ce = CommonException()

        # check the mandatory fields
        ce.set_err_code(6000)
        if not key_values.get("server"):
            ce.set_option("field", "Server")
            raise ce

        if not key_values.get("auth_endpoint"):
            ce.set_option("field", "auth_endpoint")
            raise ce

        ce.set_err_code(6008)
        if not key_values.get("username") or not key_values.get("password"):
            ce.set_option("field", "Username")
            raise ce

        # check interval
        try:
            interval = int(key_values.get("interval", 10))
            assert interval >= 1 and interval <= 300
            key_values["interval"] = interval
        except:
            ce.set_err_code(6007)
            raise ce

        # check timeout
        try:
            timeout = int(key_values.get("timeout", 1800))
            assert timeout >= 120 and timeout <= 7200
            key_values["timeout"] = timeout
        except:
            key_values["timeout"] = 1800

        # check server should start with https://
        if not re.match(r"^https://", key_values.get("server"), re.I):
            ce.set_err_code(6001)
            ce.set_option("field", "Server")
            raise ce

        proxy_enabled = common_util.is_true(key_values.get("proxy_enabled", False))
        key_values["proxy_enabled"] = proxy_enabled
        if proxy_enabled:
            # check proxy_host should NOT start with http:// or https://
            if re.match(r"https?://", key_values.get("proxy_host"), re.I):
                ce.set_err_code(6001)
                ce.set_option("field", "Proxy Host")
                raise ce

            # check proxy_host should only contain some chars
            if not re.match(r"^[\w\.\-\/]+$", key_values.get("proxy_host"), re.I):
                ce.set_err_code(6009)
                ce.set_option("field", "Proxy Host")
                raise ce

            # check proxy_port
            try:
                proxy_port = int(key_values.get("proxy_port"))
                assert proxy_port > 1 and proxy_port < 65535
            except:
                ce.set_err_code(6003)
                raise ce

            # check proxy_type
            proxy_type = key_values.get("proxy_type")
            if not proxy_type or proxy_type.lower() not in ("http", "https"):
                ce.set_err_code(6004)
                raise ce
            key_values["proxy_type"] = proxy_type.upper()

        return key_values

    # @metric_util.function_run_time(tags=APP_CERT_METRIC_TAGS)
    def test_connection(self, conf):
        app_conf = self._get_app_cert_conf(need_validation=False)
        conf["auth_endpoint"] = app_conf["auth_endpoint"]
        conf["server"] = app_conf["server"]

        self.app_conf = conf
        self.set_headers()

        self.get_checks()

    def _send_request(self,
                    uri,
                    method="GET",
                    headers=None,
                    files=None,
                    allowed_status=(200,201,202),
                    auth=None):
        proxy = self.app_conf

        return send_request(uri, method, headers=headers, auth=auth, proxy=proxy, files=files, allowed_status=allowed_status)

    def _get_app_cert_conf(self, need_validation=True):
        _LOGGER.info("Get the app_cert settings.")
        conf = self.conf_mgr.get_conf(builder_constant.GLOBAL_SETTING_CONF_NAME)
        key_values = conf.get(builder_constant.APP_CERT_STANZA)

        if need_validation:
            key_values = self.validate_settings(key_values)

        key_values["proxy_enabled"] = common_util.is_true(key_values.get("proxy_enabled", False))
        return key_values

    def _get_uncompleted_results(self, results):
        res = []
        for item in results.get("info", {}).get("checks", []):
            res.append({
                "desc": item["check"],
                "category": item["group"],
                "status": item["status"],
            })

        return res

    def _get_completed_results(self, req_id):
        results = self.get_report(req_id)
        res = []
        reports = results.get("reports")
        if not reports:
            return res

        for group in reports[0].get("groups", []):
            category = group.get("description", "")
            for check in group.get("checks", []):
                status = check["result"]

                item = {
                    "desc": self._remove_spec_chars(check["description"]),
                    "category": category,
#                     "name": check["name"],
                    "status": status,
                }

                if status in ("error", "failure") and check.get("messages"):
                    messages = check.get("messages")
                    if len(messages) > 1:
                        solution = json.dumps(messages)
                        item["has_messages"] = True
                    else:
                        solution = check["messages"][0].get("message", None)
                    if solution:
                        item["solution"] = self._remove_spec_chars(solution)
                res.append(item)

        return res

    def _remove_spec_chars(self, text):
        text = re.sub("[\r\n]+", " ", text)
        text = re.sub(r'\\"', r'"', text)
        text = re.sub('"', '\\"', text)
        return text
