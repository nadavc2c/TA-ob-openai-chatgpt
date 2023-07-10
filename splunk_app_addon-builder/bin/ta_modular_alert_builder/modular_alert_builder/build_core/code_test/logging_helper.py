from solnlib.log import Logs
import logging
import sys


def get_logger(name):
    log_obj = Logs()
    logger = log_obj.get_logger(name)
    ch = logging.StreamHandler(sys.stderr)
    ch.setLevel(logging.DEBUG)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s pid=%(process)d tid=%(threadName)s "
        "file=%(filename)s:%(funcName)s:%(lineno)d | %(message)s")
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    return logger
