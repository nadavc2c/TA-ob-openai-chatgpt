import _ from "lodash";
import { combineEpics } from "redux-observable";
import { Observable } from "rxjs/Rx";
import { getCustomURLPrefix } from "app/utils/AppInfo";
import {
    getMessageFromObject,
    getFormattedMessage
} from "app/utils/MessageUtil";
import { splunkUtils } from "swc-aob/index";

import { ajax } from "rxjs/observable/dom/ajax";

import actions from "app/redux/actions/fieldExtraction";

import { METHOD_NAMES, CONTENT_TYPE, TRACK_DELETION } from "app/redux/constant";
import { generateEpics, generateRedirectEpic, generatePartyJSEpic } from "app/redux/utils";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant.js";
import Immutable from 'immutable';

const getFormKey = splunkUtils.getFormKey;
const {
    FMT_KV,
    FMT_JSON,
    FMT_TABLE,
    FMT_XML,
    FMT_UNSTRUCTURED,
    FMT_UNPARSED
} = Constant;
const url_prefix = getCustomURLPrefix();

const actionKeyToConfig = {
    GET_SOURCETYPE_BASIC_INFO$: {
        url: "/app_edit_sourcetype/get_sourcetype_basic_info",
        method: METHOD_NAMES.GET,
        serverErrorCode: 4000
    },

    GET_PARSE_RESULT_FMT_UNSTRUCTURED$: {
        url: "/app_edit_fieldextraction/get_unstructured_result",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    START_PARSE_RESULT_FMT_UNSTRUCTURED$: {
        url: "/app_edit_fieldextraction/start_parse_unstructured_data",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$: {
        url: "/app_edit_fieldextraction/cancel_parse_unstructured_data",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    GET_PARSE_RESULT_FMT_KV$: {
        url: "/app_edit_fieldextraction/get_kv_format_results",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    GET_PARSE_RESULT_GET_EVENT$: {
        url: "/app_edit_fieldextraction/get_events",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    GET_PARSE_RESULT_FMT_TABLE$: {
        url: "/app_edit_fieldextraction/get_table_format_results",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    // Load
    LOAD_PARSE_RESULT_GET_EVENT$: {
        url: "/app_edit_fieldextraction/get_events",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    LOAD_PARSE_RESULT_FMT_KV$: {
        url: "/app_edit_fieldextraction/load_kv_format_results",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    LOAD_PARSE_RESULT_FMT_TABLE$: {
        url: "/app_edit_fieldextraction/load_table_format_results",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    LOAD_PARSE_RESULT_FMT_UNSTRUCTURED$: {
        url: "/app_edit_fieldextraction/load_unstructured_data_result",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        serverErrorCode: 4000
    },

    CLEAR_FIELD_EXTRACTION$: {
        url: "/app_edit_fieldextraction/delete_extraction",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        collectType: TRACK_DELETION,
        serverErrorCode: 4000
    },

    MERGE_CONF$: {
        url: "/app_edit_fieldextraction/merge_confs_from_default_to_local",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5102,
        normalizer: (data, payload) => {
            data.row = Immutable.fromJS(payload.row);
            return data;
        }
    },

    CHECK_FE_AVAILABLE$: {
        url: "/app_edit_fieldextraction/check_fe_available",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5102,
        normalizer: (data, payload) => {
            data.row = Immutable.fromJS(payload.row);
            return data;
        }
    }
};

const epics = generateEpics(actionKeyToConfig, actions);

const getSourcetypeBasicInfoEpic = generateRedirectEpic(
    actions.getResolvedActionName("GET_SOURCETYPE_BASIC_INFO$"),
    actions.getSubActions("masterTable").getActionName("TABLE_SET_DATA"),
    payload => {
        return _.map(payload, row => {
            row.metadata.name = row.name;
            return {
                event_count: row.metadata.event_count,
                data_format: row.metadata.data_format || FMT_UNPARSED,
                data_format_sortKey: row.metadata.is_parsed
                    ? row.metadata.data_format
                    : FMT_UNPARSED,
                name: row.name,
                metadata: row.metadata,
                is_parsed: row.metadata.is_parsed
            };
        });
    }
);

const LOAD_PARSE_RESULT_DIC = {
    [FMT_UNSTRUCTURED]: "LOAD_PARSE_RESULT_FMT_UNSTRUCTURED$",
    [FMT_KV]: "LOAD_PARSE_RESULT_FMT_KV$",
    [FMT_JSON]: "LOAD_PARSE_RESULT_GET_EVENT$",
    [FMT_TABLE]: "LOAD_PARSE_RESULT_FMT_TABLE$",
    [FMT_XML]: "LOAD_PARSE_RESULT_GET_EVENT$"
};

const loadParseResultEpic = generateRedirectEpic(
    actions.getActionName("LOAD_PARSE_RESULT"),
    payload => {
        return actions.getActionName(LOAD_PARSE_RESULT_DIC[payload.format]);
    },
    payload => {
        return payload.data;
    }
);

const partyJsEpic = generatePartyJSEpic(actions.getCollectorActionName(), 'field-extraction');

const getParseProgressEpic = action$ =>
    action$
        .ofType(actions.getActionName("GET_PARSE_PROGRESS_FMT_UNSTRUCTURED"))
        .switchMap(({ payload }) => {
            return ajax({
                url: url_prefix +
                    "/app_edit_fieldextraction/get_extraction_progress",
                responseType: "json",
                method: METHOD_NAMES.POST,
                headers: {
                    "Content-Type": CONTENT_TYPE.FORM,
                    "X-Splunk-Form-Key": getFormKey()
                },
                body: payload
            })
                .catch(error => {
                    return Observable.of(error);
                })
                .map(res => res.response || res)
                .map(res => {
                    if (res.hasOwnProperty("data")) {
                        return res.data;
                    } else {
                        if (res.err_code) {
                            throw Error(getMessageFromObject(res));
                        } else {
                            throw Error(getFormattedMessage(4000));
                        }
                    }
                })
                .takeUntil(
                    action$.ofType(
                        actions.getActionName(
                            "CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$"
                        )
                    )
                )
                .map(data => {
                    let val = data.progress;
                    if (isNaN(val)) {
                        val = 0;
                    }
                    val = Math.max(0, Math.min(1, val));
                    payload.progress = val;
                    if (data.finished) {
                        val = 1;
                        return actions.getAction(
                            "GET_PARSE_RESULT_FMT_UNSTRUCTURED$",
                            payload
                        );
                    } else {
                        return actions.getAction(
                            "SET_PARSE_PROGRESS_FMT_UNSTRUCTURED",
                            payload
                        );
                    }
                })
                .catch(error => {
                    return Observable.of(
                        actions.getAction(
                            "GET_PARSE_PROGRESS_FMT_UNSTRUCTURED_ERROR",
                            error.message
                        )
                    );
                });
        });

const startParseProgressEpic = generateRedirectEpic(
    actions.getResolvedActionName("START_PARSE_RESULT_FMT_UNSTRUCTURED$"),
    actions.getActionName("GET_PARSE_PROGRESS_FMT_UNSTRUCTURED")
);

const setParseProgressEpic = generateRedirectEpic(
    actions.getActionName("SET_PARSE_PROGRESS_FMT_UNSTRUCTURED"),
    actions.getActionName("GET_PARSE_PROGRESS_FMT_UNSTRUCTURED")
);

const openModalAfterCheckingEpic = generateRedirectEpic(
    actions.getResolvedActionName("CHECK_FE_AVAILABLE$"),
    (payload) =>{
        if(payload.successful){
            return actions.getActionName("OPEN_MODAL");
        }
        else{
            return actions.getActionName("TOGGLE_MERGE_MODAL");
        }
    },
    (payload) => {
        if(payload.successful){
            return payload.row;
        }
        else{
            return payload;
        }
    }
);

const openParseModalEpicAfterMergingEpic = generateRedirectEpic(
    actions.getResolvedActionName("MERGE_CONF$"),
    actions.getActionName("OPEN_MODAL"),
    payload => payload.row
);

export default combineEpics(
    ...epics,
    getSourcetypeBasicInfoEpic,
    loadParseResultEpic,
    startParseProgressEpic,
    getParseProgressEpic,
    setParseProgressEpic,
    openModalAfterCheckingEpic,
    openParseModalEpicAfterMergingEpic,
    partyJsEpic
);
