from __future__ import print_function
from builtins import range
import re
import sys
import csv
import json

def is_true(val):
    return val.upper() in ("TRUE", "T", "1", "ENABLE", "ENABLED", 1)

def is_false(val):
    return not is_true(val)

def is_word(ch):
    word_set = set(['_', '-', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 
                    'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 
                    'v', 'b', 'n', 'm', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 
                    'O', 'P', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Z', 
                    'X', 'C', 'V', 'B', 'N', 'M',
                    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    return ch in word_set

def split_to_words(text):
    words = []
    i = 0
    regexes = (r'^(\s+)', r'^(\$\$[\w\-]+\$\$)', r'^([\w\-]+)',r'^([^\w\-\$])')
    while i < len(text):
        for regex in regexes:
            m = re.match(regex, text[i:])
            if m:
                break
            
        if m:
            word = m.group()
        else:
            word = text[i]
        
        words.append(word)
        i += len(word)
        
    return words
            
def escape_regex_terms(regex, in_square_brackets=False):
    if not regex:
        return regex
    
    regex_keywords = [
        '\\', '.', '/', '(', ')', '$', '^', '|', '*', '[', ']', '+', "{", "}", "?"]
    
    if in_square_brackets:
        regex_keywords.append("-")
    for keyword in regex_keywords:
        regex = regex.replace(keyword, "\\" + keyword)
    return regex

def _flatten_scopes(scopes):
    a = set()
    for aa in scopes:
        a = a.union(list(range(aa[0], aa[1])))
    return a

def merge_scopes(scopes):
    if not scopes:
        return set()
    intersection = _flatten_scopes(scopes[0])
    for overlap in scopes:
        flatten = _flatten_scopes(overlap)
        if flatten == intersection:
            continue
        intersection = intersection.intersection(flatten)
    return intersection

def csv_to_json(csv_file):
    with open(csv_file, "r") as f:
#         headers = f.readLine().split(",")
        reader = csv.DictReader(f)
        jsoncont = json.dumps([row for row in reader])
        return jsoncont
        
def merge_shared_indexes(shared_str_indexes, seed_event):
    intersection = merge_scopes(shared_str_indexes)
    seed_event["shared_str_indexes"] = sorted(list(intersection))
    return

def sourcetype_to_str(sourcetype):
    return re.sub(r"[^\w]+", "_", sourcetype)

def stop_on_error(msg, need_stop=True):
    need_stop = False
    print(("*******ERROR*******", msg))
    if need_stop:
        sys.exit()
    
def get_pattern_tokens(pre_tokens, regex):
    for token in pre_tokens:
        token_regex = token.get("regex")
        token_regex = token_regex[1:-1]
        regex = regex.replace(token_regex, "")
        
    regex = re.sub(r"\(\?P<(\w+)>[^\)]*\)", r"{{\g<1>}}", regex)
    return re.split(r" ", regex)

def get_capture_group_position(text, regex):
    text = text.strip()
    regex_obj = re.compile(regex)
    group_count = regex_obj.groups
    res = []
    for find in re.finditer(regex, text):
        item = {"pair": {"text": find.group(), "pos": find.span()}}
        for i in range(group_count):
            item.update({
                i: {
                    "text": find.group(i+1),
                    "pos": find.span(i+1),
                }})
        res.append(item)
    return res

def get_match_status(text, regex):
    text = text.strip()
    res = get_capture_group_position(text, regex)
    
    # caculate the ratio
    ratio = 0
    if not res:
        ratio = 0
    else:
        match_len = 0
        for p in res:
            start, end = p[0].get("pos")
            match_len += end - start
        ratio = 1.0 * match_len / len(text)
    
    return {
        "matches": res,
        "ratio": ratio,
    }
    
def escape_str(text):
    if not text:
        return text
    
    chars = {
        '\\"': "\"", 
        "\\'": "\'", 
        "\\b": "\b", 
        "\\r": "\r", 
        "\\n": "\n", 
        "\\t": "\t", 
        "\\v": "\v", 
        "\\f": "\f",
    }
    for k,v in list(chars.items()):
        text = text.replace(k, v)
        
    return text

    