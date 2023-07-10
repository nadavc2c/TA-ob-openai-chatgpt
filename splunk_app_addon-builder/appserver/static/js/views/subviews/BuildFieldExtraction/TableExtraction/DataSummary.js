import _ from "lodash";
import BaseDataSummary
    from "app/views/subviews/BuildFieldExtraction/DataSummary";

export default BaseDataSummary.extend({
    initialize: function() {
        BaseDataSummary.prototype.initialize.apply(this, arguments);
    },
    render: function() {
        BaseDataSummary.prototype.render.apply(this);
        this.addSection({
            className: "column-summary",
            label: _.t("Column:")
        });
        this.addSection({
            className: "row-summary",
            label: _.t("Row:")
        });
        this.updateUIElements();
        return this;
    },
    updateUIElements: function() {
        this.updateRowSummary();
        this.updateColumnSummary();
    },
    updateRowSummary: function() {
        var text;
        try {
            text = this._data.events.length;
        } catch (e) {
            text = "-";
        }
        this.$(".row-summary dd").text(text);
    },
    updateColumnSummary: function() {
        var text;
        try {
            text = this._data.header.length;
        } catch (e) {
            text = "-";
        }
        this.$(".column-summary dd").text(text);
    }
});
