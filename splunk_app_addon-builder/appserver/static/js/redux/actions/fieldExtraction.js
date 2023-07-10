import Actions from "app/redux/templateClass/Actions";
import { TABLE_ACTIONS } from "app/redux/shared/TableActions";
let fieldExtractionActions = new Actions("fe");

fieldExtractionActions.addActions([
    "SET_NAVIGATION",
    "CLEAR_EPIC_STATUS",
    "LOAD_PARSE_RESULT",
    "GET_PARSE_PROGRESS_FMT_UNSTRUCTURED",
    "GET_PARSE_PROGRESS_FMT_UNSTRUCTURED_ERROR",
    "SET_PARSE_PROGRESS_FMT_UNSTRUCTURED",
    "OPEN_MODAL",
    "CLOSE_MODAL",
    "SET_MODAL_SOURCETYPE_FORMAT",
    "OPEN_DELETE_MODAL",
    "CLOSE_DELETE_MODAL",
    "TOGGLE_MERGE_MODAL"
]);

fieldExtractionActions.getSubActions("masterTable").addActions(TABLE_ACTIONS);

fieldExtractionActions.addAsyncActions([
    "GET_SOURCETYPE_BASIC_INFO$",
    "GET_PARSE_RESULT_FMT_UNSTRUCTURED$",
    "START_PARSE_RESULT_FMT_UNSTRUCTURED$",
    "CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$",
    "GET_PARSE_RESULT_FMT_KV$",
    "GET_PARSE_RESULT_GET_EVENT$",
    "GET_PARSE_RESULT_FMT_TABLE$",
    "LOAD_PARSE_RESULT_GET_EVENT$",
    "LOAD_PARSE_RESULT_FMT_KV$",
    "LOAD_PARSE_RESULT_FMT_TABLE$",
    "LOAD_PARSE_RESULT_FMT_UNSTRUCTURED$",
    "CLEAR_FIELD_EXTRACTION$",
    "CHECK_FE_AVAILABLE$",
    "MERGE_CONF$"
]);

export default fieldExtractionActions;
