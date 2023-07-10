import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import EventCell from "./EventCell";

export default BaseView.extend({
    tagName: "table",
    initialize: function(options) {
        BaseView.prototype.initialize.apply(this, arguments);
        options.silent = true;
        this.update(options);
    },

    render: function() {
        this.renderEvents();
        return this;
    },
    update: function(options) {
        if (options.eventContents != null) {
            this._eventContents = options.eventContents;
        }
        if (options.offset != null) {
            this._offset = options.offset;
        }
        if (options.limit != null) {
            this._limit = options.limit;
        }
        if (options.total != null) {
            this._total = options.total;
        }
        if (!options.silent) {
            return this.renderEvents();
        }
        return this;
    },
    setOffset: function(offset) {
        return this.update({
            offset: offset
        });
    },
    renderEvents: function() {
        this.$el.html("<tbody></tbody>");
        var offset = this._offset;
        var events = this._eventContents.slice(
            this._offset,
            this._offset + this._limit
        );
        _.each(events, (event, index) => {
            this.renderRow(index + offset + 1, event);
        });
    },
    renderRow: function(index, event) {
        var row = $("<tr></tr>");
        var indexTd = $("<td></td>");
        indexTd.text(index);
        row.append(indexTd);
        var eventTd = $("<td></td>");
        var eventContent = new EventCell({
            content: event
        });
        eventTd.append(eventContent.render().$el);
        row.append(eventTd);
        this.$el.append(row);
    }
});
