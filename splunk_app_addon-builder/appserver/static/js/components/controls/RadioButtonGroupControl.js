import $ from "jquery";
import _ from "lodash";
import "bootstrap";
import BaseView from "app/components/BaseView";

/**
 * Render a radio button group.
 * @param {Object} options.model
 * @param {String} options.modelAttribute - Attribute that is bound with this control. When control's value changes, value of this attribute in the model would also be changed.
 * @param {Array} options.items - Elements with format of {value: '', label: ''}. If a tooltip is needed when hovering, use {value: '', label: '', tooltipTitle: ''}
 */
export default BaseView.extend({
    className: "control btn-group btn-group-radio",
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.modelAttribute = this.options.modelAttribute || "val";
        this.items = this.options.items || [];
        this.buttons = {};
        this.listenTo(
            this.model,
            "change:" + this.modelAttribute,
            this.onAttrChange
        );
    },
    render: function() {
        this.buttons = {};
        _.each(this.items, (item, index) => {
            var button = this.createNewButton(item, index);
            this.buttons[item.value] = button;
            this.$el.append(button);
        });
        this.onAttrChange();
        this.$('[data-toggle="tooltip"]').each(function() {
            $(this).tooltip({
                trigger: "hover",
                container: "body"
            });
        });
        return this;
    },
    createNewButton: function(item, index) {
        var button = $('<button title="" class="btn"></button>');
        button.text(item.label);
        if (item.tooltipTitle) {
            button.attr("data-toggle", "tooltip");
            button.attr("data-original-title", _.escape(item.tooltipTitle));
        }
        button.data("index", index);
        return button;
    },
    events: {
        "click .btn": "onBtnClick"
    },
    onBtnClick: function(event) {
        event.preventDefault();
        var $target = $(event.currentTarget);
        var index = $target.data("index");
        var value = this.items[index].value;
        if (value === this.model.get(this.modelAttribute)) {
            return;
        }
        this.model.set(this.modelAttribute, value);
    },
    onAttrChange: function() {
        this.$(".btn.active").removeClass("active");
        var current = this.model.get(this.modelAttribute);
        if (current != null && this.buttons[current]) {
            this.buttons[current].addClass("active");
        }
    }
});
