import React from "react";
import _ from "lodash";
import Styles from "./Field.pcssm";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class Field extends React.Component {
    static propTypes = {
        text: PropTypes.string,
        tooltipText: PropTypes.string,
        isMatched: PropTypes.bool,
        onClick: PropTypes.func,
        hasHoveringEffect: PropTypes.bool,
        isCheckMarkFloatLeft: PropTypes.bool,
        defaultTooltipText: PropTypes.string
    };

    static defaultProps = {
        text: "",
        isMatched: false,
        onClick: _.noop,
        hasHoveringEffect: false,
        isCheckMarkFloatLeft: true
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const { text, isMatched, hasHoveringEffect, tooltipText, defaultTooltipText } = this.props;
        return (
            <div
                className={ hasHoveringEffect ? Styles.rootEffect : Styles.root }
                onClick={ this.eventHandler("onClick") }
                ref={ this.handleMount }
                { ...createTestHook(__filename) }
            >
                <span
                    style={ isMatched ? { color: "#65a637" } : null }
                    title={
                        tooltipText && hasHoveringEffect ? tooltipText : (defaultTooltipText || text)
                    }
                    className={
                        hasHoveringEffect ? Styles.textEffect : Styles.text
                    }
                >
                    {text}
                </span>
            </div>
        );
    }
    eventHandler(propName) {
        const { text, isMatched, [propName]: callback } = this.props;
        return event => {
            callback(event, {
                value: text,
                isMatched
            });
        };
    }
}
