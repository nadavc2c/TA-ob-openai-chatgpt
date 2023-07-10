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
            className: "event-summary",
            label: _.t("Event:")
        });
        this.updateUIElements();
        return this;
    },
    updateUIElements: function() {
        this.updateEventSummary();
    },
    updateEventSummary: function() {
        var text;
        try {
            text = this._data.length;
        } catch (e) {
            text = "-";
        }
        this.$(".event-summary dd").text(text);
    }
});
