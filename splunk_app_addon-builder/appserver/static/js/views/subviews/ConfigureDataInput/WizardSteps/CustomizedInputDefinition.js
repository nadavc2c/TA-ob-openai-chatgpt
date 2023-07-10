import $ from "jquery";
import _ from "lodash";
import React from "react";
import ReactDOM from "react-dom";
import BaseInputDefinition from "./BaseInputDefinition";
import CreateDataInputCode from "app/models/create_project/create_input_code";
import { getFormattedMessage } from "app/utils/MessageUtil";
import {
    killAllRunningTests,
    killRunningTest
} from "app/utils/ModInputTestRunner";
import Template from "contrib/text!./CustomizedInputDefinition.html";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import CodeEditor from "app/views/common/CodeEditor";
import CustomizedProperties from "./CustomizedInputPropertiesComponent.jsx";
import { validateRequiredInputCustomizedVar } from "../DataCollectionUtil";
import {
    validateRequiredGlobalCustomizedVar
} from "app/views/subviews/GlobalSettings/GlobalSettingsUtil";
import { splunkUtils } from "swc-aob/index";

const CustomizedInputDefinitionView = BaseInputDefinition.extend({
    className: "ta-step-customized-input-definition ta-step-view",
    template: Template,
    initialize() {
        BaseInputDefinition.prototype.initialize.apply(this, arguments);
        this.listenTo(this.stepModel, "change:step", this.onStepChange);
        this.unloadListener = this.unloadListener.bind(this);
        this._dirty = false;
    },
    validateModel() {
        if (!this.model.get("code")) {
            this.showError(getFormattedMessage(3150));
            return false;
        }
        return true;
    },
    addWindowListener() {
        window.addEventListener("beforeunload", this.unloadListener);
    },
    isDirty() {
        return this._dirty;
    },
    setDirty(_ = true) {
        this._dirty = !!_;
    },
    onEditorChange() {
        this.setDirty();
    },
    unloadListener(event) {
        if (!this.isDirty()) {
            return undefined;
        }

        const confirmationMessage = getFormattedMessage(3022);

        (event || window.event).returnValue = confirmationMessage; //Gecko + IE
        return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
    },
    removeWindowListener() {
        window.removeEventListener("beforeunload", this.unloadListener);
        $(window).trigger("popstate");
    },
    render() {
        killAllRunningTests(this.model.get("name"));
        this.$el.empty();
        this.$el.html(this.compiledTemplate());
        this.createChild("helpLinkHeader", HelpLinkHeader, {
            title: _.t("Define Inputs"),
            helpLinkKey: "step_datainput_customized_input"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);

        this.createChild("codeEditor", CodeEditor, {
            onChange: this.onEditorChange.bind(this)
        });
        this.$(".ta-code-editor-container").append(
            this.children.codeEditor.render().$el
        );

        this.renderInputSettings().done(() => {
            if (!this.inputProperties) {
                return;
            }
            const options = this.inputProperties.getDataInputsOptions();
            if (this.model.get("code")) {
                this.renderCodeEditor(this.model.get("code"), options);
            } else {
                let codeFetcher = new CreateDataInputCode();
                let codeFetchReqData = this.model.toJSON();
                codeFetchReqData.data_inputs_options = options;
                codeFetchReqData.global_settings = this.inputProperties.getGlobalSettings();
                codeFetcher.save(codeFetchReqData, {
                    success: (model, resp) => {
                        this.model.set("code", resp.code);
                        this.renderCodeEditor(resp.code, options);
                    },
                    error: (model, resp) => {
                        let eno = resp.err_code || 3121;
                        let eopts = resp.err_args || {};
                        this.showFormattedError(eno, eopts);
                    },
                    'headers': {
                        'X-Splunk-Form-Key': splunkUtils.getFormKey()
                    }
                });
            }
        });
        var that = this;
        // Setting expand click events
        this.$(
            ".ta-test-code-arrows.pull-left i.icon-arrow-left"
        ).click(function() {
            that.$(".ta-parameters-container").hide();
            that.children.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-left i.icon-arrow-right").show();
            $(this).hide();
        });
        this.$(
            ".ta-test-code-arrows.pull-left i.icon-arrow-right"
        ).click(function() {
            that.$(".ta-parameters-container").show();
            that.children.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-left i.icon-arrow-left").show();
            $(this).hide();
        });

        // Output expand click events
        this.$(
            ".ta-test-code-arrows.pull-right i.icon-arrow-left"
        ).click(function() {
            that.$(".ta-test-output-container").show();
            that.children.outputArea.resize();
            that.children.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-right i.icon-arrow-right").show();
            $(this).hide();
        });
        this.$(
            ".ta-test-code-arrows.pull-right i.icon-arrow-right"
        ).click(function() {
            that.$(".ta-test-output-container").hide();
            that.children.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-right i.icon-arrow-left").show();
            $(this).hide();
        });
        return this;
    },
    renderInputSettings() {
        let dfd = $.Deferred();
        ReactDOM.render(
            <CustomizedProperties
                model={ this.model }
                globalModel={ this.globalSettingsModel }
                globalDfd={ dfd }
                ref={ instance => {
                    this.inputProperties = instance;
                } }
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

        return dfd.promise();
    },
    renderCodeEditor(code, options) {
        this.$("#modular_input_definition").empty();
        const optionsMap = _.map(options, item => {
            return {
                label: `param:${item.name}`,
                value: `##option ${item.name}\nopt_${item.name} = helper.get_arg("${item.name}")\n`
            };
        });
        this.children.codeEditor
            .setValue(code)
            .setCompleter(optionsMap)
            .onCtrlEnter(() => {
                this.testInput();
            })
            .onCtrlS(() => {
                this.onSaveClicked();
            });

        this.renderSave()
            .renderTest()
            .renderOutputArea(this.$(".ta-test-output-container"));

        this._dirty = false;
        this.addWindowListener();
        return this;
    },

    onTestClicked() {
        // update the code and customized values
        this.setModelValues();
        BaseInputDefinition.prototype.onTestClicked.apply(this, arguments);
    },

    setModelValues() {
        const inputProperties = this.inputProperties;
        const globalSettings = inputProperties.getGlobalSettings();
        this.globalSettingsModel.set(globalSettings);
        this.model.set({
            data_inputs_options: inputProperties.getDataInputsOptions(),
            customized_options: inputProperties.getCustomizedOptions(),
            global_settings: globalSettings,
            code: this.children.codeEditor.getValue()
        });
    },

    onStepChange() {
        if (this.testID) {
            killRunningTest(this.testID)
                .then(() => {
                    console.log("Test is killed when changing step.");
                })
                .fail(() => {
                    console.log(
                        "Fail to kill testing process when changing step."
                    );
                });
        }
    },
    remove() {
        this.removeWindowListener();
        BaseInputDefinition.prototype.remove.apply(this, arguments);
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
    }
});

export default CustomizedInputDefinitionView;
