import { createSelector } from "reselect";
import _ from "lodash";
import Immutable from "immutable";

const tableDataSelector = state =>
    state
        .get("tableData")
        .get("data")
        .map((item, id) => item.set("rowNumber", id));
const filterSelector = state => state.get("tableData").get("filter");
const sortSelectror = state => state.get("tableData").get("sortCondition");
const tableMetaSelector = state =>
    state
        .get("tableData")
        .get("pageInfo")
        .merge(state.get("tableData").get("tableConfig"));

const filteredData = createSelector(
    tableDataSelector,
    filterSelector,
    (data, filter) => {
        const fields = filter.get("fields");
        const str = filter.get("str");
        return data.filter(item => {
            if (!str) {
                return true;
            }
            return !!item.filter((val, key) => {
                return fields.has(key) && _.includes(val, str);
            }).size;
        });
    }
);

const sortedData = createSelector(filteredData, sortSelectror, (data, sort) => {
    const sortKey = sort.get("sortKey");
    const sortDir = sort.get("sortDir");
    const sortFunc = sortKey === "version"
        ? (pr, cur) => {
              const comparisonPair = _.zip(
                  pr.get("version").split("."),
                  cur.get("version").split(".")
              );
              let result = sortDir === "asc";
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
          }
        : (pre, curr) => {
              pre = pre.get(sortKey);
              curr = curr.get(sortKey);
              if (!_.isNaN(_.toNumber(pre)) && !_.isNaN(_.toNumber(curr))) {
                  pre = _.toNumber(pre);
                  curr = _.toNumber(curr);
              }
              if (sortDir === "asc") {
                  if (pre < curr) {
                      return -1;
                  }
                  if (pre > curr) {
                      return 1;
                  }
                  return 0;
              } else {
                  if (pre < curr) {
                      return 1;
                  }
                  if (pre > curr) {
                      return -1;
                  }
                  return 0;
              }
          };
    return data.sort(sortFunc);
});
const pageInfoSelectror = createSelector(
    filteredData,
    tableMetaSelector,
    (data, tableMeta) => {
        let currentPage = tableMeta.get("currentPage");
        const totalPage = Math.max(
            1,
            Math.ceil(data.size / tableMeta.get("rowsPerPage"))
        );
        currentPage = currentPage > totalPage ? currentPage - 1 : currentPage;
        return Immutable.Map({
            totalPage: totalPage,
            currentPage: Math.max(currentPage, 1),
            rowsPerPage: tableMeta.get("rowsPerPage"),
            totalRecord: data.size
        });
    }
);
const outputTableDataSelector = createSelector(
    pageInfoSelectror,
    sortedData,
    (pageInfo, data) => {
        const currentPage = pageInfo.get("currentPage");
        const rowsPerPage = pageInfo.get("rowsPerPage");
        return data.slice(
            (currentPage - 1) * rowsPerPage,
            currentPage * rowsPerPage
        );
    }
);
export { outputTableDataSelector, pageInfoSelectror };
