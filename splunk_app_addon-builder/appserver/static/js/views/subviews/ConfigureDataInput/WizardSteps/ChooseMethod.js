import $ from "jquery";
import _ from "lodash";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import BaseStepView from "./BaseStepView";
import {
    INPUT_TYPES
} from "app/views/subviews/ConfigureDataInput/DataCollectionUtil";
import Template from "contrib/text!./ChooseMethod.html";
import RadioTemplate from "contrib/text!./ChooseIconRadio.html";

export default BaseStepView.extend({
    className: "ta-step-choose-method ta-step-view",
    template: Template,
    initialize() {
        BaseStepView.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, "change:type", this.onTypeChange);
        this.compiledRadioTemplate = _.template(RadioTemplate);
        this.initializeModel();
    },
    initializeModel() {
        if (!this.model.has("sourcetype")) {
            this.model.set("sourcetype", "");
        }
        if (!this.model.has("name")) {
            this.model.set("name", "");
        }
        if (!this.model.has("title")) {
            this.model.set("title", "");
        }
        if (!this.model.has("description")) {
            this.model.set("description", "");
        }
        if (!this.model.has("interval")) {
            this.model.set("interval", "30");
        }
    },
    validate(stepModel, isSteppingNext) {
        if (isSteppingNext) {
            var deferred = $.Deferred();
            if (this.model.get("type") == null) {
                deferred.reject();
            } else {
                if (this.model.hasChanged("type")) {
                    this.model.unset("data_inputs_options");
                    this.model.unset("customized_options");
                }
                deferred.resolve();
            }
            return deferred.promise();
        }
    },
    events: {
        "click .ta-icon-large": "onRadioIconClick",
        "click .ta-icon-radio-text": "onRadioIconTextClick"
    },
    onRadioIconClick(e) {
        e.preventDefault();
        let type = $(e.currentTarget.parentNode.parentNode).data("value");
        this.triggerStepForward(type);
    },
    onRadioIconTextClick(e) {
        e.preventDefault();
        let type = $(e.currentTarget.parentNode).data("value");
        this.triggerStepForward(type);
    },
    triggerStepForward(type) {
        this.clearError();
        this.model.set("type", type);
        this.selectIcon(type);
        this.stepModel.trigger("stepForward");
    },
    onTypeChange() {
        if (this.model.get("type")) {
            this.stepModel.trigger("enableNext");
        } else {
            this.stepModel.trigger("disableNext");
        }
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        this.createChild("helpLinkHeader", HelpLinkHeader, {
            title: _.t("Choose Input Method"),
            helpLinkKey: "step_datainput_choose_method"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);

        this.createIconRadio({
            subtitle: _.t("Modular input using a"),
            title: _.t("REST API"),
            description: _.t(
                "Get data in using a simple REST API call without writing code."
            ),
            value: INPUT_TYPES.REST,
            icon: "ta-icon-rest-api"
        });
        this.createIconRadio({
            subtitle: _.t("Modular input using"),
            title: _.t("Shell commands"),
            description: _.t("Get data in using a shell script."),
            value: INPUT_TYPES.COMMAND,
            icon: "ta-icon-shell-command"
        });
        this.createIconRadio({
            subtitle: _.t("Modular input using my"),
            title: _.t("Python code"),
            description: _.t(
                "Get data in by writing Python code for a modular input."
            ),
            value: INPUT_TYPES.CUSTOMIZED,
            icon: "ta-icon-python-code"
        });
        const type = this.model.get("type");
        if (type) {
            this.selectIcon(type);
        }
        this.onTypeChange();
        return this;
    },
    selectIcon(value) {
        this.$(`.ta-icon-large`).removeClass("isSelected");
        this.$(`.ta-icon-radio[data-value="${value}"] .ta-icon-large`).addClass(
            "isSelected"
        );
    },
    createIconRadio(options) {
        this.$(".ta-icon-radio-group").append(
            this.compiledRadioTemplate(options)
        );
    }
});
