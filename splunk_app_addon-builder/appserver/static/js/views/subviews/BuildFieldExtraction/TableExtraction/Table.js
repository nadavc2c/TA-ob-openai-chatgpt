import BaseView from "app/components/BaseView";
import Template from "contrib/text!./Table.html";
import Pagination from "app/components/tables/Pagination";
import TableHead from "./TableHead";
import TableBody from "./TableBody";
import WaitSpinner from "app/components/WaitSpinner";
/**
 * Render a help block with/without help link.
 * @param {String} options.description
 * @param {String} options.url
 */
export default BaseView.extend({
    className: "event-table",
    template: Template,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this._data = this.options.data;
        this._limit = this.options.limit;
    },
    render: function() {
        this.removeChildren();
        this.$el.html(this.compiledTemplate({}));
        new WaitSpinner({
            el: this.$(".ta-wait-spinner")
        }).render();
        this.children.pagination = new Pagination({
            offset: 0,
            limit: this._limit,
            total: this._data.events.length
        });

        this.children.head = new TableHead({
            data: this._data.header
        });

        this.children.body = new TableBody({
            offset: 0,
            limit: this._limit,
            header: this._data.header,
            data: this._data.events
        });

        this.$(".pagination-container-top").append(
            this.children.pagination.render().$el
        );
        this.$("table").append(this.children.head.render().$el);
        this.$("table").append(this.children.body.render().$el);
        var that = this;
        this.children.pagination.on("paging", function(data) {
            var offset = data.offset;
            that.children.pagination.setOffset(offset);
            that.children.body.setOffset(offset);
        });
        this.hideLoading();
        return this;
    },
    setData: function(data) {
        this._data = data;
        this.render();
    },
    getTableHead: function() {
        return this._data.header;
    },
    showLoading: function() {
        this.$(".table-loading").show();
    },
    hideLoading: function() {
        this.$(".table-loading").hide();
    }
});
