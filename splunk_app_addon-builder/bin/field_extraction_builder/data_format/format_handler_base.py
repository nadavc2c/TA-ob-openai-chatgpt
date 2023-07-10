from future import standard_library
standard_library.install_aliases()
from builtins import object
import logging
import re
import json
import os

from field_extraction_builder.regex_tokenizer import Tokenizer
from field_extraction_builder.regex_conf import RegexConfMgr
from field_extraction_builder.data_format.data_format import DataFormat
from field_extraction_builder import regex_logger
from field_extraction_builder import regex_util
from field_extraction_builder.regex_cluster import RegexCluster
_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG) 


class DataFormatHandler(object):
    def __init__(self, events):
        self.events = [e.get("_raw") for e in events]
        
        # init tokenizer
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        ini_dir = os.path.join(curr_dir, os.pardir, os.pardir, os.pardir, "default")
        self.conf = RegexConfMgr(ini_dir)
        self.tokenizer = Tokenizer(self.conf)
        self.cluster = RegexCluster(self.conf)
    
    def get_format(self):
        if not self.events:
            _LOGGER.error("Cannot get any events.")
            return None
        
        top_events = self.events[:50]
        if self._is_kv(top_events):
            return {"data_format": DataFormat.KV}
        
        if self._is_xml(top_events):
            return {"data_format": DataFormat.XML}
        
        if self._is_json(top_events):
            return {"data_format": DataFormat.JSON}
        
        table_delim = self._is_tabular(top_events)
        if table_delim:
            return {
                "data_format": DataFormat.TABLE,
                "table_delim": table_delim,
            }
        
        return {"data_format": DataFormat.UNSTRUCTURE}
        
    def _is_tabular(self, events):

        delims = (",", "\t", "|", " ")
        delim_count = {d:[] for d in delims}

        for event in events:
            raw = event
            if raw.startswith("#"):
                continue
            # replace contents in ""
            raw = raw.replace('""', "QUOTE")
            raw = re.sub(r'"[^"]*"', "QUOTE", raw)
            raw = re.sub(r"'[^']*'", "QUOTE", raw)
            
            for delim in list(delim_count.keys()):
                count = len(re.split(regex_util.escape_regex_terms(delim), raw))
                if count < 5:
                    continue
                delim_count[delim].append(count)

        for delim in delims:
            counts = delim_count.get(delim)
            event_count = len(counts)
            count_dict = {}
            for c in counts:
                count = count_dict.get(c)
                if count:
                    count_dict[c] = count + 1
                else:
                    count_dict[c] = 1
                    
            if not count_dict:
                continue
            
            max_count = max(count_dict.values())
            ratio = 1.0 * max_count / event_count
            if event_count > 20 and ratio > 0.8:
                if delim == "\t":
                    return "\\t"
                return delim
            
        return False
    
    def _is_json(self, events):
        try:
            for event in events:
                jsn = json.loads(event)
                if not isinstance(jsn, dict):
                    return False
            return True
        except:
            return False
    
    def _is_xml(self, events):
        import defusedxml.ElementTree as xee
        try:
            from io import StringIO
        except ImportError:
            from io import StringIO
        try:
            for event in events:
                strf = StringIO()
                strf.write(event.strip())
                strf.seek(0)
                xee.parse(strf)
            return True
        except:
            return False
    
    def _is_kv(self, events):
        for event in events:
            raw = event.strip()
            raw = raw.replace('""', "QUOTE")
            raw = re.sub(r'"[^"]*"', "QUOTE", raw)
            raw = re.sub(r"'[^']*'", "QUOTE", raw)
            if not re.match(r"(\s*\S+\s*=\s*\S+\s*,?)+", raw):  # nosemgrep
                return False
        return True
    
    def rename_fields(self, fields):
        reserved_fields = ("source", "sourcetype", "host", "index", "linecount", "timestamp")
        new_fields = []
        for field in fields:
            field = re.sub(r"[^\w]+", "_", field)
            field = field.strip("_")
            if field in reserved_fields:
                field = "extracted_{}".format(field)
            new_fields.append(field)
            
        return new_fields
