import React from "react";
import _ from "lodash";
import MultiSelectControl from "app/components/controls/MultiSelectControl.jsx";
import BaseItem from "./BaseItem.jsx";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";

const displayName = "Multiple Dropdown";
export default class MultiDropdownList extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = _.defaults(
        {
            required: false,
            name: convertNameToInternalName(displayName),
            label: displayName,
            default_value: [],
            help_string: "",
            placeholder: "",
            possible_values: [
                {
                    value: "option1",
                    label: "Option1"
                },
                {
                    value: "option2",
                    label: "Option2"
                },
                {
                    value: "option3",
                    label: "Option3"
                }
            ]
        },
        BaseItem.defaultProps
    );
    constructor(...args) {
        super(...args);
    }
    renderControl() {
        return (
            <MultiSelectControl
                value={ this.props.default_value }
                items={ this.props.possible_values }
                placeholder={ this.props.placeholder }
            />
        );
    }
}
