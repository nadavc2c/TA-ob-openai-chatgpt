import $ from "jquery";
import _ from "lodash";
import TableRow from "./TableRow";

export default TableRow.extend({
    initialize: function() {
        TableRow.prototype.initialize.apply(this, arguments);
    },
    renderEvent: function() {
        var tr = this.$el;
        _.each(this.options.fields, field => {
            var td = $("<td></td>");
            td.text(this.model.get(field.name));
            tr.append(td);
        });
    }
});
