import $ from "jquery";
import _ from "lodash";
import moment from "moment";
import BaseView from "app/components/BaseView";

export default BaseView.extend({
    tagName: "tr",
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
    },
    render: function() {
        this.renderIndex();
        this.renderTime();
        this.renderEvent();
        return this;
    },
    renderIndex: function() {
        var td = $("<td></td>");
        td.html(`<span>${this.options.index}</span>`);
        if (this.model.get("_message_codes")) {
            var content = $('<i class="icon-alert"></i>');
            var title = '<ul class="tooltip-warinings events-viewer-tooltip">';
            var texts = this.model.get("_message_texts");
            if (!_.isArray(texts)) {
                texts = [texts];
            }
            _.each(texts, function(text) {
                title += "<li>" + _.escape(text) + "</li>";
            });
            title += "</ul>";
            content.tooltip({
                placement: "right",
                trigger: "hover",
                animation: false,
                html: true,
                title: title
            });
            td.append(content);
        }
        this.$el.append(td);
    },
    renderTime: function() {
        var td = $("<td></td>");
        td.html(
            moment(this.model.get("_time")).format("DD/MM/YYYY hh:mm:ss.SSS A")
        );
        this.$el.append(td);
    },
    renderEvent: function() {
        // To be implemented by children.
    }
});
