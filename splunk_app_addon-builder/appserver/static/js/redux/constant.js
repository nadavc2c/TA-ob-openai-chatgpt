const STATUS = {
    PENDING: "PENDING",
    RESOLVED: "RESOLVED",
    REJECTED: "REJECTED"
};

const METHOD_NAMES = {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    DELETE: "DELETE"
};

const CONTENT_TYPE = {
    JSON: "application/json",
    FORM: "application/x-www-form-urlencoded"
};

const COLLECT_FOR_PARTYJS = "COLLECT_FOR_PARTYJS";
const TRACK_ERROR = "track_error";
const TRACK_CREATION = "track_creation";
const TRACK_DELETION = "track_deletion";

export { STATUS, METHOD_NAMES, CONTENT_TYPE, COLLECT_FOR_PARTYJS, TRACK_ERROR, TRACK_CREATION, TRACK_DELETION };
