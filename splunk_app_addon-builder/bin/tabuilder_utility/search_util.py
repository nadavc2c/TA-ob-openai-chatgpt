import time
import json
import os

import splunklib.results as results
from tabuilder_utility import validation_utility, path_util, temp_manager
from aob.aob_common.metric_collector import metric_util

@metric_util.function_run_time(tags=['search_util'])
def splunk_search(service, search_str):
    search_str = search_str.strip()
    if not search_str.startswith("|") and not search_str.startswith("search"):
        search_str = "search {}".format(search_str)

    # job = service.search(search_str, exec_mode='blocking')
    job = service.search(search_str)
    job.disable_preview()
    while not job.is_done():
        time.sleep(0.1)
    events_str = job.events(output_mode='json', count=0).read()
    events = json.loads(events_str)
    event_results = events.get('results', None)
    if not event_results:
        result_list = []
        for r in results.ResultsReader(job.results(count=0)):
            if isinstance(r, dict):
                result_list.append(dict(r))
            elif isinstance(r, results.Message):
                # Diagnostic messages may be returned in the results
                raise Exception('%s: %s' % (r.type, r.message))
        return result_list
    else:
        return event_results

@metric_util.function_run_time(tags=['search_util'])
def is_splunk_search_valid(service, search_str):
    try:
        splunk_search(service, search_str + " | head 1")
    except:
        return False
    return True

@metric_util.function_run_time(tags=['search_util'])
def get_search_sourcetypes(service, search_str, event_count=10000):
    search_str = "index=* {} | head {} | stats values(sourcetype)".format(search_str, event_count)

    res = splunk_search(service, search_str)
    if not res:
        return []

    sourcetypes = list(res[0].values())[0]
    if not isinstance(sourcetypes, list):
        sourcetypes = [sourcetypes]
    return sourcetypes

@metric_util.function_run_time(tags=['search_util'])
def get_field_summary(service, search_str, fields=(), top=10, event_count=10000):
    """
    Return: a list of field summary
    {
        [
            name: field1,
            count: int,
            values:[
                value: str,
                count: int,
                percent: float,
            ]
        ],

    }
    """
    search_str = "index=* {} | head {} | fieldsummary".format(search_str, event_count)
    if fields:
        search_str += " {}".format(",".join(fields))

    results = splunk_search(service, search_str)
    res = []
    for r in results:
        field = r.get("field")
        item = {"name": field}

        count = int(r.get("count"))
        item["count"] = count
        values = json.loads(r.get("values"))
        if not values:
            continue

        values = values[:top]
        item["values"] = values
        item["distinct_count"] = int(r.get("distinct_count"))
        for v in values:
            v["count"] = int(v.get("count"))
            v["percent"] = 1.0 * v["count"] / count

        res.append(item)

    return res

@metric_util.function_run_time(tags=['search_util'])
def dump_events(service, id, sourcetypes, result_dir, event_count=1000):
    error_sourcetypes = []
    for sourcetype in sourcetypes:
        # dump original events to files

        temp_file = validation_utility.get_temp_csv_name(id, sourcetype)

        search_str = "search index=* (sourcetype=\"{}\")".format(sourcetype)
        search_str += " | head {} | dedup _raw | outputcsv {}".format(
                event_count, temp_file)

        splunk_search(service, search_str)
        output = os.path.join(path_util.get_splunk_csv_output_path(), temp_file)

        if os.path.isfile(output):
            temp_mgr = temp_manager.TempManager()
            temp_mgr.copy_to_temp(output, temp_file, result_dir)
        else:
            error_sourcetypes.append(sourcetype)

    return error_sourcetypes

@metric_util.function_run_time(tags=['search_util'])
def get_sourcetype_from_index(service, use_tab_index=False):
    index = "add_on_builder_index" if use_tab_index else "*"
    search = "| metadata type=sourcetypes index={}".format(index)
    search_result = splunk_search(service, search)
    return search_result