import React from "react";
import _ from "lodash";
import Styles from "./LibraryComponent.pcssm";
import classnames from "classnames";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class LibraryComponent extends React.Component {
    static propTypes = {
        type: PropTypes.string.isRequired,
        title: PropTypes.string,
        onClick: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const { type, title } = this.props;
        let titleToRender;
        let iconClassName = "";
        switch (type) {
            case "text":
                iconClassName = "ta-playground-icon-text";
                titleToRender = _.t("Text");
                break;
            case "password":
                iconClassName = "ta-playground-icon-password";
                titleToRender = _.t("Password");
                break;
            case "dropdownlist":
                iconClassName = "ta-playground-icon-dropdownlist";
                titleToRender = _.t("Dropdown");
                break;
            case "multi_dropdownlist":
                iconClassName = "ta-playground-icon-multi_dropdownlist";
                titleToRender = _.t("Multiple Dropdown");
                break;
            case "radiogroup":
                iconClassName = "ta-playground-icon-radiogroup";
                titleToRender = _.t("Radio Buttons");
                break;
            case "checkbox":
                iconClassName = "ta-playground-icon-checkbox";
                titleToRender = _.t("Checkbox");
                break;
            case "global_account":
                iconClassName = "ta-playground-icon-global_account";
                titleToRender = _.t("Global Account");
                break;
        }
        if (title) {
            titleToRender = title;
        }
        return (
            <div
                className={ Styles.root }
                data-type={ type }
                onDoubleClick={ this.onClickHandler }
                { ...createTestHook(__filename) }
            >
                <div className={ Styles.imgWrap }>
                    <div className={ classnames(Styles.img, iconClassName) } />
                </div>
                <div className={ Styles.title }>
                    {titleToRender}
                </div>
            </div>
        );
    }
    onClickHandler(event) {
        const { onClick, type } = this.props;
        onClick(type, event);
    }
}
