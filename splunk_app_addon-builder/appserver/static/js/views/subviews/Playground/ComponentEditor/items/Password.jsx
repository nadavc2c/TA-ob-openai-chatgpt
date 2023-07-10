import React from "react";
import _ from "lodash";
import Text from "@splunk/react-ui/Text";
import BaseItem from "./BaseItem.jsx";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";

const displayName = "Password";
export default class PasswordItem extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = _.defaults(
        {
            required: false,
            name: convertNameToInternalName(displayName),
            label: displayName,
            placeholder: "",
            default_value: "",
            help_string: ""
        },
        BaseItem.defaultProps
    );
    constructor(...args) {
        super(...args);
    }
    renderControl() {
        return (
            <Text
                value={ this.props.default_value }
                type="password"
                placeholder={ this.props.placeholder }
                onChange={ _.noop }
            />
        );
    }
}
