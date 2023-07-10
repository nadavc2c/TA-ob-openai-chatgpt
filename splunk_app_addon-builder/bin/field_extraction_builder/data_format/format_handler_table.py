from __future__ import division
from builtins import range
from past.utils import old_div
import logging
import re

from field_extraction_builder.data_format.format_handler_base import DataFormatHandler
from field_extraction_builder.regex_exception import InvalidRegex
import field_extraction_builder.regex_util as ru
from tabuilder_utility import common_util
from field_extraction_builder import regex_logger
_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)

class TableHandler(DataFormatHandler):
    def __init__(self, events, delim, header=None):
        super(TableHandler, self).__init__(events)
        self.comment_prefix = "#"
        
        self.header = header
        self.delim_raw = delim
        delim = ru.escape_str(delim)
        self.delim = "[{}]".format(ru.escape_regex_terms(delim, in_square_brackets=True))
        
        self.validate_delim(self.delim)
        self.max_field_count = 0
        self.header_prefix_regex = r"#\s*(?:fields|header)\S*\s+"
        
    def get_table_results(self):
        maybe_headers = []
        
        max_field_count = 0
        table_events = []
        
        for event in self.events:
            # remove the quotes
            event = event.strip()
            if not self.header and event.startswith(self.comment_prefix):
                # check if the header is in comments
                if re.match(self.header_prefix_regex, event, re.IGNORECASE):
                    header = re.sub(self.header_prefix_regex, "", event, 1, re.IGNORECASE)
                    maybe_headers.append(header)
                continue

            quotes_res = common_util.replace_quotes(event)
            event = quotes_res.get("data")

            # restore the quotes
            items = re.split(self.delim, event)
            item_len = len(items)
            if max_field_count < item_len:
                max_field_count = item_len
                
            new_items = []
            for item in items:
                item = common_util.restore_data(item.strip(), quotes_res.get("tokens", {}), quotes_res.get("prefix", ""))
                new_items.append(item)
            table_events.append(new_items)
        
        if not self.header:
            table_headers = self._detect_headers(maybe_headers, max_field_count)
            
            # no headers
            if not table_headers:
                for i in range(max_field_count):
                    table_headers.append("field_{}".format(i))
            self.header = table_headers
        
        res = {
            "header": self.header,
            "events": table_events,
            "delim": self.delim_raw,
        }   
        return res
        
    def validate_delim(self, delim):
        try:
            re.compile(delim)
        except:
            raise InvalidRegex(delim)
        
    def get_similarity(self, event1, event2):
        from difflib import SequenceMatcher
        matcher = SequenceMatcher(None, event1, event2)
        ratio = matcher.ratio()
        return ratio
    
    def _is_header_similar_to_event(self, header, events, max_ratio=0.5):
        if self.tokenizer:
            header = self.tokenizer.replace_text_with_tokens(header)
            
        for event in events:
            event = common_util.replace_quotes(event)
            ratio = self.get_similarity(header, event.get("data"))
            if ratio >= max_ratio:
                return True
        return False
    
    def _detect_headers(self, maybe_headers, max_field_count):
        # decide headers
        tok_events = self._get_tokenized_events(self.events)

        # the header should have larger field count
        for mheader in maybe_headers:
            quotes_mheader = common_util.replace_quotes(mheader)
            mheader = quotes_mheader.get("data")
            headers = re.split(self.delim, mheader)
            if self._is_header_field_count_valid(headers, max_field_count) \
                and not self._is_header_similar_to_event(mheader, tok_events):
                res = []
                for h in headers:
                    h = common_util.restore_data(h, quotes_mheader.get("tokens"),
                                                 quotes_mheader.get("prefix"))
                    h = common_util.rename_search_time_field(h)
                    res.append(h)

                return self._fill_empty_headers(res)
            
        # if failed, cluster all the event
        items = []
        for event in tok_events:
            quotes_event = common_util.replace_quotes(event)
            event = quotes_event.get("data")
            item = {
                "raw_events": [],
                "raw": event,
                "words": re.split(self.delim, event),
                "quotes_res": quotes_event,
            }
            items.append(item)

        cluster_results = self.cluster.run(items)
        mheaders = [group.get("events")[0] for group in cluster_results.get("groups", []) if len(group.get("events")) == 1]
        mheader = self._get_candidate_headers(mheaders, max_field_count)
        if not mheader:
            return []

        res = []
        quotes_res = mheader.get("quotes_res")
        for h in mheader.get("words"):
            h = h.strip("$")
            if quotes_res:
                h = common_util.restore_data(h,
                                             quotes_res.get("tokens"),
                                             quotes_res.get("prefix"))
            h = common_util.rename_search_time_field(h)
            res.append(h)

        return self._fill_empty_headers(res)

    def _get_candidate_headers(self, headers, max_field_count):
        if not headers:
            return None

        if len(headers) == 1:
            return headers[0]

        candidate_header = None
        for header in headers:
            words = header.get("words")
            if not self._is_header_field_count_valid(words, max_field_count) or \
                    words[0].startswith(self.comment_prefix):
                continue

            if candidate_header is None:
                candidate_header = header
                continue

            # check if the headers are all words
            # headers should NOT include special characters
            is_all_word = True
            for w in words:
                if not re.match(r"^[\w \-]+$", w):
                    is_all_word = False
                    break
            if is_all_word:
                candidate_header = header
        return candidate_header

    def _fill_empty_headers(self, headers):
        res = []
        index = 0
        for header in headers:
            if not header:
                new_header = "field_{}".format(index)
                while new_header in res:
                    index += 1
                    new_header = "field_{}".format(index)
                res.append(new_header)
            elif header in res:
                new_header = header
                while new_header in res:
                    m = re.match(r"(\w+)_(\d+)$", new_header)
                    if m:
                        header_prefix, header_index = m.group(1), m.group(2)
                        new_index = int(header_index) + 1
                        new_header = "{}_{}".format(header_prefix, new_index)
                    else:
                        new_header = "{}_0".format(new_header)
                
                res.append(new_header)
                
            else:
                res.append(header)
        return res
    
    def _get_tokenized_events(self, events):
        res = []
        delim = self.delim_raw
        if delim == "\\t":
            delim = "\t"
        for event in events:
            event = event.strip()
            if event.startswith(self.comment_prefix):
                continue
            if self.tokenizer:
                words = re.split(self.delim, event)
                new_words = []
                for w in words:
                    nw = self.tokenizer.replace_text_with_tokens(w, table_delim=self.delim)
                    new_words.append(nw)
                event = delim.join(new_words)
            res.append(event)
            
        return res
    
    def _is_header_field_count_valid(self, headers, max_field_count):
        
        count = len(headers)
        value = count - max_field_count
        if value >=0 and value < old_div(max_field_count,5):
            return True
        return False
    
    def _get_max_field_count(self, events):
        max_count = 0
        for line in events:
            if line.startswith(self.comment_prefix):
                continue
            line = line.strip()
            line = common_util.replace_quotes(line).get("data")
            field_count = len(re.split(self.delim, line))
            if max_count < field_count:
                max_count = field_count
        return max_count  
