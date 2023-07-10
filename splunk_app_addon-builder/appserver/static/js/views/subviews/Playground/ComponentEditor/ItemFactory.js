import React from "react";
import _ from "lodash";
import Backbone from "backbone";
import BaseItem from "./items/BaseItem.jsx";
import Text from "./items/Text.jsx";
import Checkbox from "./items/Checkbox.jsx";
import DropdownList from "./items/DropdownList.jsx";
import MultiDropdownList from "./items/MultiDropdownList.jsx";
import GlobalAccount from "./items/GlobalAccount.jsx";
import Password from "./items/Password.jsx";
import RadioGroup from "./items/RadioGroup.jsx";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";

const TYPE_TO_COMPONENT = {
    text: Text,
    password: Password,
    dropdownlist: DropdownList,
    multi_dropdownlist: MultiDropdownList,
    global_account: GlobalAccount,
    radiogroup: RadioGroup,
    checkbox: Checkbox
};

const getUniqNameSuffix = function(names, defaultName, delimiter = "_") {
    let name = defaultName;
    let count = 0;
    while (_.includes(names, name)) {
        count++;
        name = `${defaultName}${delimiter}${count}`;
    }
    return count;
};

/*eslint react/prop-types: 0*/
const createComponent = function(type, props) {
    const Component = TYPE_TO_COMPONENT[type];
    return Component && <Component key={ props.name } { ...props } />;
};

const createModel = function(collection, type, options) {
    const allNames = _.uniq(
        collection.reduce((result, model) => {
            result.push(model.get("name"));
            return result;
        }, [])
    );
    const hasGlobalAccount = _.some(collection.models, model => {
        return model.get("type") === "global_account";
    });
    const Component = TYPE_TO_COMPONENT[type] || React.Component;
    // Remove useless function members on parent class
    let attrs = _.omit(
        _.cloneDeep(Component.defaultProps),
        _.keys(BaseItem.defaultProps)
    );
    if (hasGlobalAccount && type === "global_account") {
        return null;
    }
    let suffix = getUniqNameSuffix(allNames, attrs.name);
    if (suffix !== 0) {
        attrs.label = `${attrs.label} ${suffix}`;
        attrs.name = convertNameToInternalName(attrs.label);
    }
    attrs.type = type;
    attrs.format_type = type;
    const model = new Backbone.Model(attrs);
    collection.add(model, options);
    return model;
};

export { createComponent, createModel };
