import _ from "lodash";
import Template
    from "contrib/text!app/views/subviews/SharedSettings/LogSettings.html";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import ControlGroupView from "app/components/ControlGroupView";
import SingleInputControl from "app/components/controls/SingleInputControl";

const LABEL_WIDTH = 150;

const LogSettingsView = BaseSubViewComponent.extend({
    template: Template,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        const model = this.model;
        this.children.logLevel = new ControlGroupView({
            label: _.t("Log level"),
            controls: [
                new SingleInputControl({
                    model: model,
                    modelAttribute: "log_level",
                    disableSearch: true,
                    autoCompleteFields: [
                        { value: "DEBUG", label: "DEBUG" },
                        { value: "INFO", label: "INFO" },
                        { value: "WARNING", label: "WARNING" },
                        { value: "ERROR", label: "ERROR" },
                        { value: "CRITICAL", label: "CRITICAL" }
                    ]
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form-indent-section").append(
            this.children.logLevel.render().$el
        );

        return this;
    }
});

export default LogSettingsView;
