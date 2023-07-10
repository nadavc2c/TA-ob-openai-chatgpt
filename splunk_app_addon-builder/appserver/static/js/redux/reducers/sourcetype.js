import { handleActions } from "redux-actions";
import actions from "app/redux/actions/sourcetype";
import Immutable from "immutable";
import {
    generateNavigationReducers,
    generatePendingsReducers
} from "app/redux/utils";
import { generateTableReducer } from "app/redux/shared/tableReducerGenerator";

const navigation = generateNavigationReducers(actions);

const pendings = generatePendingsReducers(actions);

const emptyObj = Immutable.Map({});

const getSourcetypeBasicInfo = handleActions(
    {
        [actions.getRejectedActionName("GET_SOURCETYPE_BASIC_INFO$")]: (
            state,
            { payload }
        ) => {
            return state.set("error", payload);
        },
    },
    emptyObj
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
    deleteSourceTypeModal,
    tableData
};
