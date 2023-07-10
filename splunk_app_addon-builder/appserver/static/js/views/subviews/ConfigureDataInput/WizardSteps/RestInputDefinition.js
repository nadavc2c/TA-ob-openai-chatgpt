import _ from "lodash";
import $ from "jquery";
import React from "react";
import ReactDOM from "react-dom";
import { killAllRunningTests } from "app/utils/ModInputTestRunner";
import BaseInputDefinition from "./BaseInputDefinition";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import Template from "contrib/text!./RestInputDefinition.html";
import RestInputProperties from "./RestInputPropertiesComponent.jsx";
import SearchJsonObject from "app/models/build_mod_input/SearchJsonObject";
import { validateRequiredInputCustomizedVar } from "../DataCollectionUtil";
import {
    validateRequiredGlobalCustomizedVar
} from "app/views/subviews/GlobalSettings/GlobalSettingsUtil";
import ace from "ace-editor";
const Range = ace.require("ace/range").Range;

const ATTR_MARKCLASS_MAP = {
    event_json_path_key: "ace-mark-line-event",
    ckpt_json_path_key: "ace-mark-line-ckpt"
};
const RestInputDefinition = BaseInputDefinition.extend({
    StatusCheckInterval: 2000,
    className: "ta-step-rest-input-definition ta-step-view",
    template: Template,
    initialize() {
        BaseInputDefinition.prototype.initialize.apply(this, arguments);
    },
    setModelValues() {
        const inputProperties = this.inputProperties;
        const globalSettings = inputProperties.getGlobalSettings();
        this.globalSettingsModel.set(globalSettings);
        this.model.set({
            use_basic_auth: inputProperties.getUseBaseAuth(),
            data_inputs_options: inputProperties.getDataInputsOptions(),
            customized_options: inputProperties.getCustomizedOptions(),
            global_settings: globalSettings
        });
    },
    validateModel() {
        const inputProperties = this.inputProperties;
        let localErrors = inputProperties.state.localErrors;
        localErrors = localErrors.set(
            "rest_url_errors",
            inputProperties.validateRestURLSettings(null, true)
        );
        localErrors = localErrors.set(
            "checkpoint_errors",
            inputProperties.validateCheckpointSettings(null, true)
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
    handleHighlight() {
        var p1 = new Promise((resolve, reject) => {
            let outputArea = this.children.outputArea;
            outputArea.cleanMarker();
            let data = this.jsonData;
            const localSettings = this.inputProperties.state.localSettings;

            let json_path = {};
            let eventpath = localSettings.get("event_extraction_settings")
                .event_json_path_key;
            let ckptpath = localSettings.get("checkpoint_settings")
                .ckpt_json_path_key;
            if (eventpath !== "") {
                json_path["event_json_path_key"] = [eventpath];
            }
            if (
                localSettings.get("checkpoint_settings").ckpt_enable &&
                ckptpath !== ""
            ) {
                json_path["ckpt_json_path_key"] = [ckptpath];
            }
            if (_.isEmpty(json_path)) {
                resolve(json_path);
                return;
            }

            let xhr = new SearchJsonObject();

            xhr
                .save({
                    root_object: data,
                    json_path: json_path
                })
                .done(response => {
                    if (!this.result) {
                        //when no json file was found return
                        resolve({});
                        return;
                    }
                    const value = outputArea.getValue();
                    const valueArr = value.split("\n");
                    const pathDicStart = this.result.start;
                    const pathDicEnd = this.result.end;
                    let attrAndPaths = response.data || {};
                    let errors = response.errs;


                    let markClass = ATTR_MARKCLASS_MAP["event_json_path_key"];
                    const eventArr = attrAndPaths["event_json_path_key"] || [];
                    _.each(eventArr, item => {
                        const start = pathDicStart[item.jsonpath];
                        const end = pathDicEnd[item.jsonpath];
                        const hl = _.range(start, end + 1);
                        outputArea.addMarker(markClass, hl, valueArr, Range);
                    });


                    markClass = ATTR_MARKCLASS_MAP["ckpt_json_path_key"];
                    const ckptArr = attrAndPaths["ckpt_json_path_key"] || [];
                    _.each(ckptArr, item => {
                        const start = pathDicStart[item.jsonpath];
                        const end = pathDicEnd[item.jsonpath];
                        let hl = _.range(start, end + 1);
                        outputArea.addMarker(markClass, hl, valueArr, Range);
                    });

                    resolve(errors);
                })
                .fail(() => {
                    console.log("Search JSON path failed.");
                });
        });
        return p1;
    },
    renderInputSettings() {
        let dfd = $.Deferred();
        ReactDOM.render(
            <RestInputProperties
                model={ this.model }
                globalModel={ this.globalSettingsModel }
                globalDfd={ dfd }
                ref={ instance => {
                    this.inputProperties = instance;
                } }
                onErrorsChange={ this.onErrorsChange.bind(this) }
                onJSONPathChange={ this.handleHighlight.bind(this) }
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
            helpLinkKey: "step_datainput_rest_input"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);

        this.renderInputSettings();

        this.renderSave()
            .renderTest()
            .renderOutputArea(this.$(".ta-test-output-container"));

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
    },
    onTestValueSet() {
        this.handleHighlight();
    }
});

export default RestInputDefinition;
