import React from "react";
import _ from "lodash";
import RadioList from "@splunk/react-ui/RadioList";
import BaseItem from "./BaseItem.jsx";

export default class RadioGroup extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = BaseItem.defaultProps;
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
            <RadioList value={ this.props.value } onChange={ this.onValueChange }>
                {options}
            </RadioList>
        );
    }
}
