from builtins import object
class DataFormat(object):
    TABLE = "tabular"
    KV = "kv"
    JSON = "json"
    XML = "xml"
    UNSTRUCTURE = "unstructured_data"
    
    @staticmethod
    def is_valid_format(data_format):
        if data_format in (DataFormat.TABLE, DataFormat.KV, DataFormat.JSON, 
                            DataFormat.XML, DataFormat.UNSTRUCTURE):
            return True
        return False