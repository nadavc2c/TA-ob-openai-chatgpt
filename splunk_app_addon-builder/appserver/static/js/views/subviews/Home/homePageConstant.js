import _ from "lodash";
const CREATE_BY_BUILDER = "Create by builder";
const INSTALLED_BY_USER = "Installed by Users";
const TABLE_MODE = "Table";
const CARD_MODE = "Card";
const CARDS_PER_ROW = 5;
const SORTBY_PREFIX = _.t("Sort by");
const DEFAULT_SORT = {
    sortKey: "last_modified",
    SortDir: "desc"
};
const ROWS_PER_PAGE = 10;
export {
    CREATE_BY_BUILDER,
    INSTALLED_BY_USER,
    TABLE_MODE,
    CARD_MODE,
    CARDS_PER_ROW,
    SORTBY_PREFIX,
    DEFAULT_SORT,
    ROWS_PER_PAGE
};
