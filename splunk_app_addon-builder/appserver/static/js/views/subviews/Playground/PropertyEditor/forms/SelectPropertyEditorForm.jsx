import React from "react";
import { NAME_TO_LABEL as MAP } from "./Constants";
import {
    noEmptyValidator,
    noExistValidator,
    nameValidator,
    labelValidator,
    placeholderValidator,
    helpStringValidator,
    possibleValuesValidator
} from "./ValidateUtil";
import Text from "@splunk/react-ui/Text";
import Switch from "@splunk/react-ui/Switch";
import ControlGroup from "app/components/ControlGroup.jsx";
import BasePropertyEditorForm from "./BasePropertyEditorForm.jsx";
import ValueDefinitionTable from "./ValueDefinitionTable.jsx";
import { createTestHook } from "app/utils/testSupport";
//TODO: Remove state management inside this component.

export default class SelectPropertyEditorForm extends BasePropertyEditorForm {
    constructor(...args) {
        super(...args);

        this.validatorDefinition = {
            label: [noEmptyValidator(), labelValidator()],
            name: [
                noEmptyValidator(),
                nameValidator(),
                noExistValidator(this.getNameList.bind(this)),
                this.getNoReservedNamesValidator()
            ],
            help_string: [helpStringValidator()],
            possible_values: [possibleValuesValidator()]
        };
        if (!this.props.noPlaceholder) {
            this.validatorDefinition.placeholder = [placeholderValidator()];
        }
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
                {this.props.noPlaceholder
                    ? null
                    : <ControlGroup
                          label={ MAP.placeholder }
                          labelPosition="top"
                          { ...this.getErrorProps(errors, "placeholder") }
                      >
                          <Text
                              value={ props.placeholder }
                              onChange={ this.setFieldValueFunc("placeholder") }
                              onBlur={ this.onBlur }
                          />
                      </ControlGroup>}
                <ControlGroup
                    label={ MAP.possible_values }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "possible_values") }
                >
                    <ValueDefinitionTable
                        rows={ props.possible_values }
                        defaultSelection={ props.default_value }
                        onChange={ this.setFieldValueFunc("possible_values") }
                        onDefaultSelectionChange={ this.setFieldValueFunc(
                            "default_value"
                        ) }
                        multiple={ this.props.multiple }
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
