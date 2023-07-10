const RESERVED_KEYS = [
    "_message_codes",
    "_message_texts",
    "_raw",
    "_time",
    "host",
    "linecount",
    "punct",
    "source",
    "sourcetype",
    "_fulllinecount"
];

const isReservedKey = function(key) {
    return RESERVED_KEYS.indexOf(key) > -1;
};

export { isReservedKey };
