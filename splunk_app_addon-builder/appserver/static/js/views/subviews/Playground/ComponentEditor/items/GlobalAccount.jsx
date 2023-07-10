import React from "react";
import _ from "lodash";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";
import BaseItem from "./BaseItem.jsx";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";

const displayName = "Global Account";
export default class GlobalAccount extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = _.defaults(
        {
            required: true,
            name: convertNameToInternalName(displayName),
            label: displayName,
            default_value: "",
            placeholder: "",
            help_string: "",
            possible_values: []
        },
        BaseItem.defaultProps
    );
    constructor(...args) {
        super(...args);
    }
    renderControl() {
        return (
            <SingleSelectControl
                value={ this.props.default_value }
                items={ this.props.possible_values }
                placeholder={ this.props.placeholder }
            />
        );
    }
}
