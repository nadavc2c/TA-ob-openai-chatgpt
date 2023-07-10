import _ from "lodash";
import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import RawTableRow from "./RawTableRow";
import TableContentTemplate from "contrib/text!./RawTable.html";

export default BaseView.extend({
    tagName: "table",
    className: "table",
    template: TableContentTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, "change", this.render);
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        this.renderRows();
        return this;
    },
    renderRows: function() {
        var results = this.model.get("results") || [];
        var tbody = this.$("tbody");
        var isFileJSON = this.options.isFileJSON;
        _.each(results, (result, index) => {
            var row = new RawTableRow({
                model: new Backbone.Model(result),
                index: index + 1 + this.model.get("init_offset"),
                isFileJSON: isFileJSON
            });
            tbody.append(row.render().$el);
        });
    }
});
