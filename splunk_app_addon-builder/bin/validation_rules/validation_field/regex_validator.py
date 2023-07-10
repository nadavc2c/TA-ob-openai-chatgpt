from builtins import range
from builtins import object
import re

class RegexValidator(object):

    def __init__(self):
        pass
    
    def is_regex_valid(self, regex):
        if not regex:
            return False
        
        try:
            re.compile(regex)
            return True
        except:
            return False
            
        return False
    
    def get_match_ratio(self, line, regexes):
        length = len(line)
        match_pos = []
        for regex in regexes:
            for m in re.finditer(regex, line):
                match_pos.append(m.span())
                
        matched_indexes = self._flattern_scopes(match_pos)
        
        ratio = 1.0 * len(matched_indexes) / length
        return ratio

    def _flattern_scopes(self, scopes):
        a = set()
        for aa in scopes:
            a = a.union(list(range(aa[0], aa[1])))
        return a
