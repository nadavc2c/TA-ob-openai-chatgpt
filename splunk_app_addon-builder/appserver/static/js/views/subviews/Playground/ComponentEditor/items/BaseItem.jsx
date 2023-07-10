import React from "react";
import _ from "lodash";
import Styles from "./BaseItem.pcssm";
import classnames from "classnames";
import ControlGroup from "app/components/ControlGroup.jsx";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class BaseItem extends React.Component {
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
        const control = this.renderControl();
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
                <ControlGroup
                    label={ this.getDisplayLabel() }
                    help={ helpHTML }
                    labelPosition="top"
                    required={ this.props.required }
                >
                    {control}
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
    getDisplayLabel() {
        return `${this.props.label}`;
    }
    renderControl() {
        throw new Error("This method must be implemented!");
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
