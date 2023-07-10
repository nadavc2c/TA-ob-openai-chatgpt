import _ from "lodash";

const replacePattern = /[^\w]+/g;

const convertNameToInternalName = name => {
    if (name === undefined || name === null) {
        return undefined;
    }
    return _.replace(_.toLower(_.trim(name)), replacePattern, "_");
};

export { convertNameToInternalName };
