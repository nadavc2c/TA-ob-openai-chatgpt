import _ from "lodash";
import { getFormattedMessage as getMsg } from "app/utils/MessageUtil";
import { NAME_TO_LABEL as MAP } from "./Constants";

const noEmptyValidator = function() {
    return function(value, fieldName) {
        if (!value || !value.length) {
            return getMsg(10100, fieldName);
        }
        return null;
    };
};

const noExistValidator = function(valueList) {
    return function(value, fieldName) {
        let values = _.isFunction(valueList) ? valueList() : valueList;
        values = _.isArray(values) ? values : [];
        if (_.includes(values, value)) {
            return getMsg(10104, value);
        }
        return null;
    };
};

const maxLengthValidator = function(maxLength) {
    return function(value, fieldName) {
        value = value || "";
        if (value.length > maxLength) {
            return getMsg(10101, fieldName, maxLength);
        }
        return null;
    };
};

const nameValidator = function() {
    return function(value, fieldName) {
        if (!/^[a-zA-Z][0-9a-zA-Z_]*$/.test(value)) {
            return getMsg(10105, fieldName);
        }
        let msg = maxLengthValidator(50)(value, fieldName);
        if (msg) {
            return msg;
        }
        return null;
    };
};

const INPUT_RESERVED_PROPERTIES = [
    "host",
    "index",
    "source",
    "sourcetype",
    "queue",
    "_raw",
    "_meta",
    "_time",
    "_TCP_ROUTING",
    "_SYSLOG_ROUTING",
    "_INDEX_AND_FORWARD_ROUTING",
    "interval",
    "disabled",
    "url",
    "headers",
    "name",
    "output_mode",
    "output_field",
    "owner",
    "app",
    "sharing",
    "queueSize",
    "persistentQueueSize"
];
const noInputReservedNamesValidator = function() {
    return function(value, fieldName) {
        if (_.includes(INPUT_RESERVED_PROPERTIES, value)) {
            return getMsg(11011, value);
        }
        return null;
    };
};

const RESERVED_CUSTOMIZED_VAR_NAMES = [
    "disabled",
    "url",
    "headers",
    "name",
    "output_mode",
    "output_field",
    "owner",
    "app",
    "sharing"
];
const noSetupReservedNamesValidator = function() {
    return function(value, fieldName) {
        if (_.includes(RESERVED_CUSTOMIZED_VAR_NAMES, value)) {
            return getMsg(11012, value);
        }
        return null;
    };
};

const labelValidator = function() {
    return maxLengthValidator(30);
};

const placeholderValidator = function() {
    return maxLengthValidator(250);
};

const helpStringValidator = function() {
    return maxLengthValidator(200);
};

const defaultValueValidator = function() {
    return maxLengthValidator(250);
};

const OPTION_LABEL = "Option label";
const OPTION_VALUE = "Option value";
const possibleValuesValidator = function() {
    return function(value, fieldName) {
        if (!_.isArray(value) || !value.length) {
            return getMsg(10110);
        }
        let msg = null;
        for (let i = 0; i < value.length; ++i) {
            const { label: iLabel, value: iValue } = value[i];
            msg = noEmptyValidator()(iLabel, OPTION_LABEL);
            if (msg) {
                break;
            }
            msg = noEmptyValidator()(iValue, OPTION_VALUE);
            if (msg) {
                break;
            }
            msg = maxLengthValidator(50)(iValue, OPTION_VALUE);
            if (msg) {
                break;
            }
            msg = maxLengthValidator(100)(iLabel, OPTION_LABEL);
            if (msg) {
                break;
            }
        }
        if (msg) {
            return msg;
        }

        let valueMap = {};
        const iValues = _.map(value, "value");
        for (let i = 0; i < iValues.length; ++i) {
            if (valueMap[iValues[i]]) {
                return getMsg(10112);
            } else {
                valueMap[iValues[i]] = true;
            }
        }
        return null;
    };
};

const validateProps = function(defs, props) {
    let errors = {};
    _.each(defs, (validators, key) => {
        if (!_.has(props, key)) {
            return;
        }
        const value = props[key];
        for (let i = 0; i < validators.length; i++) {
            const msg = validators[i](value, MAP[key]);
            if (msg) {
                errors[key] = msg;
                break;
            }
        }
    });
    return errors;
};

export {
    noEmptyValidator,
    noExistValidator,
    maxLengthValidator,
    nameValidator,
    labelValidator,
    placeholderValidator,
    helpStringValidator,
    defaultValueValidator,
    possibleValuesValidator,
    noInputReservedNamesValidator,
    noSetupReservedNamesValidator,
    validateProps
};
