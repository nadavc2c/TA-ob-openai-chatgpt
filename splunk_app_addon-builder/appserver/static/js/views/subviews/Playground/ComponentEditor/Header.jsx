import React from "react";
import Styles from "./Header.pcssm";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class Header extends React.Component {
    static propTypes = {
        text: PropTypes.string,
        icon: PropTypes.string
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                <div className={ Styles.text }>
                    {this.props.text}
                </div>
                <div className={ Styles.icon }>
                    {this.props.icon}
                </div>
            </div>
        );
    }
}
