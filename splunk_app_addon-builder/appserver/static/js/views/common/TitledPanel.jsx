import React from "react";
import Styles from "./TitledPanel.pcssm";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class TitledPanel extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        title: PropTypes.string,
        children: PropTypes.any
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const { title, children, className } = this.props;
        let classNameToRender = Styles.root;
        if (className) {
            classNameToRender += " " + className;
        }
        return (
            <div className={ classNameToRender } { ...createTestHook(__filename) }>
                <div className={ Styles.title }>
                    <span>{title}</span>
                </div>
                <div className={ Styles.body }>
                    {children}
                </div>
            </div>
        );
    }
}
