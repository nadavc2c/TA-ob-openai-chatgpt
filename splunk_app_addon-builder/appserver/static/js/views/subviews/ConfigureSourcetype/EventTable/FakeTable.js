import $ from "jquery";
import BaseView from "app/components/BaseView";
import TableContentTemplate from "contrib/text!./RawTable.html";

export default BaseView.extend({
    tagName: "table",
    className: "table",
    template: TableContentTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        this.renderRows(this.options.rows || 1);
        return this;
    },
    renderRows: function(rows) {
        var tbody = this.$("tbody");
        for (var i = 0; i < rows; i++) {
            tbody.append($("<tr><td></td><td></td><td></td></tr>"));
        }
    }
});
