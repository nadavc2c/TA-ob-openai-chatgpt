import React from "react";
import _ from "lodash";
import RadioList from "@splunk/react-ui/RadioList";
import BaseItem from "./BaseItem.jsx";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";

const displayName = "Radio Buttons";
export default class RadioGroup extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = _.defaults(
        {
            required: false,
            name: convertNameToInternalName(displayName),
            label: displayName,
            default_value: "",
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
        let options = [];
        _.each(this.props.possible_values, (item, i) => {
            options.push(
                <RadioList.Option key={ i } label={ item.label } value={ item.value }>
                    {item.label}
                </RadioList.Option>
            );
        });
        return (
            <RadioList value={ this.props.default_value } onChange={ _.noop }>
                {options}
            </RadioList>
        );
    }
}
