# encoding = utf-8
import logging

import solnlib.log as logs

LOGGER_NAME = "validation_engine"

global_loglevel = logging.INFO
global_logger = None


def set_log_level(loglevel):
    if loglevel:
        global global_loglevel
        global_loglevel = loglevel
        if global_logger:
            logs.Logs().set_level(global_loglevel, LOGGER_NAME)


def get_logger(loglevel=None):
    if loglevel:
        set_log_level(loglevel)
    global global_logger
    if global_logger is None:
        global_logger = logs.Logs().get_logger(LOGGER_NAME)
        global_logger.setLevel(global_loglevel)
    return global_logger

def set_logger(logger):
    global global_logger
    global_logger = logger
