import React from "react";
import _ from "lodash";
import Styles from "./Master.pcssm";
import TitledPanel from "app/views/common/TitledPanel.jsx";
import TextPropertyEditorForm from "./forms/TextPropertyEditorForm.jsx";
import CheckboxPropertyEditorForm from "./forms/CheckboxPropertyEditorForm.jsx";
import SelectPropertyEditorForm from "./forms/SelectPropertyEditorForm.jsx";
import AccountPropertyEditorForm from "./forms/AccountPropertyEditorForm.jsx";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class PropertyEditor extends React.Component {
    static defaultProps = {
        onPropertiesUpdate: _.noop,
        onPropertiesUpdateError: _.noop,
        isSharedPlayground: false
    };

    static propTypes = {
        onPropertiesUpdate: PropTypes.func,
        onPropertiesUpdateError: PropTypes.func,
        isSharedPlayground: PropTypes.bool
    };
    constructor(...args) {
        super(...args);
        this.state = {
            index: -1,
            props: null
        };
    }
    render() {
        let content;
        const { isSharedPlayground } = this.props;
        const { index, props, collection } = this.state;
        if (index < 0) {
            content = (
                <div>
                    <i
                        className="icon-info-circle"
                        style={ { paddingRight: 5 } }
                    />
                    {_.t(
                        "To add a field to the form, drag one or more input fields from the Component Library to the center panel, then click a field to configure the details."
                    )}
                </div>
            );
        } else {
            switch (props.type) {
                case "text":
                case "password":
                    content = (
                        <TextPropertyEditorForm
                            index={ index }
                            onChange={ this.onPropertyEditorFormChange }
                            onError={ this.onPropertyEditorFormError }
                            props={ props }
                            collection={ collection }
                            isSharedPlayground={ isSharedPlayground }
                        />
                    );
                    break;
                case "checkbox":
                    content = (
                        <CheckboxPropertyEditorForm
                            index={ index }
                            onChange={ this.onPropertyEditorFormChange }
                            onError={ this.onPropertyEditorFormError }
                            props={ props }
                            collection={ collection }
                            isSharedPlayground={ isSharedPlayground }
                        />
                    );
                    break;
                case "radiogroup":
                    content = (
                        <SelectPropertyEditorForm
                            index={ index }
                            onChange={ this.onPropertyEditorFormChange }
                            onError={ this.onPropertyEditorFormError }
                            noPlaceholder
                            props={ props }
                            collection={ collection }
                            isSharedPlayground={ isSharedPlayground }
                        />
                    );
                    break;
                case "dropdownlist":
                    content = (
                        <SelectPropertyEditorForm
                            index={ index }
                            onChange={ this.onPropertyEditorFormChange }
                            onError={ this.onPropertyEditorFormError }
                            props={ props }
                            collection={ collection }
                            isSharedPlayground={ isSharedPlayground }
                        />
                    );
                    break;
                case "multi_dropdownlist":
                    content = (
                        <SelectPropertyEditorForm
                            index={ index }
                            onChange={ this.onPropertyEditorFormChange }
                            onError={ this.onPropertyEditorFormError }
                            multiple={ true }
                            props={ props }
                            collection={ collection }
                            isSharedPlayground={ isSharedPlayground }
                        />
                    );
                    break;
                case "global_account":
                    content = (
                        <AccountPropertyEditorForm
                            index={ index }
                            onChange={ this.onPropertyEditorFormChange }
                            onError={ this.onPropertyEditorFormError }
                            props={ props }
                            collection={ collection }
                            isSharedPlayground={ isSharedPlayground }
                        />
                    );
                    break;
            }
        }
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                <TitledPanel title={ _.t("Property Editor") }>
                    {content}
                </TitledPanel>
            </div>
        );
    }
    onPropertyEditorFormChange(...args) {
        this.props.onPropertiesUpdate(...args);
    }
    onPropertyEditorFormError(...args) {
        this.props.onPropertiesUpdateError(...args);
    }
}
