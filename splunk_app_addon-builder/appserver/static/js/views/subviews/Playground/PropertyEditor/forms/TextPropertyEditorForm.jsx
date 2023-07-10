import React from "react";
import { NAME_TO_LABEL as MAP } from "./Constants";
import {
    noEmptyValidator,
    noExistValidator,
    nameValidator,
    labelValidator,
    placeholderValidator,
    helpStringValidator,
    defaultValueValidator
} from "./ValidateUtil";
import Text from "@splunk/react-ui/Text";
import Switch from "@splunk/react-ui/Switch";
import ControlGroup from "app/components/ControlGroup.jsx";
import BasePropertyEditorForm from "./BasePropertyEditorForm.jsx";
import { createTestHook } from "app/utils/testSupport";

//TODO: Remove state management inside this component.

export default class TextPropertyEditorForm extends BasePropertyEditorForm {
    constructor(...args) {
        super(...args);

        this.validatorDefinition = {
            label: [
                noEmptyValidator(),
                labelValidator(),
                noExistValidator(this.getLabelList.bind(this))
            ],
            name: [
                noEmptyValidator(),
                nameValidator(),
                noExistValidator(this.getNameList.bind(this)),
                this.getNoReservedNamesValidator()
            ],
            placeholder: [placeholderValidator()],
            help_string: [helpStringValidator()],
            default_value: [defaultValueValidator()]
        };
    }
    render() {
        const { props, errors } = this.state;
        return (
            <div { ...createTestHook(__filename) }>
                <ControlGroup
                    label={ MAP.label }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "label") }
                >
                    <Text
                        value={ props.label }
                        onChange={ this.setFieldValueFunc("label") }
                        onBlur={ this.onBlur }
                    />
                </ControlGroup>
                <ControlGroup
                    label={ MAP.name }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "name") }
                >
                    <Text
                        value={ props.name }
                        onChange={ this.setFieldValueFunc("name") }
                        onBlur={ this.onBlur }
                    />
                </ControlGroup>
                <ControlGroup
                    label={ MAP.placeholder }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "placeholder") }
                >
                    <Text
                        value={ props.placeholder }
                        onChange={ this.setFieldValueFunc("placeholder") }
                        onBlur={ this.onBlur }
                    />
                </ControlGroup>
                <ControlGroup
                    label={ MAP.default_value }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "default_value") }
                >
                    <Text
                        value={ props.default_value }
                        onChange={ this.setFieldValueFunc("default_value") }
                        onBlur={ this.onBlur }
                    />
                </ControlGroup>
                <ControlGroup
                    label={ MAP.help_string }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "help_string") }
                >
                    <Text
                        value={ props.help_string }
                        onChange={ this.setFieldValueFunc("help_string") }
                        multiline
                        onBlur={ this.onBlur }
                    />
                </ControlGroup>
                <ControlGroup label="" labelPosition="top">
                    <Switch
                        value="isRequired"
                        selected={ props.required }
                        appearance="checkbox"
                        onClick={ this.toggleFieldValueFunc("required") }
                    >
                        {MAP.required}
                    </Switch>
                </ControlGroup>
            </div>
        );
    }
}
