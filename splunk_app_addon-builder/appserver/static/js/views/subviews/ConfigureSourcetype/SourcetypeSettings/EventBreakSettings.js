import _ from "lodash";
import BaseView from "app/components/BaseView";
import RadioButtonGroupControl
    from "app/components/controls/RadioButtonGroupControl";
import ControlGroupView from "app/components/ControlGroupView";
import { TextControl } from "swc-aob/index";
import EventBreakSettingsViewTemplate
    from "contrib/text!./EventBreakSettings.html";

export default BaseView.extend({
    template: EventBreakSettingsViewTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        this.children.eventBreak = new ControlGroupView({
            label: _.t("Break Type"),
            controls: [
                new RadioButtonGroupControl({
                    model: this.model,
                    modelAttribute: "eventBreak",
                    items: [
                        {
                            value: "auto",
                            label: _.t("Auto"),
                            tooltipTitle: _.t(
                                "Event breaks are auto detected based on timestamp location."
                            )
                        },
                        {
                            value: "everyline",
                            label: _.t("Every Line"),
                            tooltipTitle: _.t("Every line is one event.")
                        },
                        {
                            value: "regex",
                            label: _.t("Regex..."),
                            tooltipTitle: _.t("Use pattern to split events.")
                        }
                    ]
                })
            ]
        });
        this.children.regexInput = new ControlGroupView({
            label: _.t("Pattern"),
            controls: [
                new TextControl({
                    model: this.model,
                    modelAttribute: "regex"
                })
            ]
        });
        this.$(".form").append(this.children.eventBreak.render().$el);
        this.$(".form-indent-section").append(
            this.children.regexInput.render().$el
        );

        if (this.model.get("eventBreak") === "regex") {
            this.showIndentSection();
        }
        this.listenTo(this.model, "change:eventBreak", this.onEventBreakChange);

        return this;
    },
    onEventBreakChange: function() {
        switch (this.model.get("eventBreak")) {
            case "auto":
                this.hideIndentSection();
                break;
            case "everyline":
                this.hideIndentSection();
                break;
            case "regex":
                this.showIndentSection();
                break;
        }
    },
    showIndentSection: function() {
        this.$(".form-indent-section").show();
    },
    hideIndentSection: function() {
        this.$(".form-indent-section").hide();
    }
});
