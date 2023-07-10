from builtins import object
import logging
import csv
import time

from field_extraction_builder.regex_conf import RegexConfMgr
from field_extraction_builder.regex_cluster import RegexCluster
from field_extraction_builder.regex_generator import RegexGenerator
from field_extraction_builder.regex_tokenizer import Tokenizer
from field_extraction_builder.regex_process import RegexProcessPool, make_shared_dict
from field_extraction_builder.regex_serialize import RegexResult
from field_extraction_builder import regex_logger, regex_util

#from splunk_client import SplunkClient
_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)        

class RegexLoader(object):

    def __init__(self):
        _LOGGER.info("Init Regex Loader...")
        self.conf = RegexConfMgr()
        self.multiprocess = True
        self.process_count = 0 # use CPU core count
        
        self.tokenizer = Tokenizer(self.conf)
        self.cluster = RegexCluster(self.conf)
        self.generator = RegexGenerator(self.conf, self.tokenizer)

    def run(self, events, progress_func=None, is_append=False, output_path=None, event_file_path=None):
        if not events:
            events = self._read_events_from_file(event_file_path) if event_file_path else None
            
        if not events:
            _LOGGER.error("Cannot get any events.")
            return None
        
        event_count = len(events)
        if not is_append:
            events = self.tokenize(events, progress_func)
        
        if progress_func:
            progress_func(0.1)
            
        _LOGGER.info("Cluster the events")
        if self.multiprocess:
            pool = RegexProcessPool(self.process_count)
            group_dict = make_shared_dict({})
            pool.run(cluster, events, (self.cluster, group_dict))
            results = pool.get_results()
            cluster_result = self.cluster.merge_results(results)
        else:
            cluster_result = cluster(self.cluster, {}, events)
            for group in cluster_result.get("groups"):
                seed = group.get("seed")
                regex_util.merge_shared_indexes(seed["shared_str_indexes"], seed)

        if progress_func:
            progress_func(0.8)
        
        _LOGGER.info("Generate regexes")
        
        group_results = cluster_result.get("groups")
        self.generator.update_regex_group(group_results)
        
        for group_result in group_results:
            group_event_count = len(group_result.get("raw_events", []))
            sample_rate = 1.0 * group_event_count / event_count
            group_result["event_count"] = group_event_count
            group_result["sample_rate"] = sample_rate
            if sample_rate < self.conf.disable_group_rate:
                group_result["regex"]["enabled"] = False
            
        group_results.sort(key=lambda x: x.get("event_count"), reverse=True)
        
        if output_path:
            _LOGGER.info("Output result to file %s", output_path)
            cluster_result.results_to_file(output_path)
            
        return cluster_result
    
    def tokenize(self, events, progress_func=None):
        _LOGGER.info("Tokenize the events")
        
        if self.multiprocess:
            process_pool = RegexProcessPool(self.process_count)
            process_pool.run(tokenize, events, (self.tokenizer,))
            
            results = process_pool.get_results()
            tokenized_events = []
            for res in results:
                tokenized_events += res
        else:
            tokenized_events = tokenize(self.tokenizer, events)
        
        # dedup events
        events = self._dedup_events(tokenized_events)
        
        return events
    
    def merge_events(self, events, groups, progress_func=None):
        # progress = 0.2
        events = self.tokenize(events, progress_func)
        
        _LOGGER.info("Append the new events to existing groups if possible.")
        for group in groups:
            seed_event = group.get("seed")
            events, others = self.cluster.merge_events_to_seed(events, seed_event)
            gid = group.get("group_id")
            
            _LOGGER.info("Append {} events to group {}".format(len(events), gid))
            RegexResult.append_group_events(group, events)
            
            events = others
        
        if progress_func:
            progress_func(0.4)
        
        _LOGGER.info("Re-generate regex if the regex is not customized by users.")
        if self.multiprocess:
            process_pool = RegexProcessPool()
            
        for group in groups:
            gid = group.get("group_id")
            
            if group.get("regex").get("customized"):
                _LOGGER.info("Group {}'s regex has been customized by users. Skip to re-generate regex.")
            else:
                _LOGGER.info("Need to update the regex of group {}".format(gid))
                self.generator.update_regex_group(group)
        
        if progress_func:
            progress_func(0.7)
        
        _LOGGER.info("Clustering rest of the events and generate regexes.")
        if others:
            results = self.run(others, progress_func, is_append=True)
            new_groups = results.get("groups")
            groups += new_groups
            
        _LOGGER.info("Finish to merge events into existing groups.")
        return groups
            
            
    def _read_events_from_file(self, file_path):
        events = []
        
        _LOGGER.info("Read the events from file")
        with open(file_path, "r") as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                if row:
                    events.append(row)
                
        return events
    
    def _dedup_events(self, tokenized_events):
        dedup_dict = {}
        for raw, event in tokenized_events:
            if dedup_dict.get(raw):
                exist_event = dedup_dict.get(raw)
                exist_event["raw_events"].append(event.get("raw"))
            else:
                dedup_dict[raw] = event
        return list(dedup_dict.values())
    
    def create_process_file(self, filepath="./"):
        pass
        
def tokenize(tokenizer, events, process_group_index=0, process_group_count=1):
    return tokenizer.tokenize(events)

def cluster(clst, group_dict, events, process_group_index=0, process_group_count=1):
    return clst.run(events, process_group_index, process_group_count, group_dict)
    