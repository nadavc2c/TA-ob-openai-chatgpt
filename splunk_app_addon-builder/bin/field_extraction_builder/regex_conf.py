from future import standard_library
standard_library.install_aliases()
from builtins import object
from field_extraction_builder import regex_util, regex_logger

import configparser as ConfigParser
import re
import os
import logging
_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)


class RegexConfMgr(object):
    def __init__(self, ini_dir=None):
        self.tokens = []
        self.timestamps = []
        self.fields = []
        
        if not ini_dir:
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            ini_dir = os.path.join(curr_dir, os.pardir, os.pardir, "default")
        self._read_conf(ini_dir)

    def _read_conf(self, ini_dir):
        field_path = os.path.join(ini_dir, "field_extraction_field.conf")
        token_path = os.path.join(ini_dir, "field_extraction_token.conf")

        _LOGGER.info("Get tokens from field_extraction_token.conf")
        self._read_tokens(token_path)

        _LOGGER.info("Get the fields from field_extraction_field.conf")
        self._read_fields(field_path)
        
    def _read_ini(self, ini_path):
        ret = {}
        
        cf = ConfigParser.ConfigParser()
        cf.read(ini_path)
        for section in cf.sections():
            item = {}
            for option in cf.options(section):
                item[option] = cf.get(section, option)
            ret[section] = item
        
        return ret
        
    def _read_tokens(self, token_path):
        result = self._read_ini(token_path)
        tokens = {}
        for name, token_stanza in list(result.items()):
            if name == "common":
                self.batch_size = token_stanza.get("batch_size", 10000)
                ratio = token_stanza.get("cluster_ratio", 0.8)
                disable_rate = token_stanza.get("disable_group_when_sample_rate_less_than", 0.05)
                try:
                    self.cluster_ratio = float(ratio)
                    self.disable_group_rate = float(disable_rate)
                except:
                    self.cluster_ratio = 0.8
                    self.disable_group_rate = 0.05
            else:
                token = {"name": name}
                regex = token_stanza.get("regex")
                if not regex:
                    _LOGGER.error(
                        'Stanza "%s" in field_extraction_token.conf doesn\'t have "regex" field',
                        name)
                    continue
                
                is_capture = token_stanza.get("capture")
                if not is_capture or regex_util.is_true(is_capture):
                    token['regex'] = "({})".format(regex)
                else:
                    token['regex'] = regex
                
                priority = token_stanza.get("priority")
                if not priority:
                    _LOGGER.error('Stanza "%s" in field_extraction_token.conf doesn\'t have "priority" field',
                        name)
                try:
                    priority = int(priority)
                except:
                    _LOGGER.error("Priority %s of stanza %s in field_extraction_token.conf is not an integer. Use 100000 by default",
                        priority, name)
                    priority = 100000
                
                if token_stanza.get("prefix"):
                    token["prefix"] = "({})".format(token_stanza["prefix"])
                if token_stanza.get("suffix"):
                    token["suffix"] = "({})".format(token_stanza["suffix"])
                    
                if tokens.get(priority):
                    _LOGGER.error('Stanza "%s" in field_extraction_token.conf has duplicated "priority" value %s', name, priority)
                    continue
                
                tokens[priority] = token
        
        keys = list(tokens.keys())
        for priority in sorted(keys):
            if priority > 0:
                self.tokens.append(tokens[priority])
            else:
                self.timestamps.append(tokens[priority])

    def _read_fields(self, field_path):
        result = self._read_ini(field_path)
        for name, field_stanza in list(result.items()):

            if not field_stanza.get("values"):
                _LOGGER.error(
                    'Stanza "%s" in field_extraction_token.conf doesn\'t have "values" field',
                    name)
                continue

            field = {
                "name": name,
                "case_sensitive":
                regex_util.is_true(field_stanza.get("case_sensitive", "F")),
                "values": re.split(r"\s*,\s*", field_stanza.get("values"))
            }

            min_match_count = field_stanza.get("min_match_count", 1)
            try:
                min_match_count = int(min_match_count)
            except:
                min_match_count = 1
            field["min_match_count"] = min_match_count

            if field_stanza.get("tags"):
                field['tags'] = re.split(r"\s*,\s*", field_stanza.get("tags"))

            self.fields.append(field)

    def get_all_field_names(self):
        return [item.get("name") for item in self.tokens]

    def _get_field_regex(self, name, item):
        for token in self.tokens:
            if name == token.get("name"):
                return token.get(item)
        return None

    def get_regex(self, name):
        return self._get_field_regex(name, "regex")

    def get_prefix(self, name):
        return self._get_field_regex(name, "prefix")

    def get_suffix(self, name):
        return self._get_field_regex(name, "suffix")

    def get_batch_size(self):
        return self.batch_size

    def get_cluster_ratio(self):
        return self.cluster_ratio

    def get_tokens(self):
        return self.tokens
    
    def get_timestamp_tokens(self):
        return self.timestamps

    def get_fields(self):
        return self.fields

    def get_keyword_dict(self):
        ret = {}
        for field in self.fields:
            if field.get("min_match_count") != 1:
                continue
            for value in field.get("values"):
                value = value.lower()
                if ret.get(value):
                    ret[value].append(field)
                else:
                    ret[value] = [field]
        return ret

    def _get_conf_str(self, items):
        lines = []
        for item in items:
            name = item.get("name")
            lines.append("[{}]\n".format(name))
            for k, v in list(item.items()):
                if k == "name":
                    continue
                lines.append("{} = {}\n".format(k, v))
        return "\n".join(lines)
        
