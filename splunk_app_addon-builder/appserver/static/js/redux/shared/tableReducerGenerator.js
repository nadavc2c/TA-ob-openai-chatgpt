import { handleActions } from "redux-actions";
import Immutable from "immutable";

const generateTableReducer = (actions, subActionKey) => {
    const tableInit = Immutable.fromJS({
        tableConfig: {
            map: [],
            options: {},
            rowsPerPage: 10
        },
        data: [],
        filter: {
            str: "",
            fields: new Set()
        },
        sortCondition: {
            sortKey: "",
            sortDir: ""
        },
        pageInfo: {
            currentPage: 1
        },
        isTableLoading: false
    });
    let tableActions = actions;
    if (subActionKey) tableActions = actions.getSubActions(subActionKey);
    const table = handleActions(
        {
            [tableActions.getActionName("TABLE_INIT_MAP")]: (
                state,
                { payload }
            ) => {
                const { map, rowsPerPage, options, style } = payload;
                return state.set(
                    "tableConfig",
                    Immutable.fromJS({
                        map,
                        rowsPerPage,
                        options,
                        style
                    })
                );
            },

            [tableActions.getActionName("TABLE_SET_DATA")]: (
                state,
                { payload }
            ) => {
                return state.set("data", Immutable.fromJS(payload));
            },

            [tableActions.getActionName("TABLE_DELETE_ROW")]: (
                state,
                { payload }
            ) => {
                return state.deleteIn(["data", payload]);
            },
            [tableActions.getActionName("TABLE_MODIFY_ROW")]: (
                state,
                { payload }
            ) => {
                const { rowNumber, rowData } = payload;
                return state.setIn(
                    ["data", rowNumber],
                    Immutable.fromJS(rowData)
                );
            },
            [tableActions.getActionName("TABLE_ADD_ROW")]: (
                state,
                { payload }
            ) => {
                const data = state
                    .get("data")
                    .unshift(Immutable.fromJS(payload));
                return state.set("data", Immutable.fromJS(data));
            },
            [tableActions.getActionName("TABLE_SET_FILTER")]: (
                state,
                { payload }
            ) => {
                const { str, fields } = payload;
                return state.set("filter", Immutable.fromJS({ str, fields }));
            },
            [tableActions.getActionName("TABLE_SORT_TAB")]: (
                state,
                { payload }
            ) => {
                const { sortKey } = payload;
                const sortDir = state.get("sortCondition").get("sortkey") ===
                    sortKey ||
                    state.get("sortCondition").get("sortDir") === "desc"
                    ? "asc"
                    : "desc";
                return state.set(
                    "sortCondition",
                    Immutable.Map({ sortKey, sortDir })
                );
            },
            [tableActions.getActionName("TABLE_SET_PAGE")]: (
                state,
                { payload }
            ) => {
                const { currentPage } = payload;
                return state.setIn(["pageInfo", "currentPage"], currentPage);
            },
            [tableActions.getActionName("TABLE_TOGGLE_LOADING")]: state => {
                const pre = state.get("isTableLoading");
                return state.set("isTableLoading", !pre);
            }
        },
        tableInit
    );

    return table;
};

export { generateTableReducer };
