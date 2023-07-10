import React from "react";
import _ from "lodash";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";
import BaseItem from "./BaseItem.jsx";
import { getFormattedMessage } from "app/utils/MessageUtil";

export default class GlobalAccount extends BaseItem {
    static propTypes = BaseItem.propTypes;

    static defaultProps = BaseItem.defaultProps;
    constructor(...args) {
        super(...args);
    }
    getDisplayLabel() {
        return `${this.props.label}`;
    }
    getTooltipText() {
        return _.t(
            "Use '${global_account.username}' to  reference the account usernameand use '${global_account.password}' to  reference the account password in the REST URL, REST headers or REST POST body."
        );
    }
    renderControl() {
        return (
            <SingleSelectControl
                value={ this.props.value }
                items={ this.props.possible_values }
                placeholder={ this.props.placeholder }
                noMatchText={ getFormattedMessage(3019) }
                onChange={ this.onValueChange }
            />
        );
    }
}
