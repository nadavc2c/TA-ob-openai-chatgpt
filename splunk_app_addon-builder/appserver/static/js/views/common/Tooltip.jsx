import React, { Component } from "react";
import _ from "lodash";
import style from "./Tooltip.pcssm";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

class LoadingScreen extends Component {
    static propTypes = {
        title: PropTypes.string,
        children: PropTypes.object
    };
    constructor(props, context) {
        super(props, context);
    }

    render() {
        return (
            <span
                title={ _.t(this.props.title) }
                className={ style["toolTip"] }
                { ...createTestHook(__filename) }
            >
                {this.props.children}
            </span>
        );
    }
}

export default LoadingScreen;
