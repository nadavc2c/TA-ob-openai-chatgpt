import React, { Component } from "react";
import _ from "lodash";
import Styles from "./SaveAndCancel.pcssm";
import classnames from "classnames";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class ButtonGroup extends Component {
    static propTypes = {
        buttonMap: PropTypes.array
    };
    constructor(props, context) {
        super(props, context);
    }
    render() {
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                {_.map(this.props.buttonMap, (button, index) => {
                    const { isPrimary, label, func, isDisabled } = button;
                    return (
                        <button
                            { ...(isDisabled ? { disabled: "disabled" } : {}) }
                            key={ index }
                            className={
                                isPrimary
                                    ? classnames(
                                          Styles.save,
                                          "btn",
                                          "btn-primary"
                                      )
                                    : classnames(Styles.save, "btn")
                            }
                            onClick={ () => {
                                if (isDisabled) {
                                    return;
                                }
                                func();
                            } }
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        );
    }
}
