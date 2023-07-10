import Actions from "app/redux/templateClass/Actions";
import { TABLE_ACTIONS } from "app/redux/shared/TableActions";
let sourcetypeActions = new Actions("st");

sourcetypeActions.addActions([
    "SET_NAVIGATION",
    "CLEAR_EPIC_STATUS",
    "OPEN_DELETE_MODAL",
    "CLOSE_DELETE_MODAL"
]);

sourcetypeActions.getSubActions("masterTable").addActions(TABLE_ACTIONS);

sourcetypeActions.addAsyncActions([
    "GET_SOURCETYPE_BASIC_INFO$",
    "DELETE_SOURCETYPE$"
]);

export default sourcetypeActions;
