from builtins import object
import json

class RegexResult(object):
    def __init__(self, result=None):
        if result:
            self.result = result
        else:
            self.result = {
                "last_indextime": 0,
                "status": {
                    "finished": True,
                    "progress": 0,
                },
                "error": {
                    "code": 0,
                    "params": {},
                },
                "groups": [],
            }
    
    """
    group:
        {
            "group_id": "sourcetype_0",
            "sample_rate": 0.67, 
            "event_count": 1000,
            "regex": {
                "regex": "(.*?) to other (.*?) host",
                "token": "$$ipv4$$ to host: bytes $$number$$",
                "fields" : ["field_name1", "field_name2"],
                "capture_group_count": 0,
                "enabled": True,
                "regex_with_possible_values": "(.*?) to other (test1|test2) host",
                "possible_values": [None, set(["test1", "test2"])],
                "customized": False, # if the regex is customized by users
            },
            "seed": { # class SeedEvent
                "token": "$$ipv4$$/$$port$$ to dest",
                "words": ["word1", " ", "#", ":", "word2", "$$number$$", "/"],
                "count": 0,
                "shared_str_indexes" : [[1,2,3,4], [8,9,10,11,12,13]],
                "insert_str_points" : { 5 : "insert1", 10 : "insert2"},
            },
            "events": [], # raw events within this group
        }
        
    """



    def get_result(self):
        return self.result

    def result_to_file(self, output_file):
        with open(output_file, "w") as f:
            json.dump(f, self.result)
    
    @staticmethod
    def append_group_events(group, events):
        raw_events = []
        for e in events:
            raw_events.append(e.get("raw"))
            raw_events += e.get("raw_events")
        group["raw_events"] += raw_events
        group["events"] += events

    @staticmethod
    def create_regex(regex):
        return {
            "regex": regex,
            "enabled": True,
            "regex_with_possible_values": "",
            "possible_values": []
        }
        
    @staticmethod
    def create_event(raw):
        return {
            "raw": raw,
            "words": [],
            "token": "",
            "raw_events": [],
        }
        
    @staticmethod
    def create_seed(event):
        return {
            "raw": event.get("raw"),
            "token": event.get("token", ""),
            "words": event.get("words", []),
            "raw_events": event.get("raw_events", []),
            "shared_str_indexes": [],
            "insert_str_points": {},
        }
    
    @staticmethod
    def create_group(gid, seed, events):
        raw_events = []
        for e in events:
            raw_events.append(e.get("raw"))
            raw_events += e.get("raw_events")
            
        return {
            "group_id": gid,
            "seed": seed,
            "events": events,
            "raw_events": raw_events,
        }
        