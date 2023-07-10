import _ from "lodash";

const composeSearchStatement = sourcetypes => {
    const search = _.reduce(
        sourcetypes,
        (result, sourcetype) => {
            result += `(sourcetype=${sourcetype}) OR `;
            return result;
        },
        ""
    );
    return search.substring(0, search.length - 4); //Remove the last ' OR '.
};

export { composeSearchStatement };
