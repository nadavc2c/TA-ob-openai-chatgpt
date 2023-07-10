import React from "react";
import MultiSelectControl from "app/components/controls/MultiSelectControl.jsx";
import BaseItem from "./BaseItem.jsx";

export default class MultiDropdownList extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = BaseItem.defaultProps;
    constructor(...args) {
        super(...args);
    }
    renderControl() {
        return (
            <MultiSelectControl
                value={ this.props.value }
                items={ this.props.possible_values }
                placeholder={ this.props.placeholder }
                onChange={ this.onValueChange }
            />
        );
    }
}
