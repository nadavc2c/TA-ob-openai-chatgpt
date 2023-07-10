import React from "react";
import Text from "@splunk/react-ui/Text";
import BaseItem from "./BaseItem.jsx";

export default class TextItem extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = BaseItem.defaultProps;

    constructor(...args) {
        super(...args);
    }
    renderControl() {
        return (
            <Text
                value={ this.props.value }
                placeholder={ this.props.placeholder }
                onChange={ this.onValueChange }
            />
        );
    }
}
