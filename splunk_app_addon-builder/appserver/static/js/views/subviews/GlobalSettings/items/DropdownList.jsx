import React from "react";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";
import BaseItem from "./BaseItem.jsx";

export default class DropdownList extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = BaseItem.defaultProps;
    constructor(...args) {
        super(...args);
    }
    renderControl() {
        return (
            <SingleSelectControl
                value={ this.props.value }
                items={ this.props.possible_values }
                placeholder={ this.props.placeholder }
                onChange={ this.onValueChange }
            />
        );
    }
}
