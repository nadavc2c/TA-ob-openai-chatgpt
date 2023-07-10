import _ from "lodash";
import { combineEpics } from "redux-observable";

import actions from "app/redux/actions/cimMapping";

import { METHOD_NAMES, TRACK_CREATION, TRACK_DELETION } from "app/redux/constant";
import { generateEpics, generateRedirectEpic, generatePartyJSEpic } from "app/redux/utils";

const actionKeyToConfig = {
    CREATE_EVENTTYPE$: {
        url: "/app_edit_cimmapping/create_eventtype",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5102,
        collectType: TRACK_CREATION,
        normalizer: (data, payload) => {
            payload.sourcetypes = _.reduce(
                payload.sourcetypes,
                (result, flag, sourcetype) => {
                    if (flag) {
                        result.push(sourcetype);
                    }
                    return result;
                },
                []
            );
            return payload;
        }
    },
    UPDATE_EVENTTYPE$: {
        url: "/app_edit_cimmapping/update_eventtype",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5103,
        normalizer: (data, payload) => {
            payload.sourcetypes = _.reduce(
                payload.sourcetypes,
                (result, flag, sourcetype) => {
                    if (flag) {
                        result.push(sourcetype);
                    }
                    return result;
                },
                []
            );
            return payload;
        }
    },
    DELETE_EVENTTYPE$: {
        url: "/app_edit_cimmapping/delete_eventtype",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5104,
        collectType: TRACK_DELETION,
        normalizer: (data, payload) => {
            return payload;
        }
    },
    GET_EVENTTYPE_FIELD_VALUES$: {
        url: "/app_edit_cimmapping/get_field_values",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5105
    },
    GET_EVENTTYPE_KNOWLEDGE_OBJECTS$: {
        url: "/app_edit_cimmapping/get_knowledge_objects",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5106
    },
    CREATE_EVENTTYPE_EVAL$: {
        url: "/app_edit_cimmapping/create_eval",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5107,
        collectType: TRACK_CREATION,
        normalizer: (data, payload) => {
            return {
                knowledgeObjectInfo: payload,
                fieldValueChanges: data
            };
        }
    },
    UPDATE_EVENTTYPE_EVAL$: {
        url: "/app_edit_cimmapping/update_eval",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5108,
        normalizer: (data, payload) => {
            return {
                knowledgeObjectInfo: payload,
                fieldValueChanges: data
            };
        }
    },
    DELETE_EVENTTYPE_EVAL$: {
        url: "/app_edit_cimmapping/delete_eval",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5109,
        collectType: TRACK_DELETION,
        normalizer: (data, payload) => {
            return {
                knowledgeObjectInfo: payload,
                fieldValueChanges: data
            };
        }
    },
    CREATE_EVENTTYPE_ALIAS$: {
        url: "/app_edit_cimmapping/create_alias",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5107,
        collectType: TRACK_CREATION,
        normalizer: (data, payload) => {
            return {
                knowledgeObjectInfo: payload,
                fieldValueChanges: data
            };
        }
    },
    UPDATE_EVENTTYPE_ALIAS$: {
        url: "/app_edit_cimmapping/update_alias",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5108,
        normalizer: (data, payload) => {
            return {
                knowledgeObjectInfo: payload,
                fieldValueChanges: data
            };
        }
    },
    DELETE_EVENTTYPE_ALIAS$: {
        url: "/app_edit_cimmapping/delete_alias",
        method: METHOD_NAMES.POST,
        serverErrorCode: 5109,
        collectType: TRACK_DELETION,
        normalizer: (data, payload) => {
            return {
                knowledgeObjectInfo: payload,
                fieldValueChanges: data
            };
        }
    },

    GET_APP_SOURCETYPES_FROM_CONF$: {
        url: "/app_edit_cimmapping/get_app_sourcetypes",
        method: METHOD_NAMES.GET,
        serverErrorCode: 5110
    },

    GET_TREE_DATA$: {
        url: "/app_edit_cimmapping/get_model_tree",
        method: METHOD_NAMES.GET
    },
    GET_EVENTTYPE_INFO$: {
        url: "/app_edit_cimmapping/get_eventtype_info",
        method: METHOD_NAMES.GET,
        serverErrorCode: 5101
    },
    SAVE_SELECTED_CIM_MODEL$: {
        url: "/app_edit_cimmapping/save_models",
        method: METHOD_NAMES.POST
    }
};

const epics = generateEpics(actionKeyToConfig, actions);

const partyJsEpic = generatePartyJSEpic(actions.getCollectorActionName(), "cim-mapping");

const getEventTypeInfoEpic = generateRedirectEpic(
    actions.getResolvedActionName("GET_EVENTTYPE_INFO$"),
    actions.getSubActions("masterTable").getActionName("TABLE_SET_DATA")
);

const deleteEventTypeEpic = generateRedirectEpic(
    actions.getResolvedActionName("DELETE_EVENTTYPE$"),
    actions.getSubActions("masterTable").getActionName("TABLE_DELETE_ROW"),
    (payload, store) => {
        return store
            .getState()
            .get("tableData")
            .get("data")
            .findIndex(item => {
                return item.get("name") === payload.name;
            });
    }
);

export default combineEpics(
    ...epics,
    getEventTypeInfoEpic,
    deleteEventTypeEpic,
    partyJsEpic
);
