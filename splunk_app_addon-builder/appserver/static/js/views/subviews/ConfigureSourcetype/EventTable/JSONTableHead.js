import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import Template from "contrib/text!./JSONTableHead.html";

export default BaseView.extend({
    tagName: "thead",
    template: Template,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        var tr = this.$("tr");
        _.each(this.options.fields, function(field) {
            var td = $("<th></th>");
            td.text(field.name);
            tr.append(td);
        });
        return this;
    }
});
