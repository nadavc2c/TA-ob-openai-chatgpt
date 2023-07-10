import _ from "lodash";
import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import JSONTableRow from "./JSONTableRow";

export default BaseView.extend({
    tagName: "tbody",
    // template: TableContentTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
    },
    render: function() {
        this.renderRows();
        return this;
    },
    renderRows: function() {
        var results = this.options.results || [];
        var tbody = this.$el;
        _.each(results, (result, index) => {
            var row = new JSONTableRow({
                model: new Backbone.Model(result),
                fields: this.options.fields,
                index: index + 1 + this.model.get("init_offset")
            });
            tbody.append(row.render().$el);
        });
    }
});
