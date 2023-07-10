import $ from "jquery";
import TableRow from "./TableRow";
import RawEventCell from "./RawEventCell";
import JSONTreeCell
    from "app/views/subviews/BuildFieldExtraction/JSONExtraction/EventTable/EventCell";

export default TableRow.extend({
    initialize: function() {
        TableRow.prototype.initialize.apply(this, arguments);
    },
    renderEvent: function() {
        var td;
        var cell;
        if (this.options.isFileJSON) {
            cell = new JSONTreeCell({
                content: this.model.get("_raw")
            });
            td = cell.render().$el;
        } else {
            td = $("<td></td>");
            cell = new RawEventCell({
                model: this.model
            });
            td.html(cell.render().$el);
        }
        this.$el.append(td);
    }
});
