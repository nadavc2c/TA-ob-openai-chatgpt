import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import React from "react";
import ReactDOM from "react-dom";
import BaseStepView from "./BaseStepView";
import * as NameConvertUtil from "app/utils/NameConvertUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import * as HelpLinkUtil from "app/utils/HelpLinkUtil";
import * as DialogUtil from "app/utils/DialogUtil";
import PlaygroundView from "app/views/subviews/Playground/Master.jsx";
import * as PlaygroundUtil from "app/views/subviews/Playground/Util";
import ValidateInputMeta from "app/models/create_project/validate_input_meta";
import * as DataCollectionUtil
    from "app/views/subviews/ConfigureDataInput/DataCollectionUtil";
import ParameterGlobalTemplate
    from "contrib/text!./ParameterGlobalSetting.html";
import DataInputsProperties from "./BasicInputPropertiesComponent.jsx";

const INPUT_NAME_PATTERN = /^[a-zA-Z]\w*$/;
const SOURCETYPE_NAME_PATTERN = /^[\w\-:]{0,50}$/;
const INPUT_RESERVED_NAMES = [
    "sourcetype",
    "index",
    "start_by_shell",
    "monitor",
    "batch",
    "tcp",
    "splunktcp",
    "splunktcptoken",
    "udp",
    "fifo",
    "script",
    "http",
    "https",
    "perfmon",
    "MonitorNoHandle",
    "WinEventLog",
    "admon",
    "WinRegMon",
    "WinHostMon",
    "WinPrintMon",
    "WinNetMon",
    "powershell",
    "powershell2"
];

const VALIDATORS = {
    name: function(value) {
        let msg = null;
        if (value === "" || _.includes(value, " ")) {
            msg = MessageUtil.getFormattedMessage(3000);
        } else if (_.includes(INPUT_RESERVED_NAMES, value)) {
            msg = MessageUtil.getFormattedMessage(11010, value);
        } else if (!INPUT_NAME_PATTERN.test(value)) {
            msg = MessageUtil.getFormattedMessage(3133);
        } else if (value.length > 50) {
            msg = MessageUtil.getFormattedMessage(3171, { length: 50 });
        }
        return msg;
    },
    title: function(value) {
        let msg = null;
        if (value === "") {
            msg = MessageUtil.getFormattedMessage(3016);
        } else if (value.length >= 100) {
            msg = MessageUtil.getFormattedMessage(3172, { length: 100 });
        }
        return msg;
    },
    sourcetype: function(value) {
        let msg = null;
        if (value === "") {
            msg = MessageUtil.getFormattedMessage(3001);
        }
        if (!SOURCETYPE_NAME_PATTERN.test(value)) {
            msg = MessageUtil.getFormattedMessage(3017);
        }
        return msg;
    },
    interval: function(value) {
        let msg = null;
        if (value === "" || isNaN(+value)) {
            return MessageUtil.getFormattedMessage(3002);
        }
        return msg;
    }
};

export default BaseStepView.extend({
    className: "ta-step-view ta-parameter-global-setting",
    template: ParameterGlobalTemplate,
    initialize: function() {
        BaseStepView.prototype.initialize.apply(this, arguments);
        this.errorModel = new Backbone.Model();
        this.isTouchedMap = {};
    },
    remove() {
        ReactDOM.unmountComponentAtNode(this.$("#input_name")[0]);
        ReactDOM.unmountComponentAtNode(this.$("#ta-shared-parameters")[0]);
        ReactDOM.unmountComponentAtNode(this.$("#ta-own-parameters")[0]);
        BaseStepView.prototype.remove.apply(this, arguments);
    },
    onPropertiesChange(attr, value) {
        let model = this.model;
        let attrs = {
            [attr]: value
        };
        this.isTouchedMap[attr] = true;
        if (attr === "title") {
            if (!this.isTouchedMap["name"]) {
                attrs["name"] = NameConvertUtil.convertNameToInternalName(
                    value
                );
            }
        }
        model.set(attrs);
        this.validateModel();
        this.setStepNextStatus();
        this.renderInputProps();
    },
    setStepNextStatus() {
        const model = this.model;
        if (
            model.get("name") &&
            model.get("title") &&
            model.get("sourcetype") &&
            model.get("interval") &&
            _.size(this.errorModel.toJSON()) === 0 &&
            this.globalSettingsModel.isFetched
        ) {
            this.stepModel.trigger("enableNext");
            return true;
        } else {
            this.stepModel.trigger("disableNext");
            return false;
        }
    },
    renderInputProps() {
        ReactDOM.render(
            <DataInputsProperties
                { ...this.model.toJSON() }
                onPropertiesChange={ this.onPropertiesChange.bind(this) }
                errors={ this.errorModel.toJSON() }
            />,
            this.$("#input_name")[0]
        );
    },
    validate(stepModel, isSteppingNext) {
        this.clearError();
        this.setModelValues();
        if (isSteppingNext) {
            var deferred = $.Deferred();
            this.validateModel(true);

            if (_.size(this.errorModel.toJSON()) !== 0) {
                this.renderInputProps();
                deferred.reject();
            } else if (
                this.model.get("type") ===
                    DataCollectionUtil.INPUT_TYPES.CUSTOMIZED &&
                !this.model.get("parameters").length
            ) {
                this.showFormattedError(3014);
                this.$('a[href="#modular_input_definition"]').click();
                deferred.reject();
            } else {
                this.stepModel.trigger("disableNext");
                this.stepModel.trigger("showSpin", _.t("Please wait..."));
                let validateRequest = new ValidateInputMeta(
                    this.model.toJSON()
                );
                validateRequest
                    .save({})
                    .always(() => {
                        this.stepModel.trigger("enableNext");
                        this.stepModel.trigger("hideSpin");
                    })
                    .done(response => {
                        if (response.err_code) {
                            this.showFormattedError(response);
                            deferred.reject();
                        } else {
                            deferred.resolve();
                        }
                    })
                    .fail(() => {
                        this.showFormattedError(3138);
                        deferred.reject();
                    });
            }
            return deferred.promise();
        }
    },
    setModelValues() {
        let model = this.model;
        model.set({
            sourcetype: model.get("sourcetype").trim(),
            name: model.get("name").trim(),
            title: model.get("title").trim(),
            description: model.get("description").trim(),
            interval: model.get("interval").trim()
        });
        var params = this.ownPlayground.getComponentItems();
        model.set("parameters", params);

        var components = model.get("global_component"), globalSettings = {};
        _.each(components, component => {
            if (this.globalSettingsModel.get(component)) {
                globalSettings[component] = this.globalSettingsModel.get(
                    component
                );
            } else {
                if (component === "credential_settings") {
                    globalSettings[component] = [];
                } else {
                    globalSettings[component] = {};
                }
            }
        });
        var customized_settings = this.sharedPlayground.getComponentItems();
        if (!_.isEmpty(customized_settings)) {
            globalSettings["customized_settings"] = customized_settings;
        }
        this.globalSettingsModel.clear();
        this.globalSettingsModel.set(globalSettings);

        let new_options = DataCollectionUtil.convertParametersToInputOptions(
            model.get("parameters")
        );
        let old_options = model.get("data_inputs_options");
        _.each(old_options, item => {
            if (item.type !== "customized_var") {
                new_options.push(item);
            }
        });
        model.set("data_inputs_options", new_options);
    },
    validateModel(strict = false) {
        // strict mode guarantee to check all the fileds
        const model = this.model;
        const isTouchedMap = this.isTouchedMap;
        const errorModel = this.errorModel;
        errorModel.clear();

        _.each(["name", "title", "sourcetype", "interval"], attr => {
            let msg = null;
            if (strict || isTouchedMap[attr]) {
                if (_.isFunction(VALIDATORS[attr])) {
                    msg = VALIDATORS[attr](model.get(attr).trim());
                }
            }
            if (msg) {
                errorModel.set(attr, msg);
            } else {
                errorModel.unset(attr);
            }
        });
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                helpUrl: HelpLinkUtil.makeHelpUrl("step_datainput")
            })
        );

        if (this.model.get("title") && this.model.get("name")) {
            this.isTouchedMap["name"] =
                NameConvertUtil.convertNameToInternalName(
                    this.model.get("title")
                ) !== this.model.get("name");
        }
        this.renderInputProps();

        if (this.parentView.isEditing()) {
            this.$("[name=sourcetypeName]").attr("disabled", "disabled");
        }
        this.stepModel.trigger("disableNext");
        this.stepModel.trigger("showSpin", _.t("Please wait..."));

        // load global settings
        if (this.globalSettingsModel.isFetched) {
            this.renderGlobalSettings();
        } else {
            this.globalSettingsModel.fetch().done(() => {
                this.parentView.makeCloneGlobalSettingsModel();
                this.globalSettingsModel.isFetched = true;
                this.renderGlobalSettings();
            });
        }

        let dataInputOptions = this.model.get("data_inputs_options") || [];
        let parameters = DataCollectionUtil.convertInputOptionsToParameters(
            dataInputOptions
        );
        if (parameters.length) {
            this.model.set("parameters", parameters);
        }
        //edit model interface
        let component;
        component = React.createElement(PlaygroundView, {
            model: this.model,
            editorHeader: {
                text: _.t("Data Input Parameters")
            },
            items: [
                {
                    type: "text"
                },
                {
                    type: "password"
                },
                {
                    type: "checkbox"
                },
                {
                    type: "dropdownlist"
                },
                {
                    type: "multi_dropdownlist"
                },
                {
                    type: "radiogroup"
                },
                {
                    type: "global_account"
                }
            ],
            ref: instance => {
                this.ownPlayground = instance;
            },
            collection: PlaygroundUtil.parametersBackwardAdapter(
                this.model.get("parameters")
            ),
            onGlobalAccountAdd: this.onGlobalAccountAdd.bind(this),
            onComponentPropsUpdateError: this.onComponentPropsUpdateError.bind(
                this
            )
        });
        ReactDOM.render(component, this.$("#ta-own-parameters")[0]);

        return this;
    },
    renderGlobalSettings() {
        this.setStepNextStatus();
        this.stepModel.trigger("hideSpin");
        const model = this.model;
        const globalModel = this.globalSettingsModel;

        let component = React.createElement(PlaygroundView, {
            model: model,
            isSharedPlayground: true,
            disableLoggingCheckbox: true,
            items: [
                {
                    type: "text"
                },
                {
                    type: "password"
                },
                {
                    type: "checkbox"
                }
            ],
            ref: instance => {
                this.sharedPlayground = instance;
            },
            collection: PlaygroundUtil.parametersBackwardAdapter(
                globalModel.get("customized_settings")
            ),
            onComponentPropsUpdateError: this.onComponentPropsUpdateError.bind(
                this
            )
        });
        ReactDOM.render(component, this.$("#ta-shared-parameters")[0]);

        let components = [];
        if (globalModel.get("proxy_settings")) {
            components.push("proxy_settings");
        }

        components.push("log_settings");

        if (globalModel.get("credential_settings")) {
            components.push("credential_settings");
        }
        model.set("global_component", components);
        this.listenTo(
            model,
            "change:global_component",
            this.onGlobalComponentChagne.bind(this)
        );
    },
    onGlobalAccountAdd() {
        const updatedSettings = _.union(this.model.get("global_component"), [
            "credential_settings"
        ]);
        this.model.set("global_component", updatedSettings);
    },
    onComponentPropsUpdateError(errors) {
        if (this.setStepNextStatus() && _.size(errors) === 0) {
            this.stepModel.trigger("enableNext");
        } else {
            this.stepModel.trigger("disableNext");
        }
    },
    onGlobalComponentChagne(model, value) {
        const previousValue = model.previous("global_component");
        if (
            previousValue.includes("credential_settings") &&
            !value.includes("credential_settings")
        ) {
            DialogUtil.showDialog({
                el: $("#delete-confirm-modal"),
                title: "Uncheck add account",
                content: MessageUtil.getFormattedMessage(3018),
                btnNoText: _.t("Cancel"),
                btnYesText: _.t("Confirm"),
                yesCallback: () => {
                    this.ownPlayground.removeGlobalAccount();
                },
                noCallback: () => {
                    const updatedSettings = _.union(
                        this.model.get("global_component"),
                        ["credential_settings"]
                    );
                    this.model.set("global_component", updatedSettings);
                }
            });
        }
    }
});
