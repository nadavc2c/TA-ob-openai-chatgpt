import { createSelector } from "reselect";
import _ from "lodash";
import {
    selectTreeBranch
} from "app/views/subviews/BuildCIMMapping/SelectCIMModel/util";

const getCimTree = state => state.get("cimModelTree").get("treeData");
const getSearchString = state => state.get("cimModelTree").get("searchString");

const getSelectedCimModel = state =>
    state.get("cimModelTree").get("combinedModel");
const filterSelectedModelFilter = state =>
    state.get("cimModelTree").get("modelFieldsFilterString");

const getEventtypeFields = state =>
    state.get("eventTypeFieldValues").get("data");
const getEventtypeFieldsFilterString = state =>
    state.get("eventTypeFieldValues").get("eventtypeFieldsFilterString");

const filteredTree = createSelector(
    getCimTree,
    getSearchString,
    (data, filter) => {
        return selectTreeBranch(data, filter);
    }
);

const filteredSelectedModel = createSelector(
    getSelectedCimModel,
    filterSelectedModelFilter,
    (data, filter) => {
        const filteredData = data.map(elem => {
            const flteredList = elem
                .get("fields")
                .filter(value => _.includes(value.get("name"), filter));
            return elem.set("fields", flteredList);
        });
        return filteredData;
    }
);

const filteredEventtypeFields = createSelector(
    getEventtypeFields,
    getEventtypeFieldsFilterString,
    (data, filter) => {
        return data.filter(value => _.includes(value.name, filter));
    }
);

export { filteredTree, filteredSelectedModel, filteredEventtypeFields };
