import $ from "jquery";
import _ from "underscore";
import Backbone from "backbone";
import { Control } from "swc-aob/index";
import { CheckboxGroup } from "swc-aob/index";
import { SyntheticCheckboxControl }
    from "swc-aob/index";

export default CheckboxGroup.extend({
    className: "control checkbox-group",
    initialize: function(options) {
        this._checkboxes = [];
        this._selections = new Backbone.Model();
        _.each(
            options.items,
            function(value) {
                var syntheticCheckboxControl = new SyntheticCheckboxControl({
                    model: this._selections,
                    modelAttribute: value.value,
                    label: _($.trim(value.label) || value.value || "").t(),
                    enabled: !value.disabled
                });
                this._checkboxes.push(syntheticCheckboxControl);
            },
            this
        );
        this.listenTo(this._selections, "change", this._updateValue);
        this.listenTo(
            this.model,
            "change:" + options.modelAttribute,
            this.updateDomVal
        );
        this.updateDomVal();
        Control.prototype.initialize.apply(this, arguments);
    }
});
