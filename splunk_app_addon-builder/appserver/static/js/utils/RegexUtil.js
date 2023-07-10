import _ from "lodash";
import Regulex from "regulex";

const GROUP_NAME_REGEX_NOESCAPE = /\(\?P?<(.*?)>/;
const GROUP_NAME_REGEX_REPLACE_NOESCAPE = /\(\?P?<(.*?)>/g;

const GROUP_NAME_VALID = /^[_a-zA-Z][_0-9a-zA-Z]*$/;

const getFields = function(regex) {
    var fields = [];
    var match = regex.match(GROUP_NAME_REGEX_NOESCAPE);
    while (match) {
        fields.push(match[1]);
        regex = regex.substring(match.index + match[0].length);
        match = regex.match(GROUP_NAME_REGEX_NOESCAPE);
    }
    return fields;
};

const escapeRegex = function(pRegex) {
    var result = pRegex.replace(GROUP_NAME_REGEX_REPLACE_NOESCAPE, "(");
    return result;
};

const matchRegex = function(text, regex, needGroupIndex) {
    if (needGroupIndex) {
        var regulex = new Regulex.RegExp(regex, "gm");
        return regulex.exec(text, true);
    } else {
        var re = new RegExp(regex, "gm");
        return text.match(re);
    }
};

const isValidRegex = function(pRegex) {
    try {
        new RegExp(escapeRegex(pRegex));
    } catch (e) {
        return false;
    }
    return true;
};

const isValidGroupName = function(name) {
    return GROUP_NAME_VALID.test(name);
};

const hasInvalidGroupName = function(regex) {
    var fields = getFields(regex);
    var deDupFields = _.uniq(fields);
    return _(deDupFields).some(field => {
        return !isValidGroupName(field);
    });
};

const hasDuplicatedGroupName = function(regex) {
    var fields = getFields(regex);
    var deDupFields = _.uniq(fields);
    return fields.length !== deDupFields.length;
};

const renameGroup = function(pRegex, oldName, newName) {
    return pRegex.replace("(?P<" + oldName + ">", "(?P<" + newName + ">");
};

const deleteGroup = function(pRegex, name) {
    return pRegex.replace("(?P<" + name + ">", "(?:");
};

const hasTooMuchGroups = function(regex) {
    var fields = getFields(regex);
    return fields.length >= 100;
};

export {
    getFields,
    escapeRegex,
    matchRegex,
    isValidRegex,
    isValidGroupName,
    hasInvalidGroupName,
    hasDuplicatedGroupName,
    renameGroup,
    deleteGroup,
    hasTooMuchGroups
};
