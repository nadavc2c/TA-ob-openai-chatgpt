import _ from "lodash";
import { handleActions } from "redux-actions";
import Immutable from "immutable";
import actions from "app/redux/actions/cimMapping";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { SearchManager } from "swc-aob/index";
import { SplunkMvcUtils } from "swc-aob/index";
import {
    composeSearchStatement
} from "app/views/subviews/BuildCIMMapping/Util";
import {
    TABLE_MODE
} from "app/views/subviews/BuildCIMMapping/CIMMappingDetail/MappingTable/Util";

import {
    findModel,
    transformTree,
    openAllNodes
} from "app/views/subviews/BuildCIMMapping/SelectCIMModel/util";
import { generateTableReducer } from "app/redux/shared/tableReducerGenerator";
import {
    generateNavigationReducers,
    generatePendingsReducers
} from "app/redux/utils";

const navigation = generateNavigationReducers(actions);

const pendings = generatePendingsReducers(actions);

const initialSourcetypesFromConfState = Immutable.Map({
    data: [],
    error: ""
});
const sourcetypesFromConf = handleActions(
    {
        [actions.getActionName("GET_APP_SOURCETYPES_FROM_CONF$")]: () =>
            initialSourcetypesFromConfState,
        [actions.getResolvedActionName("GET_APP_SOURCETYPES_FROM_CONF$")]: (
            state,
            { payload }
        ) => state.set("data", payload),
        [actions.getRejectedActionName("GET_APP_SOURCETYPES_FROM_CONF$")]: (
            state,
            { payload }
        ) => state.set("error", payload)
    },
    initialSourcetypesFromConfState
);

const initialCurrentEventTypeInfoState = Immutable.Map({
    name: "",
    search: "",
    sourcetypes: [],
    searchID: "",
    isSearchChanged: false
});
const currentEventTypeInfo = handleActions(
    {
        [actions.getActionName("CLEAR_CURRENT_EVENTTYPE_INFO")]: () =>
            initialCurrentEventTypeInfoState,
        [actions.getActionName("SET_CURRENT_EVENTTYPE_INFO")]: (
            state,
            { payload }
        ) => {
            let newState = {
                isSearchChanged: state.get("isSearchChanged"),
                error: ""
            };
            if (payload.search) {
                newState.isSearchChanged = true;
            }
            if (!newState.isSearchChanged && payload.sourcetypes) {
                newState.search = composeSearchStatement(payload.sourcetypes);
            }
            return state.merge(Immutable.Map(payload)).merge(newState);
        },
        [actions.getActionName("START_EVENTTYPE_SEARCH")]: (
            state,
            { payload }
        ) => {
            let searchID = "";
            let manager = state.get("manager");
            if (manager) {
                manager.finalize();
            }
            if (payload) {
                searchID = `eventType_events_search${new Date().getTime()}`;
                manager = new SearchManager({
                    id: searchID,
                    earliest_time: "0",
                    latest_time: "",
                    preview: true,
                    cache: false,
                    status_buckets: 300,
                    cancelOnUnload: true,
                    app: SplunkMvcUtils.getCurrentApp(),
                    auto_cancel: 90,
                    runWhenTimeIsUndefined: false,
                    search: `index=* ${payload} | head 5000`
                });
                manager.startSearch();
            }
            return state.merge({
                searchID: searchID,
                manager: manager
            });
        },
        [actions.getActionName("CREATE_EVENTTYPE$")]: state =>
            state.set("error", ""),
        [actions.getActionName("UPDATE_EVENTTYPE$")]: state =>
            state.set("error", ""),
        [actions.getActionName("CLEAR_ERROR")]: state => state.set("error", ""),
        [actions.getRejectedActionName("CREATE_EVENTTYPE$")]: (
            state,
            { payload }
        ) => state.set("error", payload),
        [actions.getRejectedActionName("UPDATE_EVENTTYPE$")]: (
            state,
            { payload }
        ) => state.set("error", payload)
    },
    initialCurrentEventTypeInfoState
);

const initialCurrentEventTypeInfoErrorState = Immutable.Map({
    name: "",
    search: "",
    sourcetypes: "",
    searchID: ""
});
const currentEventTypeInfoError = handleActions(
    {
        [actions.getActionName("SET_CURRENT_EVENTTYPE_INFO")]: (
            state,
            { payload }
        ) => {
            let newState = {};
            if (payload) {
                if (_.has(payload, "name")) {
                    if (!payload.name.length) {
                        newState.name = getFormattedMessage(5009);
                    } else if (!/^\w+$/.test(payload.name)) {
                        newState.name = getFormattedMessage(5008);
                    } else {
                        newState.name = "";
                    }
                }
                if (_.has(payload, "sourcetypes")) {
                    if (!payload.sourcetypes.length) {
                        newState.sourcetypes = getFormattedMessage(5002);
                    } else {
                        newState.sourcetypes = "";
                    }
                }
            }

            return state.merge(newState);
        },
        [actions.getActionName("CREATE_EVENTTYPE$")]: () =>
            initialCurrentEventTypeInfoErrorState,
        [actions.getActionName("CLEAR_ERROR")]: () =>
            initialCurrentEventTypeInfoErrorState
    },
    initialCurrentEventTypeInfoErrorState
);

const initialEventTypeFieldValuesState = Immutable.fromJS({
    data: [],
    eventtypeFieldsFilterString: "",
    error: ""
});
const handleKnowledgeObjectsChange = (state, { payload }) => {
    let changes = payload.fieldValueChanges;
    if (!changes) {
        return state;
    }
    let data = state.get("data");
    _.each(_.castArray(changes), change => {
        if (!change.name) return;
        const index = data.findIndex(item => {
            return item.name === change.name;
        });
        if (index > -1) {
            let isRemove = false;
            if (!change.values) isRemove = true;
            if (isRemove) {
                data = data.remove(index);
            } else {
                data = data.set(index, change);
            }
        } else if (change.values) {
            const lastIndex = data.findLastKey(val => {
                return val.name <= change.name;
            });
            data = data.insert(lastIndex + 1, change);
        }
    });
    return state.withMutations(state => state.set("data", data));
};
const eventTypeFieldValues = handleActions(
    {
        [actions.getActionName("GET_EVENTTYPE_FIELD_VALUES$")]: () =>
            initialEventTypeFieldValuesState,
        [actions.getResolvedActionName("GET_EVENTTYPE_FIELD_VALUES$")]: (
            state,
            { payload }
        ) => {
            const content = Immutable.List(payload);
            return state.withMutations(state => state.set("data", content));
        },
        [actions.getActionName("FILTER_EVENTTYPE_FIELD_VALUES")]: (
            state,
            { payload }
        ) => state.set("eventtypeFieldsFilterString", payload),
        [actions.getRejectedActionName("GET_EVENTTYPE_FIELD_VALUES$")]: (
            state,
            { payload }
        ) => state.set("error", payload),
        [actions.getResolvedActionName(
            "CREATE_EVENTTYPE_ALIAS$"
        )]: handleKnowledgeObjectsChange,
        [actions.getResolvedActionName(
            "UPDATE_EVENTTYPE_ALIAS$"
        )]: handleKnowledgeObjectsChange,
        [actions.getResolvedActionName(
            "DELETE_EVENTTYPE_ALIAS$"
        )]: handleKnowledgeObjectsChange,
        [actions.getResolvedActionName(
            "CREATE_EVENTTYPE_EVAL$"
        )]: handleKnowledgeObjectsChange,
        [actions.getResolvedActionName(
            "UPDATE_EVENTTYPE_EVAL$"
        )]: handleKnowledgeObjectsChange,
        [actions.getResolvedActionName(
            "DELETE_EVENTTYPE_EVAL$"
        )]: handleKnowledgeObjectsChange
    },
    initialEventTypeFieldValuesState
);

const initialEventTypeKnowledgeObjectsState = Immutable.fromJS({
    data: [],
    error: "",
    mode: TABLE_MODE.VIEW
});
const eventTypeKnowledgeObjects = handleActions(
    {
        [actions.getActionName("SET_EVENTTYPE_MAPPING_TABLE_MODE")]: (
            state,
            { payload }
        ) => state.set("mode", payload),
        [actions.getActionName("GET_EVENTTYPE_KNOWLEDGE_OBJECTS$")]: () =>
            initialEventTypeKnowledgeObjectsState,
        [actions.getResolvedActionName("GET_EVENTTYPE_KNOWLEDGE_OBJECTS$")]: (
            state,
            { payload }
        ) => state.set("data", Immutable.fromJS(payload)),
        [actions.getRejectedActionName("GET_EVENTTYPE_KNOWLEDGE_OBJECTS$")]: (
            state,
            { payload }
        ) => state.set("error", payload),
        [actions.getResolvedActionName("CREATE_EVENTTYPE_ALIAS$")]: (
            state,
            { payload }
        ) => {
            const koObj = payload.knowledgeObjectInfo;
            let data = state.get("data");
            _.each(koObj.sourcetypes, sourcetype => {
                data = data.unshift(
                    Immutable.Map({
                        sourcetype: sourcetype,
                        type: "alias",
                        output_field: koObj.output_field,
                        input_field: koObj.input_field
                    })
                );
            });
            return state.set("data", data);
        },
        [actions.getResolvedActionName("UPDATE_EVENTTYPE_ALIAS$")]: (
            state,
            { payload }
        ) => {
            const koObj = payload.knowledgeObjectInfo;
            let data = state.get("data");
            return state.set(
                "data",
                data.set(
                    koObj.index,
                    Immutable.Map({
                        sourcetype: koObj.sourcetype,
                        type: "alias",
                        output_field: koObj.output_field,
                        input_field: koObj.input_field
                    })
                )
            );
        },
        [actions.getResolvedActionName("DELETE_EVENTTYPE_ALIAS$")]: (
            state,
            { payload }
        ) => {
            const koObj = payload.knowledgeObjectInfo;
            let data = state.get("data");
            return state.set("data", data.remove(koObj.index));
        },
        [actions.getResolvedActionName("CREATE_EVENTTYPE_EVAL$")]: (
            state,
            { payload }
        ) => {
            const koObj = payload.knowledgeObjectInfo;
            let data = state.get("data");
            _.each(koObj.sourcetypes, sourcetype => {
                data = data.unshift(
                    Immutable.Map({
                        sourcetype: sourcetype,
                        type: "eval",
                        output_field: koObj.output_field,
                        expression: koObj.expression
                    })
                );
            });
            return state.set("data", data);
        },
        [actions.getResolvedActionName("UPDATE_EVENTTYPE_EVAL$")]: (
            state,
            { payload }
        ) => {
            const koObj = payload.knowledgeObjectInfo;
            let data = state.get("data");
            return state.set(
                "data",
                data.set(
                    koObj.index,
                    Immutable.Map({
                        sourcetype: koObj.sourcetype,
                        type: "eval",
                        output_field: koObj.output_field,
                        expression: koObj.expression
                    })
                )
            );
        },
        [actions.getResolvedActionName("DELETE_EVENTTYPE_EVAL$")]: (
            state,
            { payload }
        ) => {
            const koObj = payload.knowledgeObjectInfo;
            let data = state.get("data");
            return state.set("data", data.remove(koObj.index));
        }
    },
    initialEventTypeKnowledgeObjectsState
);

const quoteWhenSpace = (input, quote) => {
    if (input.indexOf(" ") < 0) {
        return input;
    } else {
        let ret = _.replace(input, quote, "\\" + quote);
        return quote + ret + quote;
    }
};

const singleQuoteWhenSpace = input => {
    return quoteWhenSpace(input, "'");
};

const doubleQuoteWhenSpace = input => {
    return quoteWhenSpace(input, '"');
};

const initialCurrentKnowledgeObjectForCreatingState = Immutable.Map({
    output_field: "",
    input_field: "",
    sourcetypes: [],
    type: "",
    expression: "",
    highlight_output: false,
    highlight_input: false
});
const currentKnowLedgeObjectForCreating = handleActions(
    {
        [actions.getActionName(
            "CLEAR_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING"
        )]: () => initialCurrentKnowledgeObjectForCreatingState,
        [actions.getActionName("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING")]: (
            state,
            { payload }
        ) => state.merge(Immutable.Map(payload)),
        [actions.getActionName("SET_MAPPING_TABLE_HIGHLIGHT_OUTPUT")]: (
            state,
            { payload }
        ) => state.set("highlight_output", payload),
        [actions.getActionName("SET_MAPPING_TABLE_HIGHLIGHT_INPUT")]: (
            state,
            { payload }
        ) => state.set("highlight_input", payload),
        [actions.getActionName("APPEND_MAPPING_TABLE_CIM_FIELD")]: (
            state,
            { payload }
        ) => {
            return state.set("output_field", payload);
        },
        [actions.getActionName("APPEND_MAPPING_TABLE_EVENT_TYPE_FIELD")]: (
            state,
            { payload }
        ) => {
            const type = state.get("type");
            if (type === "eval") {
                return state.set(
                    "expression",
                    state.get("expression") + singleQuoteWhenSpace(payload)
                );
            } else if (type === "alias") {
                return state.set("input_field", doubleQuoteWhenSpace(payload));
            }
        },
        [actions.getActionName("CREATE_EVENTTYPE_EVAL$")]: state =>
            state.set("error", ""),
        [actions.getActionName("CREATE_EVENTTYPE_ALIAS$")]: state =>
            state.set("error", ""),
        [actions.getActionName("CLEAR_ERROR")]: state => state.set("error", ""),
        [actions.getRejectedActionName("CREATE_EVENTTYPE_EVAL$")]: (
            state,
            { payload }
        ) => state.set("error", payload),
        [actions.getRejectedActionName("CREATE_EVENTTYPE_ALIAS$")]: (
            state,
            { payload }
        ) => state.set("error", payload)
    },
    initialCurrentKnowledgeObjectForCreatingState
);

const initialCurrentKnowledgeObjectForUpdatingState = Immutable.Map({
    output_field: "",
    input_field: "",
    sourcetype: "",
    type: "",
    expression: "",
    highlight_output: false,
    highlight_input: false
});

const currentKnowLedgeObjectForUpdating = handleActions(
    {
        [actions.getActionName(
            "CLEAR_CURRENT_KNOWLEDGE_OBJECT_FOR_UPDATING"
        )]: () => initialCurrentKnowledgeObjectForUpdatingState,
        [actions.getActionName("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_UPDATING")]: (
            state,
            { payload }
        ) => state.merge(Immutable.Map(payload)),
        [actions.getActionName("SET_MAPPING_TABLE_HIGHLIGHT_OUTPUT")]: (
            state,
            { payload }
        ) => state.set("highlight_output", payload),
        [actions.getActionName("SET_MAPPING_TABLE_HIGHLIGHT_INPUT")]: (
            state,
            { payload }
        ) => state.set("highlight_input", payload),
        [actions.getActionName("APPEND_MAPPING_TABLE_CIM_FIELD")]: (
            state,
            { payload }
        ) => {
            return state.set("output_field", payload);
        },
        [actions.getActionName("APPEND_MAPPING_TABLE_EVENT_TYPE_FIELD")]: (
            state,
            { payload }
        ) => {
            const type = state.get("type");
            if (type === "eval") {
                return state.set(
                    "expression",
                    state.get("expression") + singleQuoteWhenSpace(payload)
                );
            } else if (type === "alias") {
                return state.set("input_field", doubleQuoteWhenSpace(payload));
            }
        },
        [actions.getActionName("UPDATE_EVENTTYPE_EVAL$")]: state =>
            state.set("error", ""),
        [actions.getActionName("UPDATE_EVENTTYPE_ALIAS$")]: state =>
            state.set("error", ""),
        [actions.getActionName("CLEAR_ERROR")]: state => state.set("error", ""),
        [actions.getRejectedActionName("UPDATE_EVENTTYPE_EVAL$")]: (
            state,
            { payload }
        ) => state.set("error", payload),
        [actions.getRejectedActionName("UPDATE_EVENTTYPE_ALIAS$")]: (
            state,
            { payload }
        ) => state.set("error", payload)
    },
    initialCurrentKnowledgeObjectForUpdatingState
);

const emptyObj = Immutable.Map({});
let treeInitalState = {
    nodeActivitionStatus: { root: true },
    treeData: {},
    existingModel: {},
    combinedModel: {},
    searchString: "",
    modelFieldsFilterString: ""
};

const cimModelTree = handleActions(
    {
        [actions.getActionName("SET_TREE_STATE")]: (state, action) => {
            const key = action.payload.key;
            const value =
                action.payload.value ||
                !state.get("nodeActivitionStatus").get(key);
            return state.setIn(["nodeActivitionStatus", key], value);
        },
        [actions.getActionName("CLEAR_TREE_STATE")]: state =>
            state.set("nodeActivitionStatus", Immutable.fromJS({ root: true })),
        [actions.getActionName("ACTIVATE_ALL_TREE_STATE")]: state =>
            state.set(
                "nodeActivitionStatus",
                openAllNodes(state.get("treeData"))
            ),
        [actions.getResolvedActionName("GET_TREE_DATA$")]: (state, action) => {
            const rowTree = Immutable.fromJS(action.payload["root"] || {});
            return state.set("treeData", transformTree(rowTree, ""));
        },
        [actions.getActionName("SET_MODEL_FILTER")]: (state, action) =>
            state.set("searchString", action.payload),
        [actions.getActionName("TOGGLE_MODEL_CANDIDATE")]: (state, action) => {
            if (state.get("combinedModel").get(action.payload.level)) {
                return state.deleteIn(["combinedModel", action.payload.level]);
            } else {
                return state.setIn(
                    ["combinedModel", action.payload.level],
                    action.payload.obj
                );
            }
        },
        [actions.getActionName("SET_MODEL_CANDIDATE")]: (state, action) => {
            const obj = findModel(state.get("treeData"), action.payload);
            return state.withMutations(state =>
                state.set("combinedModel", obj).set("existingModel", obj)
            );
        },
        [actions.getResolvedActionName("SAVE_SELECTED_CIM_MODEL$")]: state => {
            const obj = state.get("combinedModel");
            return state.withMutations(state =>
                state.set("combinedModel", obj).set("existingModel", obj)
            );
        },
        [actions.getActionName("FILTER_SELECTED_CIM_MODEL")]: (
            state,
            { payload }
        ) => state.set("modelFieldsFilterString", payload),
        [actions.getActionName("CLEAR_MODEL_CANDIDATE")]: state =>
            state.set("combinedModel", state.get("existingModel"))
    },
    Immutable.fromJS(treeInitalState)
);

const cimModelTreeError = handleActions(
    {
        [actions.getActionName("SAVE_SELECTED_CIM_MODEL$")]: state =>
            state.delete("SAVE_SELECTED_CIM_MODEL$"),

        [actions.getActionName("GET_TREE_DATA$")]: state =>
            state.delete("GET_TREE_DATA$"),

        [actions.getActionName("GET_EVENTTYPE_INFO$")]: state =>
            state.delete("GET_EVENTTYPE_INFO$"),

        [actions.getRejectedActionName("SAVE_SELECTED_CIM_MODEL$")]: (
            state,
            { payload }
        ) => state.set("SAVE_SELECTED_CIM_MODEL$", payload),

        [actions.getRejectedActionName("GET_TREE_DATA$")]: (
            state,
            { payload }
        ) => state.set("GET_TREE_DATA$", payload),

        [actions.getRejectedActionName("GET_EVENTTYPE_INFO$")]: (
            state,
            { payload }
        ) => state.set("GET_EVENTTYPE_INFO$", payload)
    },
    emptyObj
);

const tableData = generateTableReducer(actions, "masterTable");

export default {
    navigation,
    pendings,
    sourcetypesFromConf,
    currentEventTypeInfo,
    currentEventTypeInfoError,
    eventTypeFieldValues,
    eventTypeKnowledgeObjects,
    currentKnowLedgeObjectForCreating,
    currentKnowLedgeObjectForUpdating,
    cimModelTree,
    cimModelTreeError,
    tableData
};
