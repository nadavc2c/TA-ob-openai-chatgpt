import _ from "lodash";
import { getFormattedMessage } from "app/utils/MessageUtil";

const validateRequiredGlobalCustomizedVar = customizedSettings => {
    let errors = {};
    _.each(customizedSettings, setting => {
        const hasValue =
            _.has(setting, "value") &&
            !_.isNil(setting.value) &&
            setting.value !== "";
        if (setting.required && !hasValue) {
            errors[setting.name] = getFormattedMessage(1005);
        }
    });
    return errors;
};

export { validateRequiredGlobalCustomizedVar };
