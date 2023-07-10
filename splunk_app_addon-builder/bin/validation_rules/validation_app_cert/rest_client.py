from future import standard_library
standard_library.install_aliases()
from builtins import str
from builtins import range
import urllib.request, urllib.parse, urllib.error
from traceback import format_exc
import sys
import os.path as op
import mimetypes
from io import BytesIO

sys.path.insert(0, op.dirname(op.abspath(__file__)))

from aob.aob_common import logger
import logging
_LOGGER = logger.get_builder_util_logger(logging.DEBUG)

import requests

def is_true(val):
    value = str(val).strip().upper()
    if value in ("1", "TRUE", "T", "Y", "YES"):
        return True
    return False

def app_inspect_request(uri,
                    method="GET",
                    headers=None,
                    data=None,
                    config=None,
                    timeout=30,
                    retry=1,
                    files=None):
    """
    :return: httplib2.Response and content
    """

    return send_request(uri, method, headers, data, config, None, files, timeout, retry)

def code_to_msg(status, content):
    code_msg_tbl = {
        400: "Request error. reason={}".format(content),
        401: "Authentication failure, invalid access credentials.",
        402: "In-use license disables this feature.",
        403: "Insufficient permission.",
        404: "Requested endpoint does not exist.",
        409: "Invalid operation for this endpoint. reason={}".format(content),
        500: "Unspecified internal server error. reason={}".format(content),
        503: ("Feature is disabled in the configuration file. "
              "reason={}".format(content)),
    }

    return code_msg_tbl.get(status, content)

def send_request(url,
                    method="GET",
                    headers=None,
                    data=None,
                    params=None,
                    proxy=None,
                    auth=None,
                    files=None,
                    timeout=30,
                    retry=1,
                    allowed_status=(200,201,202),
                    verify=False):
    """
    :headers: dict of headers
    :data: dict of body
    :params: dict of params
    :proxy: dict like, proxy and account information are in the following
             format {
                 "proxy_enabled": True,
                 "proxy_username": admin,
                 "proxy_password": admin,
                 "proxy_host": www.proxy.com,
                 "proxy_port": 8080,
                 "proxy_type": http, https, ftp, etc.
             }
    :files: dict of { param: filepath }
    :timeout: in seconds
    :retry: retry count when request failed
    :return: response of the request
    """
    
    # read files
    if files:
        fdict = {}
        for param, fpath in list(files.items()):
            content_type = get_content_type(fpath)
            
            with open(fpath, "rb") as f:
                fcont = BytesIO(f.read())
            fdict[param] = (op.basename(fpath), fcont, content_type)
        files = fdict
        
    # setup proxy
    if proxy and proxy.get("proxy_enabled", False):
        proxy_type = proxy.get("proxy_type", "http")
        proxy_host = proxy.get("proxy_host").rstrip("/")
        
        proxy_port = proxy.get("proxy_port")
        try:
            proxy_port = int(proxy_port)
        except:
            raise ValueError("Port is not an int")
        
        proxy_url = "{}://{}:{}".format(proxy_type, proxy_host, proxy_port)
        
        if proxy.get("proxy_username"):
            password = proxy.get("proxy_password", "")
            proxy_value = "{}://{}:{}@{}:{}".format(proxy_type, proxy.get("proxy_username"),
                            password, proxy_host, proxy_port)
        else:
            proxy_value = proxy_url
            
        proxy = {"http": proxy_value, "https": proxy_value }
    else:
        proxy = None
        
    err_msg = "Failed to send rest request=%s, errcode=%s, reason=%s"
    status, content = None, None
    for _ in range(retry):
        try:
            res = requests.request(method, url, headers=headers, 
                data=data, params=params, files=files, proxies=proxy, timeout=timeout, auth=auth, verify=verify)
        except:
            _LOGGER.error(err_msg, url, "unknown", format_exc())
        else:
            status = res.status_code
            content = res.content
            if status not in allowed_status:
                _LOGGER.debug(err_msg, url, status,
                                 code_to_msg(status, content))
            return status, content
    else:
        return status, content
    
def get_content_type(filename):
    """
    Return the content type for ``filename`` in format appropriate
    for Content-Type headers, or ``None`` if the file type is unknown
    to ``mimetypes``.

    """
    mime, encoding = mimetypes.guess_type(filename, strict=False)
    if mime:
        content_type = mime
        if encoding:
            content_type = '%s; charset=%s' % (mime, encoding)
        return content_type
    return None