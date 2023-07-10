import _ from "lodash";
import React from "react";
import BaseInputPropertiesComponent from "./BaseInputPropertiesComponent.jsx";
import Immutable from "immutable";
import CommandSettings from "./LocalSettings/CommandSettings.jsx";
import { getFormattedMessage as getMsg } from "app/utils/MessageUtil";

export default class CommandInputPropertiesComponent
    extends BaseInputPropertiesComponent {
    static defaultProps = BaseInputPropertiesComponent.defaultProps;

    static propTypes = BaseInputPropertiesComponent.propTypes;
    constructor(...args) {
        super(...args);
    }
    setLocalSettingsState() {
        const { model } = this.props;
        let dataInputOptions = model.get("data_inputs_options") || [];

        let settings = BaseInputPropertiesComponent.prototype.setLocalSettingsState.apply(
            this
        );

        let commandSettings = {};

        _.each(dataInputOptions, ({ name, value }) => {
            if (name === "_command") {
                commandSettings.command = value;
            } else if (
                name === "command" &&
                !_.has(commandSettings, "command")
            ) {
                commandSettings.command = value;
            }
        });

        settings.command_settings = commandSettings;

        this.state.localSettings = Immutable.Map(settings);
        this.state.localErrors = Immutable.Map({
            command_errors: {}
        });
    }
    getDataInputsOptions() {
        const { localSettings } = this.state;
        let settings;
        settings = localSettings.get("command_settings");
        let inputOptions = [
            {
                name: "_command",
                description: "command",
                value: settings.command
            }
        ];

        inputOptions = _.concat(
            inputOptions,
            BaseInputPropertiesComponent.prototype.getDataInputsOptions.apply(
                this
            )
        );
        return inputOptions;
    }
    getLocalSettingsComponents() {
        const { localSettings, localErrors } = this.state;
        let components = BaseInputPropertiesComponent.prototype.getLocalSettingsComponents.apply(
            this
        );
        components.unshift(
            <CommandSettings
                key="local_command_settings"
                settings={ localSettings.get("command_settings") }
                errors={ localErrors.get("command_errors") }
                onChange={ this.onLocalCommandSettingsChange }
            />
        );
        return components;
    }
    onLocalCommandSettingsChange(settings, oriSettings, { field }) {
        const { localSettings, localErrors } = this.state;
        this.isTouchedMap[field] = true;
        const errors = localErrors.set(
            "command_errors",
            this.validateCommandSettings(settings)
        );
        this.props.onErrorsChange(errors.toJS());
        this.setState({
            localSettings: localSettings.set("command_settings", settings),
            localErrors: errors
        });
    }
    validateCommandSettings(settings, strict) {
        let errors = {};
        settings = settings || this.state.localSettings.get("command_settings");
        const isTouchedMap = this.isTouchedMap;
        let field, value;

        field = "command";
        if (strict || isTouchedMap[field]) {
            value = settings[field];
            if (!value) {
                errors[field] = getMsg(3007);
            }
        }
        return errors;
    }
}
