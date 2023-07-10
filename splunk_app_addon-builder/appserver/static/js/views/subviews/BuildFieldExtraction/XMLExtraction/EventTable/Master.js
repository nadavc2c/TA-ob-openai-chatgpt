import BaseView from "app/components/BaseView";
import Pagination from "app/components/tables/Pagination";
import Template from "contrib/text!./Master.html";
import TableContent from "./TableContent";

export default BaseView.extend({
    className: "event-table",
    initialize: function(options) {
        BaseView.prototype.initialize.apply(this, arguments);
        options.silent = true;
        this.update(options);
    },
    update: function(options) {
        if (options.eventContents != null) {
            this._eventContents = options.eventContents;
        }
        if (options.limit != null) {
            this._limit = options.limit;
        }
        if (!options.silent) {
            return this.render();
        }
    },
    render: function() {
        var that = this;
        this.$el.html(this.compiledTemplate({}));
        var events = this._eventContents;
        var total = events.length;
        if (this.children.pagination) {
            this.children.pagination.remove();
        }
        this.children.pagination = new Pagination({
            offset: 0,
            limit: this._limit,
            total: total
        });
        this.$(".pagination-container-top").html(
            this.children.pagination.render().$el
        );

        if (this.children.tableContent) {
            this.children.tableContent.remove();
        }
        this.children.tableContent = new TableContent({
            eventContents: events,
            offset: 0,
            limit: this._limit,
            total: events
        });
        this.$(".table-container").html(
            this.children.tableContent.render().$el
        );

        this.children.pagination.on("paging", function(data) {
            var offset = data.offset;
            that.children.pagination.setOffset(offset);
            that.children.tableContent.setOffset(offset);
        });
        return this;
    },
    template: Template
});
