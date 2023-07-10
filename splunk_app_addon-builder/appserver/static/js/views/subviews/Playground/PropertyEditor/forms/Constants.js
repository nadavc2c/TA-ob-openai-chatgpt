import _ from "lodash";

const NAME_TO_LABEL = {
    label: _.t("Display label"),
    name: _.t("Internal name"),
    placeholder: _.t("Default display text"),
    default_value: _.t("Default value"),
    help_string: _.t("Help text"),
    required: _.t("Required"),
    possible_values: _.t("Options")
};

const IS_NAME_CHANGED = "is_internal_name_changed";

export { NAME_TO_LABEL, IS_NAME_CHANGED };
