import logging
import sys

_default_log_format = (
    '%(asctime)s %(levelname)s pid=%(process)d tid=%(threadName)s '
    'file=%(filename)s:%(funcName)s:%(lineno)d | %(message)s')

def stream_log_to_stderr(logger=None):
    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter(_default_log_format)
    handler.setFormatter(formatter)
    root = logging.getLogger() if logger is None else logger
    root.addHandler(handler)
    root.setLevel(logging.DEBUG)
