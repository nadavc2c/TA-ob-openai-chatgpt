import React, { Component } from "react";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import _ from "lodash";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class LoadingScreen extends Component {
    static propTypes = {
        loadCondition: PropTypes.bool,
        children: PropTypes.object,
        loadingStyle: PropTypes.string,
        loadingText: PropTypes.string
    };
    static defaultProps = {
        loadingText: "Loading...",
        loadingStyle: "",
        children: null
    };
    constructor(props, context) {
        super(props, context);
    }

    render() {
        return (
            <div { ...createTestHook(__filename) }>
                {this.props.loadCondition
                    ? <div className={ this.props.loadingStyle }>
                          <WaitSpinner
                              size="small"
                              color="brand"
                              style={ { marginRight: 5 } }
                          />
                          {_.t(this.props.loadingText)}
                      </div>
                    : <div>
                          {this.props.children}
                      </div>}
            </div>
        );
    }
}
