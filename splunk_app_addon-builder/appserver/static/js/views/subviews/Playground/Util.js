import _ from "lodash";
const parametersBackwardAdapter = function(parameters = []) {
    return _.map(parameters, item => {
        // To keep backward compatibility.
        switch (item.format_type) {
            case "radio":
                item.format_type = "radiogroup";
                break;
            case "dropdown":
                item.format_type = "dropdownlist";
                break;
        }
        item.type = item.format_type;
        const possible_values = item.possible_values;
        if (_.isPlainObject(possible_values)) {
            item.possible_values = _.map(possible_values, (value, key) => {
                return {
                    value: value,
                    label: key
                };
            });
        }
        return item;
    });
};

export { parametersBackwardAdapter };
