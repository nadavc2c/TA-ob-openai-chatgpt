from __future__ import division
from builtins import object
from past.utils import old_div
from difflib import SequenceMatcher
from field_extraction_builder.regex_serialize import RegexResult
from field_extraction_builder import regex_util, regex_logger

import logging

_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)

class RegexCluster(object):
    def __init__(self, conf):
        self.conf = conf
        self.max_ratio = conf.get_cluster_ratio()

    # get the distance of 2 strs, and result of diff
    def _distance(self, line1, line2):
        matcher = SequenceMatcher(None, line1, line2)
        ratio = matcher.ratio()
        overlap_indexes = []
        insert_info = {}
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                overlap_indexes.append([i1, i2])
            elif tag == 'insert':
                if insert_info.get(i1):
                    insert_info[i1].append(line2[j1:j2])
                else:
                    insert_info[i1] = [line2[j1:j2]]
        return ratio, overlap_indexes, insert_info

    def run(self, events, process_group_index=1, process_group_count=1, group_dict={}):
        _LOGGER.info("Start clustering...")
        regex_result = RegexResult().get_result()
        gid = process_group_index
        event_count = len(events)
        while events:
            # find one unique group id
            while gid in list(group_dict.keys()):
                gid += process_group_count

            events = self.clustering(gid, events, regex_result)
            events_finished = event_count - len(events)

            group_dict[gid] = events_finished
        _LOGGER.info("Finish clustering.")

        return regex_result

    def clustering(self, gid, events, regex_result):
        if not events:
            return

        events = list(events)
        seed_event = RegexResult.create_seed(events.pop())

        seed_group, other_lines = self.merge_events_to_seed(events, seed_event)
        seed_group.append(seed_event)

        group_id = "{}_{}".format("pattern", gid)
        group = RegexResult.create_group(group_id, seed_event, seed_group)
        regex_result["groups"].append(group)
        return other_lines

    def skip_clustering(self, seed_len, event):
        event_len = len(event["words"])
        if abs(seed_len - event_len) > 100 and (old_div(event_len,seed_len) > 2 or old_div(seed_len,event_len) > 2):
            return True
        return False

    def merge_events_to_seed(self, events, seed_event):
        seed_group = []
        other_events = []

        inserts = {}
        shared_str_indexes = []

        if not events:
            return seed_group, other_events

        seed_len = len(seed_event["words"])

        for event in events:
            words = event["words"]
            if self.skip_clustering(seed_len, event):
                other_events.append(event)
                continue

            distance, overlap, insert_points = self._distance(seed_event["words"], words)

            # cluster the similar lines
            if distance >= self.max_ratio:
                seed_group.append(event)

                shared_str_indexes.append(overlap)
                inserts.update(insert_points)
            else:
                other_events.append(event)

        seed_event["shared_str_indexes"] = shared_str_indexes
        # regex_util.merge_shared_indexes(shared_str_indexes, seed_event)
        seed_event["insert_str_points"] = inserts

        return seed_group, other_events

    def merge_results(self, results):
        new_groups = []

        all_groups = []

        for res in results:
            groups = res.get("groups")
            all_groups += groups
            
        while all_groups:
            curr_group = all_groups.pop()
            curr_seed = curr_group.get("seed")

            has_similar = False
            for group in all_groups:
                seed_event = group.get("seed")
                distance, overlap, insert_points = self._distance(seed_event["words"], curr_seed["words"])
                if distance >= self.max_ratio:
                    
                    seed_event["raw_events"] += curr_seed["raw_events"]
                    
                    group["raw_events"] += curr_group.get("raw_events", [])
                    group["events"] += curr_group.get("events", [])
                    
                    # re-calculate the insert points and shared str
                    for event in curr_group["events"]:
                        distance, overlap, insert_points = self._distance(seed_event["words"], event["words"])
                        seed_event["shared_str_indexes"].append(overlap)
                        seed_event["insert_str_points"].update(insert_points)
                        
                    has_similar = True
                    break

            if not has_similar:
                regex_util.merge_shared_indexes(curr_seed["shared_str_indexes"], curr_seed)
                new_groups.append(curr_group)

        res = {
            "status": {"finished": True, "progress": 0.8},
            "groups": new_groups,
        }
        return res
