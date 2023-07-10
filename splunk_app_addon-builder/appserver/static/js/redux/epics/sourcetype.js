import _ from "lodash";
import { combineEpics } from "redux-observable";

import actions from "app/redux/actions/sourcetype";

import { METHOD_NAMES, CONTENT_TYPE, TRACK_DELETION } from "app/redux/constant";
import { generateEpics, generateRedirectEpic, generatePartyJSEpic } from "app/redux/utils";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant.js";
const { FMT_UNPARSED } = Constant;
const actionKeyToConfig = {
    GET_SOURCETYPE_BASIC_INFO$: {
        url: "/app_edit_sourcetype/get_sourcetype_basic_info",
        method: METHOD_NAMES.GET,
        serverErrorCode: 2101
    },
    DELETE_SOURCETYPE$: {
        url: "/app_edit_sourcetype/delete_sourcetype",
        contentType: CONTENT_TYPE.FORM,
        method: METHOD_NAMES.POST,
        collectType: TRACK_DELETION,
        serverErrorCode: 2102
    }
};

const partyJsEpic = generatePartyJSEpic(actions.getCollectorActionName(), 'sourcetype');

const epics = generateEpics(actionKeyToConfig, actions);

const getSourcetypeBasicInfoEpic = generateRedirectEpic(
    actions.getResolvedActionName("GET_SOURCETYPE_BASIC_INFO$"),
    actions.getSubActions("masterTable").getActionName("TABLE_SET_DATA"),
    payload => {
        return _.map(payload, row => {
            return {
                event_count: row.metadata.event_count,
                data_input_name: row.metadata.data_input_name,
                data_input_name_sortKey: row.metadata.data_input_name || "-",
                data_format: row.metadata.is_parsed
                    ? row.metadata.data_format
                    : FMT_UNPARSED,
                name: row.name,
                metadata: row.metadata,
                conf_data: row.conf_data,
                is_parsed: row.metadata.is_parsed
            };
        });
    }
);

export default combineEpics(
    ...epics,
    getSourcetypeBasicInfoEpic,
    partyJsEpic
);
