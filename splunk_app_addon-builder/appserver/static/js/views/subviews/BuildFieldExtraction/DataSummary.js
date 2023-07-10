import $ from "jquery";
import _ from "lodash";
import Template from "contrib/text!./DataSummary.html";
import BaseView from "app/components/BaseView";

export default BaseView.extend({
    className: "data-summary",
    template: Template,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this._data = this.options.data;
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                sourcetype: this.options.sourcetype,
                formatLabel: this.options.formatLabel
            })
        );
        return this;
    },
    updateUIElements: function() {
        // To be overriden by children
    },
    setData: function(data) {
        this._data = data;
        this.updateUIElements();
    },
    addSection: function(options) {
        options = _.defaults(options || {}, {
            className: "",
            label: ""
        });
        var dl = $("<dl></dl>");
        dl.addClass(options.className);
        var dt = $("<dt></dt>");
        dt.text(options.label);
        dl.append(dt);
        dl.append($("<dd></dd>"));
        this.$el.append(dl);
    }
});
