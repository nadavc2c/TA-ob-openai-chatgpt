import _ from "lodash";
import Immutable from "immutable";
import StoreBase from "app/views/flux/StoreBase";
import { internal } from "app/utils/privateVaribleUtil";

const ACTION_MAP = {
    GET_DATA: "setTableData",
    SET_FILTER: "setFilter",
    SORT_TAB: "sortTable",
    DELETE_ITEM: "deleteItem",
    MODIFY_ROW: "modifyRow",
    ADD_NEW: "addNewElem",
    FILTER_AUTHOR_NAME: "searchNameAuthor",
    SET_PAGE: "setPage",
    TOGGLE_CHECKBOX: "toggleSelectBox",
    ADD_DELETE_CANDIDATE: "toggleDeleteCandidate",
    RESET_DELETE_CANDIDATE: "resetDeleteCandidate",
    BULK_DELETE: "bulkDelete",
    SET_ROWS_PER_PAGE: "setRowsPerPage",
    SET_GENERAL_MESSAGE: "setGeneralMessage",
    TOGGLE_LOADING_TABLE: "toggleLoadingTable"
};
class StoreAction {
    constructor(tabM) {
        this.emitter = new StoreBase();
        internal(this, tabM); //init
        this.getProps = {
            getDeleteCandidate: function() {
                return tabM._deleteCandidate;
            },
            getPage: function() {
                return [tabM._prePage, tabM._currentPage, tabM._totalPage];
            },
            getData: function() {
                return tabM._output.slice(
                    tabM._prePage * tabM._rowsPerPage,
                    tabM._currentPage * tabM._rowsPerPage
                );
            },
            checkboxStatus: function() {
                return tabM._isCheckboxHidden;
            },
            getSortKey: function() {
                return tabM._sortKey;
            },
            getGeneralMessage: function() {
                return tabM._generalMessage;
            },
            getLoadingStatus: function() {
                return tabM._isLoading;
            }
        };
    }
    getViewData() {
        return {
            data: this.getProps.getData(),
            pageInfo: this.getProps.getPage(),
            checkboxStatus: this.getProps.checkboxStatus(),
            deleteCandidate: this.getProps.getDeleteCandidate(),
            generalMessage: this.getProps.getGeneralMessage(),
            isLoading: this.getProps.getLoadingStatus()
        };
    }
    setTableData(data) {
        let tabM = internal(this);
        tabM._Data = Immutable.fromJS(data);
        tabM._output = tabM._Data;
        tabM._prePage = 0;
        tabM._currentPage = 1;
        tabM._totalPage = Math.max(
            Math.ceil(tabM._output.size / tabM._rowsPerPage),
            1
        );

        return this.getViewData();
    }
    setFilter(key, searchStr) {
        let tabM = internal(this);
        tabM._output = tabM._Data.filter(function(elem) {
            return _.includes(elem.get(key), searchStr);
        });
        tabM._totalPage = Math.ceil(tabM._output.size / tabM._rowsPerPage);
        tabM._currentPage = 1;
        tabM._prePage = 0;
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            ),
            pageInfo: tabM._prePage
        };
    }
    sortTable(key, direction) {
        let sortFunction = function(pr, cur) {
            if (direction === "asc") {
                return pr.get(key) < cur.get(key) ? -1 : 1;
            } else {
                return pr.get(key) > cur.get(key) ? -1 : 1;
            }
        };
        if (key === "version") {
            sortFunction = function(pr, cur) {
                const comparisonPair = _.zip(
                    pr.get(key).split("."),
                    cur.get(key).split(".")
                );
                let result = direction === "asc";
                _.each(comparisonPair, cur => {
                    const preVal = _.isUndefined(cur[0])
                        ? -1
                        : _.isNaN(+cur[0]) ? Number.MAX_VALUE : +cur[0];

                    const currVal = _.isUndefined(cur[1])
                        ? -1
                        : _.isNaN(+cur[1]) ? Number.MAX_VALUE : +cur[1];

                    if (cur[0] !== cur[1]) {
                        result = preVal < currVal ? result : !result;
                        return false;
                    }
                });
                return result ? -1 : 1;
            };
        }
        let tabM = internal(this);
        tabM._sortKey = key;
        tabM._output = tabM._output.sort(sortFunction);
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            ),
            sortkey: tabM._sortKey
        };
    }
    deleteItem(id, key = "id") {
        let tabM = internal(this);
        tabM._Data = tabM._Data.filter(function(elem) {
            return !(elem.get(key) === id);
        });

        tabM._output = tabM._output.filter(function(elem) {
            return !(elem.get(key) === id);
        });

        tabM._totalPage = Math.max(
            Math.ceil(tabM._output.size / tabM._rowsPerPage),
            1
        );

        if (tabM._totalPage < tabM._currentPage) {
            tabM._currentPage === 1 ? tabM._currentPage : tabM._currentPage--;
            tabM._prePage = tabM._currentPage - 1;
        }

        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            ),
            pageInfo: [tabM._prePage, tabM._currentPage, tabM._totalPage]
        };
    }
    modifyRow(elemIn, key = "id") {
        let tabM = internal(this);
        tabM._Data = tabM._Data.map(function(elem) {
            if (elem.get(key) === elemIn.previousProjectName) {
                elem = elem.set("author", elemIn.projectAuthor);
                elem = elem.set("name", elemIn.friendlyName);
                elem = elem.set("version", elemIn.projectVersion);
                elem = elem.set(
                    key,
                    elemIn.projectNamePrefix + elemIn.projectName
                );
            }
            return elem;
        });
        tabM._output = tabM._Data;
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            )
        };
    }
    addNewElem(elem) {
        let tabM = internal(this);
        _.assign(elem, {
            create_by_builder: true
        });
        tabM._Data = tabM._Data.push(Immutable.fromJS(elem));
        tabM._output = tabM._Data;
        const newTotalPage = Math.ceil(tabM._output.size / tabM._rowsPerPage);
        if (newTotalPage > tabM._totalPage) {
            tabM._totalPage = newTotalPage;
            tabM._prePage++;
            tabM._currentPage++;
        }
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            ),
            pageInfo: [tabM._prePage, tabM._currentPage, tabM._totalPage]
        };
    }
    searchNameAuthor(searchStr) {
        let tabM = internal(this);
        let matchedPattern = new RegExp(searchStr, "i");
        tabM._output = tabM._Data.filter(function(elem) {
            return (
                elem.get("name").match(matchedPattern) ||
                elem.get("author").match(matchedPattern)
            );
        });
        tabM._totalPage = Math.ceil(tabM._output.size / tabM._rowsPerPage);
        tabM._currentPage = 1;
        tabM._prePage = 0;
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            )
        };
    }
    setPage(page) {
        let tabM = internal(this);
        tabM._prePage = page;
        tabM._currentPage = page + 1;
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            )
        };
    }
    toggleSelectBox() {
        let tabM = internal(this);
        tabM._isCheckboxHidden = !tabM._isCheckboxHidden;
        return { checkboxStatus: tabM._isCheckboxHidden };
    }
    toggleDeleteCandidate(id) {
        let tabM = internal(this);
        if (tabM._deleteCandidate.has(id)) {
            tabM._deleteCandidate.delete(id);
        } else {
            tabM._deleteCandidate.add(id);
        }
        return { deleteCandidate: tabM._deleteCandidate };
    }
    resetDeleteCandidate() {
        let tabM = internal(this);
        tabM._deleteCandidate = new Set();
    }
    bulkDelete() {
        let tabM = internal(this);
        tabM._Data = tabM._Data.filter(function(elem) {
            return !tabM._deleteCandidate.has(elem.get("id"));
        });
        tabM._output = tabM._output.filter(function(elem) {
            return !tabM._deleteCandidate.has(elem.get("id"));
        });
        tabM._deleteCandidate = new Set();
        tabM._totalPage = Math.max(
            Math.ceil(tabM._output.size / tabM._rowsPerPage),
            1
        );

        if (tabM._totalPage < tabM._currentPage) {
            tabM._currentPage === 1 ? tabM._currentPage : tabM._currentPage--;
            tabM._prePage = tabM._currentPage - 1;
        }
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            ),
            pageInfo: [tabM._prePage, tabM._currentPage, tabM._totalPage]
        };
    }
    setRowsPerPage(pp) {
        let tabM = internal(this);
        tabM._prePage = 0;
        tabM._currentPage = 1;
        tabM._rowsPerPage = pp;
        tabM._totalPage = Math.ceil(tabM._output.size / tabM._rowsPerPage);
        return {
            data: tabM._output.slice(
                tabM._prePage * tabM._rowsPerPage,
                tabM._currentPage * tabM._rowsPerPage
            ),
            pageInfo: [tabM._prePage, tabM._currentPage, tabM._totalPage]
        };
    }
    setGeneralMessage(message) {
        let tabM = internal(this);
        tabM._generalMessage = message;
        return {
            generalMessage: tabM._generalMessage
        };
    }

    toggleLoadingTable(message) {
        let tabM = internal(this);
        tabM._isLoading.status = !tabM._isLoading.status;
        tabM._isLoading.loadingText = message;
        return {
            isLoading: tabM._isLoading
        };
    }
}

StoreAction.prototype.ACTION_MAP = ACTION_MAP;

export default StoreAction;
