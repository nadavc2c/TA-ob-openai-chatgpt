import _ from 'lodash';

const typeMapToLabel = {
    alias: "FIELDALIAS",
    eval: "EVAL"
};

const TABLE_MODE = {
    VIEW: "view",
    CREATE: "create",
    UPDATE: "update"
};

// Customize splunk ui controls' styles.
const INPUT_NORMAL_STYLES = {
    border: "1px solid transparent"
};

const INPUT_FOCUSED_STYLES = {
    border: "1px solid rgba(82,168,236,.8)",
    borderRadius: "4px",
    outline: "0",
    boxShadow: "0 0 8px rgba(82,168,236,.6)"
};

const getInputContentKey = obj => {
    const type = obj.get("type");
    if (type === "alias") {
        return "input_field";
    } else if (type === "eval") {
        return "expression";
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getInputContent = obj => {
    return obj.get(getInputContentKey(obj));
};

const getInputPlaceholder = obj => {
    const type = obj.get("type");
    if (type === "alias") {
        return _.t("Enter a field name");
    } else if (type === "eval") {
        return _.t("Enter an eval expression");
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getOutputPlaceholder = obj => {
    const type = obj.get("type");
    if (type === "alias") {
        return _.t("Enter an alias name");
    } else if (type === "eval") {
        return _.t("Enter a field name");
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getActionForCreating = obj => {
    const type = obj.get("type");
    if (type === "alias") {
        return "CREATE_EVENTTYPE_ALIAS$";
    } else if (type === "eval") {
        return "CREATE_EVENTTYPE_EVAL$";
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getPayloadForCreating = (etObj, koObj) => {
    const type = koObj.get("type");
    if (type === "alias") {
        return {
            search: etObj.get("search"),
            sourcetypes: koObj.get("sourcetypes"),
            output_field: koObj.get("output_field"),
            input_field: koObj.get("input_field")
        };
    } else if (type === "eval") {
        return {
            search: etObj.get("search"),
            sourcetypes: koObj.get("sourcetypes"),
            output_field: koObj.get("output_field"),
            expression: koObj.get("expression")
        };
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getActionForUpdating = obj => {
    const type = obj.get("type");
    if (type === "alias") {
        return "UPDATE_EVENTTYPE_ALIAS$";
    } else if (type === "eval") {
        return "UPDATE_EVENTTYPE_EVAL$";
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getPayloadForUpdating = (etObj, initKoObj, koObj) => {
    const type = koObj.get("type");
    if (type === "alias") {
        return {
            search: etObj.get("search"),
            sourcetype: koObj.get("sourcetype"),
            output_field: koObj.get("output_field"),
            input_field: koObj.get("input_field"),
            old_output_field: initKoObj.get("output_field"),
            old_input_field: initKoObj.get("input_field")
        };
    } else if (type === "eval") {
        return {
            search: etObj.get("search"),
            sourcetype: koObj.get("sourcetype"),
            output_field: koObj.get("output_field"),
            expression: koObj.get("expression"),
            old_output_field: initKoObj.get("output_field"),
            old_expression: initKoObj.get("expression")
        };
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getActionForDeleting = obj => {
    const type = obj.get("type");
    if (type === "alias") {
        return "DELETE_EVENTTYPE_ALIAS$";
    } else if (type === "eval") {
        return "DELETE_EVENTTYPE_EVAL$";
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};

const getPayloadForDeleting = (etObj, koObj) => {
    const type = koObj.get("type");
    if (type === "alias") {
        return {
            search: etObj.get("search"),
            sourcetype: koObj.get("sourcetype"),
            output_field: koObj.get("output_field"),
            input_field: koObj.get("input_field")
        };
    } else if (type === "eval") {
        return {
            search: etObj.get("search"),
            sourcetype: koObj.get("sourcetype"),
            output_field: koObj.get("output_field")
        };
    } else {
        throw new Error(
            `Type: ${type} is not a valid type of knowledge object.`
        );
    }
};
export {
    typeMapToLabel,
    TABLE_MODE,
    INPUT_NORMAL_STYLES,
    INPUT_FOCUSED_STYLES,
    getInputContentKey,
    getInputContent,
    getActionForCreating,
    getPayloadForCreating,
    getActionForUpdating,
    getPayloadForUpdating,
    getActionForDeleting,
    getPayloadForDeleting,
    getInputPlaceholder,
    getOutputPlaceholder
};
