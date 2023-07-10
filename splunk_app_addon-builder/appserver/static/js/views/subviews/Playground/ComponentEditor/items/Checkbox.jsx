import React from "react";
import _ from "lodash";
import Styles from "./BaseItem.pcssm";
import Switch from "@splunk/react-ui/Switch";
import classnames from "classnames";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";
import ControlGroup from "app/components/ControlGroup.jsx";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const displayName = "Checkbox";
export default class Checkbox extends React.Component {
    static propTypes = {
        isSelected: PropTypes.bool,
        onClick: PropTypes.func,
        onRemoveClick: PropTypes.func,
        required: PropTypes.bool,
        name: PropTypes.string,
        label: PropTypes.string,
        default_value: PropTypes.oneOfType([
            PropTypes.bool,
            PropTypes.number,
            PropTypes.string,
            PropTypes.array
        ]),
        help_string: PropTypes.string,
        possible_values: PropTypes.arrayOf(
            PropTypes.shape({
                value: PropTypes.string,
                label: PropTypes.string
            })
        )
    };

    static defaultProps = {
        required: false,
        name: convertNameToInternalName(displayName),
        label: displayName,
        default_value: false,
        help_string: "",
        isSelected: false,
        onClick: _.noop,
        onRemoveClick: _.noop
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const helpHTML = (
            <div style={ { wordWrap: "break-word" } }>
                {this.props.help_string}
            </div>
        );
        return (
            <div
                className={
                    this.props.isSelected
                        ? classnames(
                              Styles.root,
                              "clearfix",
                              Styles.rootFocused
                          )
                        : classnames(Styles.root, "clearfix")
                }
                onClick={ this.onClick }
                { ...createTestHook(__filename) }
            >
                <ControlGroup help={ helpHTML } label="" labelPosition="top">
                    <Switch
                        selected={ !!this.props.default_value }
                        value={ this.props.name }
                    >
                        {this.props.label}
                    </Switch>
                </ControlGroup>
                <div className={ Styles.cover } />
                <a
                    onClick={ this.onRemoveClick }
                    { ...createTestHook(null, {
                        componentName: "ta-link-remove"
                    }) }
                >
                    <div className={ classnames(Styles.jsRemove, "js-remove") } />
                </a>
            </div>
        );
    }
    onClick(event) {
        event.stopPropagation();
        this.props.onClick(this);
    }
    onRemoveClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.props.onRemoveClick(this);
        return false;
    }
}
