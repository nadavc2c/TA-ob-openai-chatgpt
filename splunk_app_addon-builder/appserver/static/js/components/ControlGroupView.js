import _ from "lodash";
import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import ControlGroupViewTemplate
    from "contrib/text!app/components/ControlGroupView.html";

export default BaseView.extend({
    className: "control-group clearfix",
    template: ControlGroupViewTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.renderModel = new Backbone.Model({
            label: this.options.label || "",
            required: !!this.options.required,
            labelWidth: this.options.labelWidth || 90
        });
        this.controls = this.options.controls || [];
    },
    render: function() {
        this.$el.html(this.compiledTemplate(this.renderModel.toJSON()));
        _.each(this.controls, control => {
            this.$(".controls").append(control.render().$el);
        });
        return this;
    },
    remove() {
        _.each(this.controls, control => {
            if (_.isFunction(control.remove)) {
                control.remove();
            }
        });
        BaseView.prototype.remove.apply(this, arguments);
    }
});
