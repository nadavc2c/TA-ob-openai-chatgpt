from builtins import range
from builtins import object
import logging
import re
from field_extraction_builder import regex_util, regex_logger
from field_extraction_builder.regex_serialize import RegexResult
import field_extraction_builder.regex_util as ru
_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)

class RegexGenerator(object):

    def __init__(self, conf, tokenizer):
        _LOGGER.info("Init Generator...")
        self.conf = conf
        self.tokenizer = tokenizer
        self.placeholder = '__splunk_addon_builder_extraction_palceholder__'

    def _get_field_name(self, values):
        pvalues = set(values)
        for field_dict in self.conf.get_fields():
            field_name = field_dict.get("name")
            field_values = set(field_dict.get("values"))
            if not field_dict.get("case_sensitive", False):
                field_values = set([value.lower() for value in field_values])
                pvalues = set([pvalue.lower() for pvalue in values])
            hits_in_possible_values = len(pvalues.intersection(field_values))
            if hits_in_possible_values >= field_dict.get("min_match_count", 1):
                return field_name

        return "field"

    def _get_regex_from_possible_values(self, possible_values, field_name):
        regexes = [r"\d*", r"\w*", r"\S*"]
        for regex in regexes:
            match_all = True
            for value in possible_values:
                if not re.match("{}{}{}".format("^", regex, "$"),  value):
                    match_all = False
                    break

            if match_all:
                return r"(?P<{}>{})".format(field_name, regex.replace("\\", r"\\"))
        return r"(?P<{}>[\\s\\S]*)".format(field_name)

    def _get_regex(self, seed):
        seed_text = seed.get("words")
        shared_str_indexes = seed.get("shared_str_indexes")
        insert_info = seed.get("insert_str_points") or {}

        if not shared_str_indexes:
            shared_str_indexes = list(range(len(seed_text)))

        index = 0
        raw_regex = ""
        matches = []
        last_is_regex = False
        length = len(seed_text)
        insert_points = list(insert_info.keys())
        starts_with_capture_group = True

        # if the should insert str at the beginning of the regex
        if 0 in insert_points:
            regex = '{0}{1}{0}'.format(self.placeholder, index)
            index += 1
            matches.append([])
            raw_regex = regex
            last_is_regex = True
            starts_with_capture_group = False

        # iterator the seed
        for i in range(length):
            ch = regex_util.escape_regex_terms(seed_text[i])

            if not ch:
                continue

            if i in insert_points or i not in shared_str_indexes:
                if last_is_regex or starts_with_capture_group:
                    continue

                regex = '{0}{1}{0}'.format(self.placeholder, index)
                index += 1
                matches.append([])
                if i in insert_points and not last_is_regex:
                    regex += '?'
                raw_regex += regex
                last_is_regex = True
            elif self.conf.get_keyword_dict().get(ch.lower()):
                # if the word is in the dictionary, make it as a capture group as well
                if starts_with_capture_group:
                    continue
                ch = '{0}{1}{0}'.format(self.placeholder, index)
                index += 1
                matches.append([])
                raw_regex += ch
                last_is_regex = True
                starts_with_capture_group = False
            else: # it's const str
                raw_regex += ch
                last_is_regex = False
                starts_with_capture_group = False


        # add at the end of the text
        if insert_info and max(insert_info) >= length and not last_is_regex:
            regex = '{0}{1}{0}'.format(self.placeholder, index)
            index += 1
            matches.append([])
            raw_regex += regex

        raw_regex = raw_regex.strip()

        regex_dict = RegexResult.create_regex(raw_regex)
        regex_dict["possible_values"] = matches

        return regex_dict

    def _insert_possible_values_to_regex(self, regex_dict, events):

        matches = regex_dict["possible_values"]
        regex_with_placeholder = regex_dict["regex"] + r'[\s\r\n\t]*$'
        regex = re.sub(r'{0}\d+{0}'.format(self.placeholder), r'([\\s\\S]*)', regex_with_placeholder)

        matches = self._get_group_matches(regex, events, matches)

        regex, regex_with_values, regex_with_placeholder = self._get_regex_with_values(regex_with_placeholder, matches, events)

        regex_dict["regex_with_possible_values"] = self.tokenizer.replace_tokens_with_regex(regex_with_values)
        regex_dict["regex"] = self.tokenizer.replace_tokens_with_regex(regex)
        #regex_obj.fields = self.get_fields_from_regex(regex_with_placeholder, regex_obj.possible_values)

        return

    def _get_group_matches(self, regex, events, matches):
        for event in events:
            words = event["words"]
            text = "".join(words)
            i = 0
            match = re.match(".*{}".format(regex), text, flags=re.S)
            if not match:
                msg = "Not match!\nregex={}\nline={}\n".format(regex, text)
                _LOGGER.error(msg)
                regex_util.stop_on_error(msg)
                continue
            groups = match.groups()
            for match_group in groups:
                match_group = regex_util.escape_regex_terms(match_group)
                if match_group not in matches[i]:
                    matches[i].append(match_group)
                i += 1

        return matches

    def _get_regex_with_values(self, regex_with_placeholder, matches, events):
        regex = self._remove_regex_placeholder(regex_with_placeholder)
        regex_with_values = regex_with_placeholder

        index = 0
        remove_indexes = []
        field_dict = {}

        for match in matches:
            item = '{0}{1}{0}'.format(self.placeholder, index)
            is_optional = False


            field_name = self._get_field_name(match)
            field_index = field_dict.get(field_name)
            if field_index:
                field_index += 1
                field_dict[field_name] = field_index
            else:
                field_index = 1
                field_dict[field_name] = 1

            field_name = "{}_{}".format(field_name, field_index)
            if len(match) <= 5:
                if "" in match:
                    match.remove("")
                    is_optional = True
                match = [m.replace("\\\\", r"\\\\") for m in match]
                option = "|".join(match)
                if option:
                    option = "(?P<{}>{})".format(field_name, option)
                    if is_optional:
                        option += '?'
                    regex_with_values = re.sub(item, option, regex_with_values, count=1)
                else:
                    remove_indexes.append(index)
            else:
                item_regex = self._get_regex_from_possible_values(match, field_name)
                regex_with_values = re.sub(item, item_regex, regex_with_values, count=1)
                match = None
            index += 1

        # remove the capture group since the whole string's already matched
        for index in remove_indexes[::-1]:
            del matches[index]
            item = '{0}{1}{0}'.format(self.placeholder, index)
            regex_with_values = re.sub(r"{}\??".format(item), "", regex_with_values)
            regex_with_placeholder = re.sub(r"{}\??".format(item), "", regex_with_placeholder)
            regex = self._remove_regex_placeholder(regex_with_values)
            # test the if the regex matches the events
            for event in events:
                text = "".join(event["words"])
                if not re.match(".*" + regex, text):
                    msg = "Not match after removing one capture group!\nregex={}\nline={}\n".format(regex_with_values, text)
                    _LOGGER.error(msg)
                    regex_util.stop_on_error(msg)

        return regex, regex_with_values, regex_with_placeholder

    def _remove_regex_placeholder(self, regex_with_placeholder):
        return re.sub(r'{0}\d+{0}'.format(self.placeholder), r'([\\s\\S]*)', regex_with_placeholder)
        
    def update_regex_group(self, regex_groups):
        for regex_group in regex_groups:
            events = regex_group.get("events")
            seed = regex_group.get("seed")
    
            regex_dict = self._get_regex(seed)
            self._insert_possible_values_to_regex(regex_dict, events)
            regex_group["regex"] = regex_dict
    
            # throw exception:
            # capture group count > 100
            re.compile(regex_dict.get("regex"))
            
