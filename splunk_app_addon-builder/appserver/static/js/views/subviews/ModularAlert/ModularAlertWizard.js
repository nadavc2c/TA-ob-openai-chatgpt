import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import BaseSubView from "app/views/subviews/BaseSubView";
import StepWizardControl from "app/views/common/StepWizard";
import BasicInfoSettingView from "./WizardSteps/BasicInfoSetting";
import ParameterGlobalSettingView from "./WizardSteps/ParameterGlobalSetting";
import AlertDefinitionView from "./WizardSteps/AlertDefinition";
import SuccessView from "./WizardSteps/Success";
import * as DialogUtil from "app/utils/DialogUtil";
import { getFormattedMessage } from "app/utils/MessageUtil";
import Collector from "app/profiles/partyjsCollector";
import UpdateModularAlert from "app/models/modular_alert/update_modular_alert";
import CreateModularAlert from "app/models/modular_alert/create_modular_alert";
import GetModularInputName
    from "app/models/modular_alert/get_modular_input_name";
import GlobalSettings from "app/models/common/global_settings";

export default BaseSubView.extend({
    showNavBar: false,
    initialize: function(options) {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.parentView = options.parentView;
        this.model = options.model;
        this.collection = options.collection;
        this.step = options.step;
        this.stepModel = new Backbone.Model({
            step: this.step ? this.step : "basicInfoSetting"
        });
        // create a modular alert
        if (!this.model) {
            this.model = new Backbone.Model();
            this.modularInputNames = new GetModularInputName();
        }
        // global settings model
        this.globalSettings = new GlobalSettings();

        this.basicInfoSettingView = new BasicInfoSettingView({
            collection: this.collection,
            model: this.model,
            modularInputNames: this.modularInputNames
        });

        this.parameterGlobalSettingView = new ParameterGlobalSettingView({
            model: this.model,
            stepModel: this.stepModel,
            globalSettings: this.globalSettings,
            controller: this.controller
        });

        this.alertDefinitionView = new AlertDefinitionView({
            model: this.model,
            collection: this.collection,
            parentView: this,
            stepModel: this.stepModel,
            globalSettings: this.globalSettings
        });

        this.successView = new SuccessView({
            collection: this.collection,
            model: this.model,
            controller: this.controller
        });

        var that = this;
        this.basicInfoSetting = new Backbone.Model({
            value: "basicInfoSetting",
            label: "Properties",
            visible: true,
            enable: true,
            nextLabel: "",
            previousLabel: "",
            showNextButton: true,
            showPreviousButton: true,
            validate: function(stepModel, isSteppingNext) {
                if (isSteppingNext) {
                    var deferred = $.Deferred();
                    if (that.$(".error_message").length) {
                        deferred.reject();
                    } else if (!that.model.get("short_name")) {
                        that.displayErrorMessage(
                            that.$("input[name=short_name]"),
                            getFormattedMessage(10100, "Name")
                        );
                        deferred.reject();
                    } else if (!that.model.get("short_name").match(/^\w+$/)) {
                        that.displayErrorMessage(
                            that.$("input[name=short_name]"),
                            getFormattedMessage(10102, "Name")
                        );
                        deferred.reject();
                    } else if (!that.model.get("label")) {
                        that.displayErrorMessage(
                            that.$("input[name=label]"),
                            getFormattedMessage(10100, "Label")
                        );
                        deferred.reject();
                    } else if (that.model.get("active_response")) {
                        var activeResponseModel =
                            that.basicInfoSettingView.activeResponseModel;
                        if (!activeResponseModel.get("category")) {
                            that.displayErrorMessage(
                                that.$("div[name=modularalert-arf-subject]"),
                                getFormattedMessage(10100, "Category")
                            );
                            deferred.reject();
                        } else if (!activeResponseModel.get("task")) {
                            that.displayErrorMessage(
                                that.$("div[name=modularalert-arf-subject]"),
                                getFormattedMessage(10100, "Task")
                            );
                            deferred.reject();
                        } else if (!activeResponseModel.get("subject")) {
                            that.displayErrorMessage(
                                that.$("div[name=modularalert-arf-subject]"),
                                getFormattedMessage(10100, "Subject")
                            );
                            deferred.reject();
                        } else if (
                            !activeResponseModel.get("technology").length ||
                            !activeResponseModel.get("technology")[0].vendor
                        ) {
                            that.displayErrorMessage(
                                that.$(".modular_alert_version"),
                                getFormattedMessage(10100, "Vendor")
                            );
                            deferred.reject();
                        } else if (
                            !activeResponseModel.get("technology")[0].product
                        ) {
                            that.displayErrorMessage(
                                that.$(".modular_alert_version"),
                                getFormattedMessage(10100, "Product")
                            );
                            deferred.reject();
                        } else if (
                            !activeResponseModel.get("technology")[0].version ||
                            !activeResponseModel.get("technology")[0].version
                                .length
                        ) {
                            that.displayErrorMessage(
                                that.$(".modular_alert_version"),
                                getFormattedMessage(10100, "Version")
                            );
                            deferred.reject();
                        } else if (
                            _.find(
                                activeResponseModel.get("technology")[0]
                                    .version,
                                function(v) {
                                    return !v.match(/^[0-9\.]+$/);
                                }
                            )
                        ) {
                            that.displayErrorMessage(
                                that.$(".modular_alert_version"),
                                getFormattedMessage(10103, "Version")
                            );
                            deferred.reject();
                        } else {
                            deferred.resolve();
                        }
                    } else {
                        deferred.resolve();
                    }
                    return deferred.promise();
                }
            }
        });

        this.parameterGlobalSetting = new Backbone.Model({
            value: "parameterGlobalSetting",
            label: "Inputs & Parameters",
            visible: true,
            enable: true,
            nextLabel: "",
            previousLabel: "",
            showNextButton: true,
            showPreviousButton: true,
            validate: function(stepModel, isSteppingNext) {
                if (isSteppingNext) {
                    var deferred = $.Deferred();
                    if (that.$(".error_message").length) {
                        deferred.reject();
                    } else {
                        deferred.resolve();
                    }
                    return deferred.promise();
                }
            }
        });

        this.alertDefinition = new Backbone.Model({
            value: "alertDefinition",
            label: "Code & Test",
            visible: true,
            enable: true,
            nextLabel: _.t("Finish"),
            previousLabel: "",
            showNextButton: true,
            showPreviousButton: true,
            validate: function(stepModel, isSteppingNext) {
                if (isSteppingNext) {
                    var save_button = that.$("#save_code");
                    save_button.prop("disabled", true);
                    that.removeErrorMessage(that.$(".nav-buttons"));
                    // set the code
                    that.model.set(
                        "code",
                        that.alertDefinitionView.codeEditor.getValue()
                    );
                    var modularAlertModel;
                    //  save the modualr alert
                    if (that.model.get("uuid") || that.model.isSaved) {
                        modularAlertModel = new UpdateModularAlert({
                            modular_alert: that.model.toJSON(),
                            global_settings: that.globalSettings.toJSON()
                        });
                    } else {
                        modularAlertModel = new CreateModularAlert({
                            modular_alert: that.model.toJSON(),
                            global_settings: that.globalSettings.toJSON()
                        });
                    }
                    that.stepModel.trigger("disableNext");

                    // save global configuration
                    var globalSettingsModel = new GlobalSettings(
                        that.globalSettings.toJSON()
                    );
                    // save modular alert fisrt, then, save global setting
                    var retPromise = modularAlertModel
                        .save()
                        .then(
                            alertResponse => {
                                if (_.has(alertResponse, "err_code")) {
                                    return $.Deferred().reject(alertResponse);
                                }
                                if (
                                    alertResponse.status === "success" &&
                                    !that.model.get("uuid")
                                ) {
                                    let collectedData = _.omit(
                                        that.model.toJSON(),
                                        [
                                            "code",
                                            "smallIcon",
                                            "largeIcon",
                                            "uuid"
                                        ]
                                    );
                                    Collector.collect("track_creation", {
                                        type: "modular-alert",
                                        data: collectedData
                                    });
                                    that.model.set("uuid", alertResponse.meta);
                                    that.collection.add(modularAlertModel);
                                }
                                return globalSettingsModel.save();
                            },
                            () => {
                                return $.Deferred().reject({
                                    err_code: 10111,
                                    err_args: {
                                        short_name: modularAlertModel.get(
                                            "short_name"
                                        )
                                    }
                                });
                            }
                        )
                        .then(
                            response => {
                                if (_.has(response, "err_code")) {
                                    return $.Deferred().reject(response);
                                }
                                return true;
                            },
                            error => {
                                let errValue;
                                if (_.has(error, "err_code")) {
                                    errValue = error;
                                } else {
                                    errValue = {
                                        err_code: 11005,
                                        err_args: {}
                                    };
                                }
                                return $.Deferred().reject(errValue);
                            }
                        )
                        .always(() => {
                            save_button.prop("disabled", false);
                            that.stepModel.trigger("enableNext");
                            that.$(".save_process").hide();
                            that.$(".test_process").hide();
                        })
                        .fail(error => {
                            that.alertDefinitionView.showError(
                                getFormattedMessage(
                                    error.err_code,
                                    error.err_args
                                )
                            );
                        });
                    return retPromise;
                }
            }
        });

        this.success = new Backbone.Model({
            value: "success",
            label: "",
            visible: true,
            enable: true,
            nextLabel: "",
            previousLabel: "",
            showNextButton: false,
            showPreviousButton: false
        });

        this.stepCollection = new Backbone.Collection();
        this.stepCollection.add([
            this.basicInfoSetting,
            this.parameterGlobalSetting,
            this.alertDefinition,
            this.success
        ]);

        this.stepModel.on(
            "change:step",
            function() {
                let stepName = this.stepModel.get("step");
                if (stepName === "basicInfoSetting") {
                    //put the data into model
                    if (
                        this.parameterGlobalSettingView.basicCollection.length
                    ) {
                        var parameters = [];
                        _.each(
                            this.parameterGlobalSettingView.basicCollection
                                .models,
                            function(model) {
                                if (model) {
                                    parameters.push(
                                        _.omit(model.toJSON(), [
                                            "is_internal_name_touched"
                                        ])
                                    );
                                }
                            }
                        );
                        this.model.set("parameters", parameters);
                    }
                    this.renderStep();
                } else if (stepName === "parameterGlobalSetting") {
                    if (
                        this.stepModel.previous("step") === "basicInfoSetting"
                    ) {
                        //put the adaptive response data into model
                        if (this.model.get("active_response")) {
                            this.model.set(
                                "active_response",
                                this.basicInfoSettingView.activeResponseModel.toJSON()
                            );
                        }
                    } else if (
                        this.stepModel.previous("step") === "alertDefinition"
                    ) {
                        this.model.set(
                            "code",
                            this.alertDefinitionView.codeEditor.getValue()
                        );
                    }
                    this.renderStep();
                } else if (stepName === "alertDefinition") {
                    //put the data into model
                    if (
                        this.parameterGlobalSettingView.basicCollection.length
                    ) {
                        var params = [];
                        _.each(
                            this.parameterGlobalSettingView.basicCollection
                                .models,
                            function(model) {
                                if (model) {
                                    params.push(
                                        _.omit(model.toJSON(), [
                                            "is_internal_name_touched"
                                        ])
                                    );
                                }
                            }
                        );
                        this.model.set("parameters", params);
                    } else {
                        this.model.set("parameters", []);
                    }
                    var globalSettings = {};
                    if (
                        this.parameterGlobalSettingView.globalModel.get(
                            "component"
                        )
                    ) {
                        var components = this.parameterGlobalSettingView.globalModel.get(
                            "component"
                        );
                        _.each(components, function(component) {
                            if (that.globalSettings.get(component)) {
                                globalSettings[
                                    component
                                ] = that.globalSettings.get(component);
                            } else {
                                globalSettings[component] = {};
                            }
                        });
                    }
                    var globalCustomizedSettings = this.parameterGlobalSettingView.globalCollection.toJSON();
                    if (!_.isEmpty(globalCustomizedSettings)) {
                        // filter unused attribute
                        var customizedSettings = _.map(
                            globalCustomizedSettings,
                            setting => {
                                return _.omit(setting, [
                                    "is_internal_name_touched"
                                ]);
                            }
                        );
                        globalSettings.customized_settings = customizedSettings;
                    }
                    this.globalSettings.clear();
                    this.globalSettings.set(globalSettings);
                    this.renderStep();
                } else if (stepName === "success") {
                    this.renderStep();
                }
            }.bind(this)
        );
        this.stepWizard = new StepWizardControl({
            model: this.stepModel,
            modelAttribute: "step",
            label: this.model.get("uuid")
                ? "Edit Alert Action"
                : "Create Alert Action",
            exitButton: this.stepModel.get("step") !== "success",
            exitLabel: _.t("Cancel"),
            collection: this.stepCollection
        });
        this.map = {
            basicInfoSetting: this.basicInfoSettingView,
            parameterGlobalSetting: this.parameterGlobalSettingView,
            alertDefinition: this.alertDefinitionView,
            success: this.successView
        };
    },
    onWizardExit() {
        DialogUtil.showDialog({
            el: $("#delete-confirm-modal"),
            title: this.model.get("uuid")
                ? "Leave Edit Alert Action Wizard"
                : "Leave Create Alert Action Wizard",
            content: getFormattedMessage(28),
            btnNoText: _.t("Return to Wizard"),
            btnYesText: _.t("Leave Wizard"),
            yesCallback: () => {
                this.controller.navigate({
                    view: "modular-alert"
                });
            }
        });
    },
    render: function() {
        this.$el.html(_.template(this.template));
        // Render stepWizard and subview
        this.$(".ta-step-wizard").append(this.stepWizard.render().$el);
        this.renderStep();
        this.listenTo(this.stepWizard, "exit", this.onWizardExit);
        return this;
    },

    renderStep: function() {
        let stepName = this.stepModel.get("step");
        Collector.collect("track_step_view_wizard", {
            view: this.controller.models.navigation.get("view"),
            wizard_step_name: stepName,
            isEditing: !!this.model.get("uuid")
        });
        this.$(".ta-step-wizard-body").empty();
        this.$(".ta-step-wizard-body").append(this.map[stepName].render().$el);
        return this;
    },

    displayErrorMessage: function(selector, content) {
        var html =
            '<div class="error_message"><i class="icon-warning-sign"></i>' +
            content +
            "</div>";
        selector.after(html);
    },

    removeErrorMessage: function(selector) {
        _.each(selector.nextAll(".error_message"), function(error) {
            $(error).remove();
        });
    },

    template: '<div class="ta-step-wizard"></div><div class="ta-step-wizard-body"></div>'
});
