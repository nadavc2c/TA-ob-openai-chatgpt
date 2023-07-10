import _ from "lodash";
import React, { Component } from "react";
import { createTestHook } from "app/utils/testSupport";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import PropTypes from "prop-types";

export default class MyControlGroup extends Component {
    static defaultProps = {
        className: "",
        required: false
    };

    static propTypes = {
        className: PropTypes.string,
        required: PropTypes.bool,
        children: PropTypes.node
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        return (
            <div
                style={ {
                    position: "relative"
                } }
                className={ this.props.className }
                { ...createTestHook(__filename) }
            >
                {this.props.required
                    ? <span
                          style={ {
                              color: "#d6563c",
                              position: "absolute",
                              left: -5
                          } }
                      >
                          *
                      </span>
                    : null}
                <ControlGroup { ..._.omit(this.props, ["className"]) }>
                    {this.props.children}
                </ControlGroup>
            </div>
        );
    }
}
