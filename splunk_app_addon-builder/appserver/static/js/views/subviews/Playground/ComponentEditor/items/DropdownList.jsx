import React from "react";
import _ from "lodash";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";
import BaseItem from "./BaseItem.jsx";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";

const displayName = "Dropdown List";
export default class DropdownList extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = _.defaults(
        {
            required: false,
            name: convertNameToInternalName(displayName),
            label: displayName,
            default_value: "",
            placeholder: "",
            help_string: "",
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
            <SingleSelectControl
                value={ this.props.default_value }
                items={ this.props.possible_values }
                placeholder={ this.props.placeholder }
            />
        );
    }
}
