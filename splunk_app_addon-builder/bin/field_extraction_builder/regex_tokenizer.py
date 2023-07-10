from builtins import object
import re
import logging
from field_extraction_builder import regex_util, regex_logger, regex_serialize
from field_extraction_builder.regex_serialize import RegexResult

_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)

class Tokenizer(object):
    
    def __init__(self, conf):
        _LOGGER.info("Init tokenizer...")
        self.result = {}
        self.conf = conf
    
    def _replace_timestamp(self, event):
        raw = event.get("_raw")
        try:
            time_pos_start = int(event.get("timestartpos", -1))
            time_pos_end = int(event.get("timeendpos", -1))
        except:
            return raw
        
        if time_pos_start != 0 or time_pos_end == -1:
            return raw
        
        line = raw[time_pos_end:]
                
        return line
    
    def replace_tokens_with_regex(self, token_text):
        token_text = self._replace_tokens(token_text, self.conf.get_tokens(), "$")
#         token_text = self._replace_tokens(token_text, self.conf.get_timestamp_tokens(), "&")
        return token_text
    
    def _replace_tokens(self, token_text, tokens, placeholder):
        if placeholder == "$":
            placeholder = "\\$"
            
        regex_dict = {}
        
        for field_dict in tokens:
            name = field_dict.get("name")
            token = "{0}{0}{1}{0}{0}".format(placeholder, name)
            regex = field_dict.get("regex")
            if not regex.startswith("("):
                continue
            
            pos = token_text.find(token)
            while pos != -1:
                index = regex_dict.get(name)
                if index:
                    index += 1
                    regex_dict[name] = index
                else:
                    regex_dict[name] = 1
                    index = 1
                
                regex_with_group = "(?P<{}_{}>".format(name, index) + regex[1:]
                
                token_text = token_text[0:pos] + regex_with_group + token_text[pos+len(token) : ]
                pos = token_text.find(token, pos)
            
        return token_text
    
    def replace_text_with_tokens(self, line, table_delim=None):
        ret = " {} ".format(line)
        
        tokens = self.conf.get_tokens()
        for field_dict in tokens:
            name = "$${}$$".format(field_dict.get("name"))
            replace = ""
            regex = ""
            group = 1
            if field_dict.get("prefix") and not table_delim:
                regex += field_dict.get("prefix")
                replace += "\g<{}>".format(group)
                group += 1
                
            replace += name
            regex += field_dict.get("regex")
            group += 1
            
            if field_dict.get("suffix") and not table_delim:
                regex += field_dict.get("suffix")
                replace += "\g<{}>".format(group)
                
            if table_delim:
                regex = "^{}$".format(regex)
                if re.match(regex, line):
                    return name
                # replace += "\g<{}>".format(0)
            
            ret = re.sub(regex, replace, ret)
            # replace twice to make sure the prefix/suffix will not impact the results
            ret = re.sub(regex, replace, ret)
                
        return ret.strip()
    
    def tokenize(self, events):
        tokenized_events = []
        for event in events:
            raw_without_timestamp = self._replace_timestamp(event).strip()
            # replace the tokens
            raw_tokenized = self.replace_text_with_tokens(raw_without_timestamp)
            
            event = RegexResult.create_event(event.get("_raw"))
            event["words"] = regex_util.split_to_words(raw_tokenized)
            event["token"] = regex_util.escape_regex_terms(raw_tokenized)
            tokenized_events.append((raw_tokenized, event))
        return tokenized_events
        