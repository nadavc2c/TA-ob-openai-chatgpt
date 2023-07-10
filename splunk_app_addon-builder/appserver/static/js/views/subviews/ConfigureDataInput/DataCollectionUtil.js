import _ from "lodash";
import { getFormattedMessage } from "app/utils/MessageUtil";

const INPUT_TYPES = {
    REST: "rest",
    COMMAND: "command",
    CUSTOMIZED: "customized"
};

const INPUT_CATEGORY_DISPLAY_NAMES = {
    [INPUT_TYPES.REST]: "REST",
    [INPUT_TYPES.COMMAND]: "Command",
    [INPUT_TYPES.CUSTOMIZED]: "Custom"
};

function getInputCategoryName(model) {
    var c = model.get("type") || "";
    return INPUT_CATEGORY_DISPLAY_NAMES[c] || "unknown";
}

const convertInputOptionsToParameters = inputOptions => {
    let dataInputOptions = inputOptions || [];
    let parameters = [];
    _.each(dataInputOptions, option => {
        if (option.type === "customized_var") {
            parameters.push({
                name: option.name,
                label: option.title,
                help_string: option.description,
                required: option.required_on_create,
                possible_values: option.possible_values,
                format_type: option.format_type || "text",
                default_value: option.default_value !== null
                    ? option.default_value
                    : "",
                placeholder: option.placeholder !== null
                    ? option.placeholder
                    : ""
            });
        }
    });
    return parameters;
};

const convertParametersToInputOptions = parameters => {
    let inputOptions = [];
    let varList = parameters || [];
    _.each(varList, variable => {
        inputOptions.push({
            type: "customized_var",
            name: variable.name,
            title: variable.label || "",
            description: variable.help_string || "",
            required_on_edit: false, // required_on_edit is always false
            required_on_create: variable.required || false,
            possible_values: variable.possible_values,
            format_type: variable.type,
            default_value: variable.default_value,
            placeholder: variable.placeholder
        });
    });
    return inputOptions;
};

const validateRequiredInputCustomizedVar = (
    dataInputOptions,
    customizedVarValues
) => {
    let errors = {};
    let varValues = {};
    _.each(customizedVarValues, v => {
        if (!_.isEmpty(v.value)) {
            // filter the non empty values
            varValues[v.name] = v.value;
        }
    });
    _.each(dataInputOptions, option => {
        let required = option.required_on_create || option.required_on_edit;
        if (
            option.type === "customized_var" &&
            required &&
            !_.has(varValues, option.name)
        ) {
            errors[option.name] = getFormattedMessage(1005);
        }
    });
    return errors;
};

export {
    INPUT_TYPES,
    getInputCategoryName,
    convertInputOptionsToParameters,
    convertParametersToInputOptions,
    validateRequiredInputCustomizedVar
};
