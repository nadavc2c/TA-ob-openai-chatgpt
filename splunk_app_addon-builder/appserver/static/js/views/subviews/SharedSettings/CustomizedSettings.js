import _ from "lodash";
import Backbone from "backbone";
import Template
    from "contrib/text!app/views/subviews/SharedSettings/CustomizedSettings.html";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import ControlGroupView from "app/components/ControlGroupView";
import { TextControl } from "swc-aob/index";
import { SyntheticCheckboxControl }
    from "swc-aob/index";
import { SyntheticRadioControl } from "swc-aob/index";
import SingleInputControl from "app/components/controls/SingleInputControl";
import MultiSelectInputControl
    from "app/components/controls/MultiSelectInputControl";
import HelpBlock from "app/components/controls/HelpBlock";
import { splunkUtils } from "swc-aob/index";

const LABEL_WIDTH = 150;

const backwardCompatibleItems = items => {
    if (_.isArray(items)) {
        return items;
    } else if (_.isPlainObject(items)) {
        return _.map(items, (value, label) => ({
            label,
            value
        }));
    }
};

const CustomizedSettings = BaseSubViewComponent.extend({
    className: "ta-shared-customized-settings",
    template: Template,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.collection = this.options.collection || new Backbone.Collection();
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        this.collection.each((model, index) => {
            let label = `${model.get("label")} (${model.get("name")})`;
            if (model.get("format_type") === "global_account") {
                label = `${model.get("label")}`;
            }
            let controls = [];
            switch (model.get("format_type")) {
                case "text":
                    if (!model.get("value")) {
                        model.set("value", model.get("default_value") || "");
                    }
                    controls.push(
                        new TextControl({
                            model: model,
                            modelAttribute: "value",
                            placeholder: model.get("placeholder")
                        })
                    );
                    break;
                case "password":
                    if (!model.get("value")) {
                        model.set("value", model.get("default_value") || "");
                    }
                    controls.push(
                        new TextControl({
                            model: model,
                            modelAttribute: "value",
                            password: true,
                            placeholder: model.get("placeholder")
                        })
                    );
                    break;
                case "checkbox":
                    if (!model.get("value")) {
                        model.set("value", model.get("default_value") || 0);
                    }
                    controls.push(
                        new SyntheticCheckboxControl({
                            model: model,
                            modelAttribute: "value"
                        })
                    );
                    break;
                case "radio":
                case "radiogroup":
                    if (!model.get("value") && model.get("default_value")) {
                        model.set("value", model.get("default_value"));
                    }
                    controls.push(
                        new SyntheticRadioControl({
                            model: model,
                            modelAttribute: "value",
                            showAsButtonGroup: false,
                            items: backwardCompatibleItems(
                                model.get("possible_values")
                            )
                        })
                    );
                    break;
                case "dropdownlist":
                    if (!model.get("value") && model.get("default_value")) {
                        model.set("value", model.get("default_value"));
                    }
                    controls.push(
                        new SingleInputControl({
                            model: model,
                            modelAttribute: "value",
                            disableSearch: true,
                            autoCompleteFields: backwardCompatibleItems(
                                model.get("possible_values")
                            ),
                            placeholder: model.get("placeholder")
                        })
                    );
                    break;
                case "multi_dropdownlist":
                    if (!model.get("value") && model.get("default_value")) {
                        model.set(
                            "value",
                            splunkUtils.fieldListToString(
                                model.get("default_value")
                            )
                        );
                    }
                    if (_.isArray(model.get("value"))) {
                        model.set(
                            "value",
                            splunkUtils.fieldListToString(model.get("value"))
                        );
                    }
                    controls.push(
                        new MultiSelectInputControl({
                            model: model,
                            modelAttribute: "value",
                            items: model.get("possible_values"),
                            placeholder: model.get("placeholder")
                        })
                    );
                    break;
                case "global_account":
                    this.globalAccountSelectControl = new SingleInputControl({
                        model: model,
                        modelAttribute: "value",
                        disableSearch: true,
                        autoCompleteFields: [],
                        formatNoMatches: this.options.formatAccountNoMatches,
                        placeholder: model.get("placeholder")
                    });
                    controls.push(this.globalAccountSelectControl);
                    break;
            }
            if (model.get("help_string")) {
                controls.push(
                    new HelpBlock({
                        description: model.get("help_string")
                    })
                );
            }
            let child = (this.children[
                `control-${index}`
            ] = new ControlGroupView({
                label: label,
                required: model.get("required"),
                controls: controls,
                labelWidth: LABEL_WIDTH
            }));
            this.$(".form-indent-section").append(child.render().$el);
        });

        return this;
    },
    getGlobalAccountSelectControl() {
        return this.globalAccountSelectControl;
    }
});

export default CustomizedSettings;
