from __future__ import division
from builtins import range
from builtins import object
from past.utils import old_div
import logging
import multiprocessing
from field_extraction_builder import regex_logger

_LOGGER = regex_logger.Logs().get_logger("regex_gen", level=logging.DEBUG)
            
class RegexProcessPool(object):
    def __init__(self, size=0):
        if size <= 0:
            size = multiprocessing.cpu_count()
        self.size = size
        self._pool = multiprocessing.Pool(processes=size)
        self._stopped = False
        self._results = []

    def cancel(self):
        if self._stopped:
            return
        
        self._stopped = True
        self._pool.close()
        self._pool.join()
        
    def wait_for_stop(self):
        self._pool.close()
        self._pool.join()
        
    def run(self, func, items, args=()):
        """
        divide the items into small pieces based on process count
        """
        if self._stopped:
            return None

        items = list(items)
        batch_size = old_div(len(items), self.size)
        for i in range(self.size):
            if i == self.size -1:
                curr_items = items[int(i*batch_size):]
            else:
                curr_items = items[int(i*batch_size) : int((i+1)*batch_size)]
                
            new_args = args + (curr_items, i, self.size)
            self._results.append(self._pool.apply_async(func, new_args))
        self.wait_for_stop()
            
    def get_results(self):
        return [res.get() for res in self._results]
    
def make_shared_dict(shared_dict):
    return multiprocessing.Manager().dict(shared_dict)
    
def make_shared_list(shared_list):
    return multiprocessing.Manager().list(shared_list)
    