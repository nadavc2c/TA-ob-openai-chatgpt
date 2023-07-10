import _ from "lodash";
let storage = window.localStorage;

function createOrGet(namespace) {
    if (!storage.getItem(namespace)) {
        storage.setItem(namespace, JSON.stringify({}));
    }
    return JSON.parse(storage.getItem(namespace));
}

function set(namespace, obj) {
    storage.setItem(namespace, JSON.stringify(obj));
}

const VALIDATE_CATEGORIES_NAMESPACE = "_validate_categories";

const setValidateCategories = function(categories) {
    set(VALIDATE_CATEGORIES_NAMESPACE, categories);
};

const hasValidateCategories = function() {
    let validateCategories = createOrGet(VALIDATE_CATEGORIES_NAMESPACE);
    return JSON.stringify(validateCategories) !== JSON.stringify({});
};

const getValidateCategories = function() {
    if (!hasValidateCategories()) {
        return null;
    }
    return createOrGet(VALIDATE_CATEGORIES_NAMESPACE);
};

const clearValidateCategories = function() {
    set(VALIDATE_CATEGORIES_NAMESPACE, {});
};

//remember homepage last choice
const LAST_SELECTED_HOMEPAGE_TAB = "_homepage_lastchoice";
const SHOW_MODE = "showMode";
const TAB_STATE = "showType";
const setHomepageChoice = function(tabState) {
    let lastChoiceInfos = createOrGet(LAST_SELECTED_HOMEPAGE_TAB);
    lastChoiceInfos[SHOW_MODE] = tabState[SHOW_MODE];
    lastChoiceInfos[TAB_STATE] = tabState[TAB_STATE];
    set(LAST_SELECTED_HOMEPAGE_TAB, lastChoiceInfos);
};

const getHomepageChoice = function() {
    let lastChoiceInfos = createOrGet(LAST_SELECTED_HOMEPAGE_TAB);
    if (_.isEmpty(lastChoiceInfos)) {
        return null;
    }
    return lastChoiceInfos;
};

// remember sort last choice
const LAST_SORT_CHOICE = "_sort_lastchoice";
const DEFAULT_SORT = {
    sortKey: "last_modified",
    SortDir: "desc"
};
const setSortChoice = function(sortChoice) {
    let lastSortChoiceInfos = createOrGet(LAST_SORT_CHOICE);
    lastSortChoiceInfos = sortChoice;
    set(LAST_SORT_CHOICE, lastSortChoiceInfos);
};
const getSortChoice = function() {
    let lastSortChoiceInfos = createOrGet(LAST_SORT_CHOICE);
    if (_.isEmpty(lastSortChoiceInfos)) {
        return DEFAULT_SORT;
    }
    return lastSortChoiceInfos;
};

export {
    setValidateCategories,
    hasValidateCategories,
    getValidateCategories,
    clearValidateCategories,
    setHomepageChoice,
    getHomepageChoice,
    setSortChoice,
    getSortChoice
};
