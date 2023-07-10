import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import RadioButtonGroupControl
    from "app/components/controls/RadioButtonGroupControl";

/**
 * Render a radio button group.
 * @param {Object} options.model
 * @param {String} options.modelAttribute - Attribute that is bound with this control. When control's value changes, value of this attribute in the model would also be changed.
 * @param {Array} options.items - Elements with format of {value: '', label: ''}. If a tooltip is needed when hovering, use {value: '', label: '', tooltipTitle: ''}. For this control, '__custom__' is reserved for the customize item value.
 * @param {String} options.inputLabel
 */
export default BaseView.extend({
    className: "btn-group-radio-input-wrapper",
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.modelAttribute = this.options.modelAttribute || "val";
        this.wrappedModel = new Backbone.Model();
        this.wrappedModel.set("val", this.model.get(this.modelAttribute));

        this.inputLabel = this.options.inputLabel || _.t("Other...");
        this.inputDescription = this.options.inputDescription || null;
        this.items = this.options.items || [];
        this.values = _.map(this.items, "value");
        this.items.push({
            value: "__custom__",
            label: this.inputLabel,
            tooltipTitle: this.inputDescription
        });
        this.isCustomize = false;

        this.listenTo(
            this.model,
            "change:" + this.modelAttribute,
            this.onAttrChange
        );
        this.listenTo(this.wrappedModel, "change:val", this.onWrappedValChange);
    },
    render: function() {
        this.children.radioButtonGroup = new RadioButtonGroupControl({
            model: this.wrappedModel,
            modelAttribute: "val",
            items: this.items
        });
        this.$el.empty();
        this.$el.append(this.children.radioButtonGroup.render().$el);
        this.children.inputControl = $(
            '<input type="text" autocomplete="off"/>'
        );
        this.$el.append(this.children.inputControl);
        this.children.inputControl.hide();
        this.onAttrChange();
        return this;
    },
    events: {
        "change input": "onInputChange",
        "keydown input": "onInputKeydown"
    },
    onAttrChange: function() {
        var current = this.model.get(this.modelAttribute);
        if (this.values.indexOf(current) > -1 && !this.isCustomize) {
            this.wrappedModel.set("val", current);
        } else {
            this.children.inputControl.val(current);
            this.wrappedModel.set("val", "__custom__");
        }
    },
    onWrappedValChange: function() {
        var value = this.wrappedModel.get("val");
        if (value === "__custom__") {
            this.isCustomize = true;
            this.children.inputControl.show().focus();
            value = this.children.inputControl.val();
        } else {
            this.isCustomize = false;
            this.children.inputControl.hide();
        }
        this.setValue(value);
    },
    onInputChange: function() {
        if (!this.isCustomize) {
            return;
        }
        this.setValue(this.children.inputControl.val());
    },
    onInputKeydown: function(e) {
        var event = e || window.event;
        var charCode = event.which || event.keyCode;
        if (charCode.toString() === "13") {
            // Enter pressed
            e.stopPropagation();
            e.preventDefault();
            this.onInputChange();
            return false;
        }
    },
    setValue: function(value) {
        if (value !== "") {
            this.model.set(this.modelAttribute, value);
        }
    }
});
