import _ from "lodash";
import BaseView from "app/components/BaseView";
import Template from "contrib/text!./Master.html";
import FakeTable from "./FakeTable";
import RawTable from "./RawTable";
import Pagination from "app/components/tables/Pagination";

export default BaseView.extend({
    tagName: "div",
    className: "ta-upload-sample-event-table",
    template: Template,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.jobModel = this.options.jobModel;
        this._limit = this.options.limit;
        this.listenTo(this.jobModel, "change:isFileJSON", this.renderTable);
        this.listenTo(this.jobModel, "change", this.onJobChange);
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        this.renderFakeTable();
        this.children.pagination = new Pagination({
            offset: 0,
            limit: this._limit,
            total: this.jobModel.get("eventCount")
        });
        this.listenTo(this.children.pagination, "paging", this.onPaging);
        this.$(".pagination-container-top").append(
            this.children.pagination.$el
        );
        return this;
    },
    renderTable: function() {
        if (this.children.table) {
            this.children.table.remove();
        }
        this.children.table = new RawTable({
            model: this.model,
            isFileJSON: this.jobModel.get("isFileJSON")
        });
        this.$(".table-container").html(this.children.table.render().$el);
    },
    renderFakeTable: function() {
        if (this.children.table) {
            this.children.table.remove();
        }
        this.children.table = new FakeTable({
            rows: 20
        });
        this.$(".table-container").html(this.children.table.render().$el);
    },
    onPaging: function(data) {
        var offset = data.offset;
        this.jobModel.getEvents(offset, this._limit).done(
            _.bind(function(response) {
                this.children.pagination.setOffset(offset);
                this.model.set(response);
            }, this)
        );
    },
    onJobChange: function() {
        // Splunk only allow user to get at most 1000 events by REST API.
        var eventCount = Math.min(this.jobModel.get("eventCount"), 1000);
        this.children.pagination.update({
            offset: 0,
            total: eventCount
        });
    }
});
