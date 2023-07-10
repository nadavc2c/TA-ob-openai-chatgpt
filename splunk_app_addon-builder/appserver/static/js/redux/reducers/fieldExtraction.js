import { handleActions } from "redux-actions";
import actions from "app/redux/actions/fieldExtraction";
import Immutable from "immutable";
import _ from "lodash";
import {
    generateNavigationReducers,
    generatePendingsReducers
} from "app/redux/utils";
import { generateTableReducer } from "app/redux/shared/tableReducerGenerator";

const navigation = generateNavigationReducers(actions);

const pendings = generatePendingsReducers(actions);

const emptyObj = Immutable.Map({});

const mergeConfModal = handleActions(
    {
        [actions.getResolvedActionName("MERGE_CONF$")]: (
            state
        ) => state.set('isOpen', !state.get('isOpen'))
        ,
        [actions.getRejectedActionName("MERGE_CONF$")]: (
            state,
            { payload }
        ) => {
            return state.set("error", payload);
        }
        ,
        [actions.getActionName("TOGGLE_MERGE_MODAL")]: (
            state,
            { payload }
        ) => {
            const newState = state.set('isOpen', !state.get('isOpen'));
            return payload
            ? newState.set('currentEditingRow', payload.row).set('confNames', payload.conf_names.join(','))
            : newState;
        }
    },
    emptyObj
);

const getSourcetypeBasicInfo = handleActions(
    {
        [actions.getResolvedActionName("GET_SOURCETYPE_BASIC_INFO$")]: (
            state,
            { payload }
        ) => {
            return state.set("basicInfo", Immutable.fromJS(payload));
        },
        [actions.getResolvedActionName("LOAD_PARSE_RESULT_FMT_TABLE$")]: (
            state,
            { payload }
        ) => {
            return state.set("result", Immutable.fromJS(payload));
        },
        [actions.getResolvedActionName("LOAD_PARSE_RESULT_FMT_KV$")]: (
            state,
            { payload }
        ) => {
            return state.set("result", Immutable.fromJS(payload));
        },
        [actions.getResolvedActionName(
            "LOAD_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: (state, { payload }) => {
            return state.set("result", Immutable.fromJS(payload));
        },
        [actions.getResolvedActionName("LOAD_PARSE_RESULT_GET_EVENT$")]: (
            state,
            { payload }
        ) => {
            return state.set("result", Immutable.fromJS(payload));
        },
        [actions.getRejectedActionName("GET_SOURCETYPE_BASIC_INFO$")]: (
            state,
            { payload }
        ) => {
            return state.set("error", payload);
        },
        [actions.getRejectedActionName("LOAD_PARSE_RESULT_FMT_TABLE$")]: (
            state,
            { payload }
        ) => {
            return state.set("error", payload);
        },
        [actions.getRejectedActionName("LOAD_PARSE_RESULT_FMT_KV$")]: (
            state,
            { payload }
        ) => {
            return state.set("error", payload);
        },
        [actions.getRejectedActionName(
            "LOAD_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: (state, { payload }) => {
            return state.set("error", payload);
        },
        [actions.getRejectedActionName("LOAD_PARSE_RESULT_GET_EVENT$")]: (
            state,
            { payload }
        ) => {
            return state.set("error", payload);
        }
    },
    emptyObj
);

const initialParseSourceTypeModalState = Immutable.Map({
    isOpen: false,
    currentSourceTypeMetadata: emptyObj,
    parsingProgress: null,
    data: {},
    error: ""
});
const clearErrorReducer = state => {
    return state.set("error", "").set("parsingProgress", null);
};
const getDataReducer = (state, { payload }) => {
    return state.set("data", payload).set("parsingProgress", null);
};
const errorReducer = (state, { payload }) => {
    return state.set("error", payload).set("parsingProgress", null);
};

const parseSourceTypeModal = handleActions(
    {
        [actions.getActionName("OPEN_MODAL")]: (state, { payload }) => {
            return state
                .set("isOpen", true)
                .set("currentSourceTypeMetadata", payload);
        },
        [actions.getActionName("CLOSE_MODAL")]: () => {
            return initialParseSourceTypeModalState;
        },
        [actions.getActionName("SET_MODAL_SOURCETYPE_FORMAT")]: (
            state,
            { payload }
        ) => {
            return state.setIn(
                ["currentSourceTypeMetadata", "data_format"],
                payload
            );
        },
        [actions.getActionName(
            "START_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: clearErrorReducer,
        [actions.getActionName(
            "CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: clearErrorReducer,
        [actions.getResolvedActionName(
            "CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: state => {
            return state.set("error", _.t("The parsing is terminated."));
        },
        [actions.getRejectedActionName(
            "CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: errorReducer,
        [actions.getActionName("SET_PARSE_PROGRESS_FMT_UNSTRUCTURED")]: (
            state,
            { payload }
        ) => {
            return state.set("parsingProgress", payload.progress);
        },
        [actions.getActionName(
            "GET_PARSE_PROGRESS_FMT_UNSTRUCTURED_ERROR"
        )]: errorReducer,
        [actions.getActionName(
            "GET_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: clearErrorReducer,
        [actions.getResolvedActionName(
            "GET_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: getDataReducer,
        [actions.getRejectedActionName(
            "GET_PARSE_RESULT_FMT_UNSTRUCTURED$"
        )]: errorReducer,
        [actions.getActionName("GET_PARSE_RESULT_FMT_KV$")]: clearErrorReducer,
        [actions.getResolvedActionName(
            "GET_PARSE_RESULT_FMT_KV$"
        )]: getDataReducer,
        [actions.getRejectedActionName(
            "GET_PARSE_RESULT_FMT_KV$"
        )]: errorReducer,
        [actions.getActionName(
            "GET_PARSE_RESULT_GET_EVENT$"
        )]: clearErrorReducer,
        [actions.getResolvedActionName(
            "GET_PARSE_RESULT_GET_EVENT$"
        )]: getDataReducer,
        [actions.getRejectedActionName(
            "GET_PARSE_RESULT_GET_EVENT$"
        )]: errorReducer,
        [actions.getActionName(
            "GET_PARSE_RESULT_FMT_TABLE$"
        )]: clearErrorReducer,
        [actions.getResolvedActionName(
            "GET_PARSE_RESULT_FMT_TABLE$"
        )]: getDataReducer,
        [actions.getRejectedActionName(
            "GET_PARSE_RESULT_FMT_TABLE$"
        )]: errorReducer
    },
    initialParseSourceTypeModalState
);

const initialDeleteSourceTypeModalState = Immutable.Map({
    isOpen: false,
    sourcetype: ""
});

const deleteSourceTypeModal = handleActions(
    {
        [actions.getActionName("OPEN_DELETE_MODAL")]: (state, { payload }) => {
            return state.set("isOpen", true).set("sourcetype", payload);
        },
        [actions.getActionName("CLOSE_DELETE_MODAL")]: state => {
            return state.set("isOpen", false);
        }
    },
    initialDeleteSourceTypeModalState
);

const tableData = generateTableReducer(actions, "masterTable");

export default {
    pendings,
    navigation,
    getSourcetypeBasicInfo,
    parseSourceTypeModal,
    deleteSourceTypeModal,
    tableData,
    mergeConfModal
};
