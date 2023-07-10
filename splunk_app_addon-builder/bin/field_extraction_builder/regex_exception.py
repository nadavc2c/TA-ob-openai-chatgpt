class InvalidRegex(Exception):
    def __init__(self, regex):
        self.regex = regex
        
class CaptureGroupCountError(Exception):
    def __init__(self, regex, count):
        self.regex = regex
        self.count = count