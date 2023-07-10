import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import GlobalSettings from "app/models/common/global_settings";
import BaseSubView from "app/views/subviews/BaseSubView";
import StepWizard from "app/views/common/StepWizard";
import ChooseMethodView from "./WizardSteps/ChooseMethod";
import ParameterGlobalSetting from "./WizardSteps/ParameterGlobalSetting";
import RestInputDefinition from "./WizardSteps/RestInputDefinition";
import CommandInputDefinition from "./WizardSteps/CommandInputDefinition";
import CustomizedInputDefinition from "./WizardSteps/CustomizedInputDefinition";
import SuccessView from "./WizardSteps/Success";
import { INPUT_TYPES } from "./DataCollectionUtil";
import Collector from "app/profiles/partyjsCollector";
import * as DialogUtil from "app/utils/DialogUtil";
import * as MessageUtil from "app/utils/MessageUtil";

export default BaseSubView.extend({
    showNavBar: false,
    initialize() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this._isEditing = !!this.options.isEditing;
        this._isCoding = !!this.options.isCoding;
        this._isChanged = false;
        this.models = {};
        this.stepViewClasses = {};
        this.models.step = new Backbone.Model({
            step: this._isEditing ? "parameterGlobalSetting" : "chooseMethod"
        });
        this.models.globalSettings = new GlobalSettings();

        if (this._isEditing) {
            this.makeCloneModel();
        }

        this.models.steps = {};
        this.createStepViewModel("chooseMethod", {
            label: _.t("Input Method"),
            viewClass: ChooseMethodView,
            visible: true,
            enabled: true,
            showNextButton: true,
            showPreviousButton: true
        });
        this.createStepViewModel("parameterGlobalSetting", {
            label: _.t("Inputs & Parameters"),
            viewClass: ParameterGlobalSetting,
            visible: true,
            enabled: true,
            showNextButton: true,
            showPreviousButton: true
        });
        this.createStepViewModel("restInputDefinition", {
            label: _.t("Define & Test"),
            viewClass: RestInputDefinition,
            visible: true,
            enabled: true,
            showNextButton: true,
            showPreviousButton: true,
            nextLabel: _.t("Finish")
        });
        this.createStepViewModel("commandInputDefinition", {
            label: _.t("Define & Test"),
            viewClass: CommandInputDefinition,
            visible: true,
            enabled: true,
            showNextButton: true,
            showPreviousButton: true,
            nextLabel: _.t("Finish")
        });
        this.createStepViewModel("customizedInputDefinition", {
            label: _.t("Define & Test"),
            viewClass: CustomizedInputDefinition,
            visible: true,
            enabled: true,
            showNextButton: true,
            showPreviousButton: true,
            nextLabel: _.t("Finish")
        });
        this.createStepViewModel("success", {
            label: "",
            viewClass: SuccessView,
            visible: true,
            enabled: true,
            showNextButton: false,
            showPreviousButton: false
        });

        // goto coding part
        if (this._isCoding) {
            if (this.model.get("type") === INPUT_TYPES.CUSTOMIZED) {
                this.models.step.set("step", "customizedInputDefinition");
            } else {
                this.showError(MessageUtil.getFormattedMessage(0));
            }
        }
        this.listenTo(this.models.step, "change:step", this.onStepChange);
    },
    createStepViewModel(name, options = {}) {
        options.value = name;
        this.models.steps[name] = new Backbone.Model(options);
    },
    onWizardExit() {
        DialogUtil.showDialog({
            el: $("#delete-confirm-modal"),
            title: "Leave Wizard",
            content: MessageUtil.getFormattedMessage(28),
            btnNoText: _.t("Return to Wizard"),
            btnYesText: _.t("Leave Wizard"),
            yesCallback: () => {
                this.controller.navigate({
                    view: "data-collection"
                });
            }
        });
    },
    makeCloneModel() {
        this.modelCloned = this.model.clone();
        return this.modelCloned;
    },
    makeCloneGlobalSettingsModel() {
        if (this.modelCloned && this.models.globalSettings) {
            this.modelCloned.set(
                "global_settings",
                this.models.globalSettings.toJSON()
            );
        }
    },
    isEditing() {
        return this._isEditing;
    },
    setEditing(_) {
        this._isEditing = !!_;
        let child = this.children.stepWizard;
        if (child) {
            child.collection.reset(this.getStepCollcection().models);
        }
        return this;
    },
    isChanged() {
        return this._isChanged;
    },
    setChanged(_) {
        this._isChanged = !!_;
        return this;
    },
    onStepChange() {
        let stepName = this.models.step.get("step");
        if (stepName === "dummy") {
            console.error("Dummy step should never be entered!");
            return;
        }
        let child = this.children.stepWizard;
        if (!child) {
            this.render();
        } else {
            child.collection.reset(this.getStepCollcection().models);
            child.options.exitButton = stepName !== "success";
            this.renderCurrentStepView();
        }
    },
    getStepCollcection() {
        let collection = new Backbone.Collection();
        let steps = this.models.steps;
        if (!this.isEditing()) {
            collection.add(steps.chooseMethod);
        }
        // collection.add(steps.basicSetting);
        collection.add(steps.parameterGlobalSetting);

        switch (this.model.get("type")) {
            case "rest":
                collection.add(steps.restInputDefinition);
                break;
            case "command":
                collection.add(steps.commandInputDefinition);
                break;
            case "customized":
                collection.add(steps.customizedInputDefinition);
                break;
            default:
                collection.add({
                    value: "dummy",
                    label: _.t("Define & Test"),
                    visible: true,
                    enabled: true
                });
        }

        collection.add(steps.success);
        return collection;
    },
    render() {
        this.$el.html(this.compiledTemplate({}));

        let stepName = this.models.step.get("step");
        this.createChild("stepWizard", StepWizard, {
            model: this.models.step,
            modelAttribute: "step",
            label: this._isEditing
                ? _.t("Edit Data Input")
                : _.t("Create Data Input"),
            exitButton: stepName !== "success",
            exitLabel: _.t("Cancel"),
            collection: this.getStepCollcection()
        });

        this.$(".ta-step-wizard").append(this.children.stepWizard.render().$el);
        this.listenTo(this.children.stepWizard, "exit", this.onWizardExit);

        this.renderCurrentStepView();

        return this;
    },
    renderCurrentStepView() {
        let stepName = this.models.step.get("step");
        Collector.collect("track_step_view_wizard", {
            view: this.controller.models.navigation.get("view"),
            wizard_step_name: stepName,
            isEditing: this._isEditing
        });
        if (this.currentStepView) {
            //unset validate function
            _.each(this.models.steps, step => {
                step.unset("validate");
            });
            this.currentStepView.remove();
        }
        let model = this.models.steps[stepName];
        let child = (this.currentStepView = this.createChild(
            stepName,
            model.get("viewClass"),
            {
                model: this.model,
                models: this.models,
                modelCloned: this.modelCloned
            }
        ));
        this.$(".ta-step-wizard-body").html(child.render().$el);
        this.models.steps[stepName].set("validate", child.validate.bind(child));
    },
    template: '<div class="ta-step-wizard"></div><div class="ta-step-wizard-body"></div>'
});
