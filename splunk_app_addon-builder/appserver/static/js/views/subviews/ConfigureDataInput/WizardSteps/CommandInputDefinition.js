import _ from "lodash";
import $ from "jquery";
import React from "react";
import ReactDOM from "react-dom";
import { killAllRunningTests } from "app/utils/ModInputTestRunner";
import BaseInputDefinition from "./BaseInputDefinition";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import Template from "contrib/text!./CommandInputDefinition.html";
import CommandProperties from "./CommandInputPropertiesComponent.jsx";
import { validateRequiredInputCustomizedVar } from "../DataCollectionUtil";
import {
    validateRequiredGlobalCustomizedVar
} from "app/views/subviews/GlobalSettings/GlobalSettingsUtil";

const CommandInputDefinition = BaseInputDefinition.extend({
    className: "ta-step-command-input-definition ta-step-view",
    template: Template,
    initialize: function() {
        BaseInputDefinition.prototype.initialize.apply(this, arguments);
    },
    setModelValues() {
        const inputProperties = this.inputProperties;
        const globalSettings = inputProperties.getGlobalSettings();
        this.globalSettingsModel.set(globalSettings);
        this.model.set({
            data_inputs_options: inputProperties.getDataInputsOptions(),
            customized_options: inputProperties.getCustomizedOptions(),
            global_settings: globalSettings
        });
    },
    validateModel() {
        const inputProperties = this.inputProperties;
        let localErrors = inputProperties.state.localErrors;
        localErrors = localErrors.set(
            "command_errors",
            inputProperties.validateCommandSettings(null, true)
        );
        inputProperties.setState({
            localErrors: localErrors
        });
        return this.onErrorsChange(localErrors.toJS());
    },
    onErrorsChange(errors) {
        if (_.every(errors, subErrors => _.size(subErrors) === 0)) {
            this.stepModel.trigger("enableNext");
            this.enableSaveBtn();
            this.enableTestBtn();
            return true;
        } else {
            this.stepModel.trigger("disableNext");
            this.disableSaveBtn();
            this.disableTestBtn();
            return false;
        }
    },
    renderInputSettings() {
        let dfd = $.Deferred();
        ReactDOM.render(
            <CommandProperties
                model={ this.model }
                globalModel={ this.globalSettingsModel }
                globalDfd={ dfd }
                ref={ instance => {
                    this.inputProperties = instance;
                } }
                onErrorsChange={ this.onErrorsChange.bind(this) }
            />,
            this.$(".ta-parameters-container")[0]
        );
        this.stepModel.trigger("disablePrev");
        this.stepModel.trigger("disableNext");
        this.stepModel.trigger("showSpin", _.t("Loading Global Settings..."));
        this.disableSaveBtn();
        dfd.done(() => {
            this.stepModel.trigger("enableNext");
            this.stepModel.trigger("enablePrev");
            this.stepModel.trigger("hideSpin");
            this.enableSaveBtn();
        });
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        this.createChild("helpLinkHeader", HelpLinkHeader, {
            title: _.t("Define the data input"),
            helpLinkKey: "step_datainput_command_input"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);

        this.renderInputSettings();

        this.renderSave()
            .renderTest()
            .renderOutputArea(this.$(".ta-test-output-container"));

        // this.renderOptions();
        killAllRunningTests(this.model.get("name"));
        return this;
    },
    validateRequiredCustomizedVarAndGlobalVar() {
        let globalVarErrors = validateRequiredGlobalCustomizedVar(
            _.get(
                this.model.get("global_settings", {}),
                "customized_settings",
                []
            )
        );
        let inputVarErrors = validateRequiredInputCustomizedVar(
            this.model.get("data_inputs_options", []),
            this.model.get("customized_options", [])
        );
        this.inputProperties.changeCustomizedVarError(globalVarErrors, true);
        this.inputProperties.changeCustomizedVarError(inputVarErrors, false);
        return _.isEmpty(globalVarErrors) && _.isEmpty(inputVarErrors);
    },
    onTestClicked() {
        this.setModelValues();
        if (this.isTesting() || this.validateModel()) {
            BaseInputDefinition.prototype.onTestClicked.apply(this, arguments);
        }
    }
});

export default CommandInputDefinition;
