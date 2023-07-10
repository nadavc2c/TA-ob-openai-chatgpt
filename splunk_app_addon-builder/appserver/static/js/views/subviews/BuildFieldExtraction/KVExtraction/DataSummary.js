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
        this.addSection({
            className: "coverage-summary",
            label: _.t("Coverage:")
        });
        this.updateUIElements();
        return this;
    },
    updateUIElements: function() {
        this.updateEventSummary();
        this.updateCoverageSummary();
    },
    updateEventSummary: function() {
        var text;
        try {
            text = this._data.events.length;
        } catch (e) {
            text = "-";
        }
        this.$(".event-summary dd").text(text);
    },
    updateCoverageSummary: function() {
        var text;
        try {
            var total = this._data.events.length;
            var ratio = _.reduce(
                this._data.events,
                function(ratio, event) {
                    ratio += +event.ratio;
                    return ratio;
                },
                0
            );
            if (isNaN(ratio)) {
                ratio = 0;
            } else {
                ratio = ratio / total;
            }
            text = (ratio * 100).toFixed(2) + "%";
        } catch (e) {
            text = "-";
        }
        this.$(".coverage-summary dd").text(text);
    }
});
