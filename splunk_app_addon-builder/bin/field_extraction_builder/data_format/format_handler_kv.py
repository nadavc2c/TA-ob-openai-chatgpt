from future import standard_library
standard_library.install_aliases()
from builtins import range
import logging
import re
import configparser as ConfigParser
import os


from field_extraction_builder.data_format.format_handler_base import DataFormatHandler
import field_extraction_builder.regex_util as ru
import tabuilder_utility.common_util as cu
from field_extraction_builder import regex_logger
from field_extraction_builder.regex_exception import InvalidRegex, CaptureGroupCountError
_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)


class KVHandler(DataFormatHandler):

    def __init__(self, events, delim_pair=None, delim_kv=None, regex=None):
        super(KVHandler, self).__init__(events)
        self.event_count = len(events)

        self.delim_pair_raw = delim_pair
        delim_pair = ru.escape_str(delim_pair)
        self.delim_pair = ru.escape_regex_terms(delim_pair, in_square_brackets=True)

        self.delim_kv_raw = delim_kv
        delim_kv = ru.escape_str(delim_kv)
        self.delim_kv = ru.escape_regex_terms(delim_kv, in_square_brackets=True)

        self.regex = regex
        self.is_auto_mode = False
        self.is_kv_delims_same = False
        
        if delim_kv == delim_pair:
            self.is_kv_delims_same = True
            

        if regex:
            self.validate_kv_regex(regex)
        elif delim_pair and delim_kv:
            self.validate_kv_regex(self.delim_kv, is_delim=True)
            self.validate_kv_regex(self.delim_pair, is_delim=True)
        else:
            # KV_MODE = auto
            self.is_auto_mode = True

    def get_kv_results(self):
        res = self._get_default_results()
        match_count = 0
        unmatch_count = 0

        for event in self.events:
            if self.is_auto_mode:
                status = self.get_auto_kv_results(event)
            elif self.regex:
                # the field name should be unique
                # will ignore field names when it already exists.
                fields = []
                status = ru.get_match_status(event, self.regex)

                for match in status.get("matches", []):

                    field_name = match[0]["text"]
                    rename_field = cu.rename_search_time_field(field_name)
                    if rename_field in fields:
                        match[0]["is_duplicated"] = True
                    else:
                        fields.append(rename_field)
                    match[0]["rename_field"] = rename_field

                    match["value"] = match[1]
                    match["key"] = match[0]
                    del match[0]
                    del match[1]
            else:
                status = self.get_delim_match_status(event)

            ratio = status.get("ratio")

            if ratio == 0.0:
                unmatch_count += 1
            elif ratio == 1.0:
                match_count += 1

            status["event"] = event

            res["events"].append(status)

        return res

    def get_delim_match_status(self, event):
        status = {
            "matches": [],
            "ratio": 0,
        }
        delim_pair = "[{}]+".format(self.delim_pair)
        delim_kv = "[{}]+".format(self.delim_kv)
        start = 0
        end = 0
        matched_len = 0
        fields = []

        quoted_indexes = self.get_quoted_indexes(event)
        
        index = 0
        for item in re.finditer(delim_pair, event + self.delim_pair):
            if self._is_delim_in_quotes(item.start(), quoted_indexes):
                continue

            index += 1
            if self.is_kv_delims_same and index % 2 != 0:
                continue
                
            len_pair = len(item.group())
            delim_start, delim_end = item.span()
            end = delim_end
            # event starts/ends with the delim_pair
            if start == delim_start:
                start = delim_end
                continue

            text = event[start:delim_start]
            
            # validate if the pair value contains delim_kv
            if not re.findall(delim_kv, text):
                start = delim_end
                continue

            # validate if the pair value has only 2 capture groups
            kv_items = []
            kv_start = 0
            for kv in re.finditer(delim_kv, text + delim_kv):
                if self._is_delim_in_quotes(start + kv.start(), quoted_indexes):
                    continue
                kv_item = text[kv_start:kv.start()]
                if not kv_item:
                    continue
                kv_start = kv.end()
                kv_items.append(kv_item)
            
            if len(kv_items) != 2:
                start = delim_end
                continue

            matched_len += delim_start - start + len_pair
            k, v = kv_items

            rename_k = cu.rename_search_time_field(k)
            
            warn_dict = None
            is_dup = False
            if not rename_k:
                # rename_k is none
                warn_dict = {
                    'err_code': 4202,
                    'err_args': {
                        "field_name": k,
                    }
                }
            elif rename_k in fields:
                is_dup = True
                # duplicated field name
                warn_dict = {
                    'err_code': 4201,
                    'err_args': {
                        "field_name": k,
                    }
                }
            else:
                fields.append(rename_k)
                if rename_k != k:
                    warn_dict = {
                        'err_code': 4200,
                        'err_args': {
                            "field_name": k,
                            "rename_field": rename_k,
                        }
                    }

            if v in ("''", '""'):
                v = ""

            match = {
                "pair": {
                    # "text": event[start:delim_start],
                    "pos": [start, delim_start]
                },
                "key": {
                    "text": k,
                    "pos": [start, start + len(k)],
                    "field": rename_k,
                    "is_duplicated": is_dup,
                },
                "value": {
                    "text": v,
                    "pos": [end - len(v) - len_pair, end - len_pair]
                },
            }

            if warn_dict:
                match['warning'] = warn_dict
            status["matches"].append(match)
            start = delim_end

        matched_len = matched_len - len_pair if matched_len > 0 else 0
        status["ratio"] = 1.0 * matched_len / len(event)

        return status

    def get_auto_kv_results(self, event):
        fields = []

        delim_index_in_quoted_text = []
        quoted_indexes = self.get_quoted_indexes(event)
        for index in quoted_indexes:
            quoted_text = event[index[0]:index[1]]
            for find in re.finditer(r"[>, ;|&]", quoted_text):
                delim_index = index[0] + find.start()
                delim_index_in_quoted_text.append(delim_index)

        event_chars = list(event)
        quoted_delim_dict = {}
        for i in delim_index_in_quoted_text:
            quoted_delim_dict[i] = event_chars[i]
            event_chars[i] = "_"

        event_without_quoted_delim = "".join(event_chars)

        # Note:
        # If need to update this regex,
        # make sure all the UT have been passed!!!
        regex = r"([\w\.]+)[^\w=]*= *\"?([^=>, ;|&][^\">, ;|&]*)\"?"
        status = ru.get_match_status(event_without_quoted_delim, regex)
        res = {"ratio": status.get("ratio", 0), "matches": []}
        for match in status.get("matches", []):

            field_name = match[0]["text"]

            rename_field = cu.rename_search_time_field(field_name)
            rename_field = rename_field.strip("_")

            warn_dict = None
            match[0]["field"] = rename_field

            if rename_field in fields:
                match[0]["is_duplicated"] = True
                # duplicated field name
                warn_dict = {
                    'err_code': 4201,
                    'err_args': {
                        "field_name": field_name,

                    }
                }
            else:
                fields.append(rename_field)
                if rename_field != field_name:
                    warn_dict = {
                        'err_code': 4200,
                        'err_args': {
                            "field_name": field_name,
                            "rename_field": rename_field,
                        }
                    }
            if warn_dict:
                match["warning"] = warn_dict

            # restore the quoted delims
            value = match[1].get("text")
            pos = match[1].get("pos")
            value_list = list(value)
            for i in range(pos[0], pos[1]):
                if i in delim_index_in_quoted_text:
                    value_list[i - pos[0]] = quoted_delim_dict[i]
            value = "".join(value_list)
            
            # check if the value only contains quotes
            if not value.strip('"'):
                quote_len = len(value)
                value = ""
                value_pos_start = pos[0]
                value_pos_end = pos[1] - quote_len
                value_pos_end = value_pos_start if value_pos_end < value_pos_start else value_pos_end
                pos = (value_pos_start, value_pos_end)
            match["value"] = {'pos': pos, 'text': value}

            match["key"] = match[0]
            del match[0]
            del match[1]
            if 'pair' in match and 'text' in match['pair']:
                del match['pair']['text']
            res["matches"].append(match)
        return res

    def _get_default_results(self):
        return {
            "events": [],
            "matched_count": 0,
            "unmatched_count": 0,
            "delim_pair": self.delim_pair_raw,
            "delim_kv": self.delim_kv_raw,
            "regex": self.regex,
        }

    def validate_kv_regex(self, regex, is_delim=False):
        try:
            regex_obj = re.compile(regex)
        except:
            raise InvalidRegex(regex)

        if not is_delim:
            group_count = regex_obj.groups
            if group_count != 2:
                raise CaptureGroupCountError(regex, 2)

    def get_quoted_indexes(self, event):
        indexes = []
        for q in ("'", '"'):
            for find in re.finditer(r'{0}[^{0}]*{0}'.format(q), event):
                indexes.append(find.span())
        return indexes
    
    def _is_delim_in_quotes(self, index, quoted_indexes):
        for quoted_index in quoted_indexes:
            if index in range(quoted_index[0], quoted_index[1]):
                return True
        return False

    @staticmethod
    def get_kv_templates(filepath=None):
        templates = []
        if not filepath:
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            filepath = os.path.join(curr_dir, os.pardir, os.pardir, os.pardir,
                                    "default", "field_extraction_kv_templates.conf")

        cf = ConfigParser.ConfigParser()
        cf.read(filepath)
        for section in cf.sections():
            item = {}
            for option in cf.options(section):
                item[option] = cf.get(section, option)
            templates.append(item)

        return templates