import _ from "lodash";
import BaseView from "app/components/BaseView";
import Pagination from "app/components/tables/Pagination";
import Template from "contrib/text!./Master.html";
import RadioButtonGroupControl
    from "app/components/controls/RadioButtonGroupControl";
import TableContent from "./TableContent";
import WaitSpinner from "app/components/WaitSpinner";

export default BaseView.extend({
    className: "event-table",
    initialize: function(options) {
        BaseView.prototype.initialize.apply(this, arguments);
        options.silent = true;
        this.update(options);
        this.model.set("filter", "all");
        this.listenTo(this.model, "change:filter", this.onFilterChange);
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
        this.calculate();
        this.$el.html(this.compiledTemplate(this.getTemplateParas()));
        new WaitSpinner({
            el: this.$(".ta-wait-spinner")
        }).render();
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
            total: events.length || 0
        });
        this.$(".table-container").append(
            this.children.tableContent.render().$el
        );

        if (this.children.filter) {
            this.children.filter.remove();
        }
        this.model.set("filter", "all");
        this.children.filter = new RadioButtonGroupControl({
            model: this.model,
            modelAttribute: "filter",
            items: [
                {
                    value: "all",
                    label: _.t("All")
                },
                {
                    value: "match",
                    label: _.t("Matched")
                },
                {
                    value: "partialmatch",
                    label: _.t("Partially Matched")
                },
                {
                    value: "nonmatch",
                    label: _.t("Unmatched")
                }
            ]
        });

        this.$(".filter-container-top").html(this.children.filter.render().$el);

        this.children.pagination.on("paging", function(data) {
            var offset = data.offset;
            that.children.pagination.setOffset(offset);
            that.children.tableContent.setOffset(offset);
        });
        this.hideLoading();
        return this;
    },
    calculate: function() {
        var that = this;
        this._matchedEvents = [];
        this._partialmatchedEvents = [];
        this._nonmatchedEvents = [];
        _(this._eventContents).each(function(event) {
            var ratio = +event.ratio;
            if (ratio >= 1) {
                that._matchedEvents.push(event);
            } else if (ratio <= 0) {
                that._nonmatchedEvents.push(event);
            } else {
                that._partialmatchedEvents.push(event);
            }
        });
    },
    getMatchedEvents: function() {
        return this._matchedEvents;
    },
    getPartialMatchedEvents: function() {
        return this._partialmatchedEvents;
    },
    getTemplateParas: function() {
        var numOfEvents = this._eventContents.length;
        var matchRatio = 0;
        var partialmatchRatio = 0;
        var nonmatchRatio = 0;
        if (numOfEvents !== 0) {
            matchRatio = Math.round(
                this._matchedEvents.length / numOfEvents * 100
            );
            partialmatchRatio = Math.round(
                this._partialmatchedEvents.length / numOfEvents * 100
            );
            if (matchRatio + partialmatchRatio > 100) {
                partialmatchRatio = 100 - matchRatio;
                nonmatchRatio = 0;
            } else {
                nonmatchRatio = 100 - matchRatio - partialmatchRatio;
            }
        }

        var description =
            numOfEvents +
            _.t(" events, ") +
            matchRatio +
            _.t("% matched, ") +
            partialmatchRatio +
            _.t("% partially matched, ") +
            nonmatchRatio +
            _.t("% unmatched.");
        return {
            description: description
        };
    },
    onFilterChange: function() {
        var filterType = this.model.get("filter");
        var events;
        switch (filterType) {
            case "all":
                events = this._eventContents;
                break;
            case "match":
                events = this._matchedEvents;
                break;
            case "partialmatch":
                events = this._partialmatchedEvents;
                break;
            case "nonmatch":
                events = this._nonmatchedEvents;
                break;
        }
        var total = events.length;
        this.children.pagination.update({
            offset: 0,
            total: total
        });
        this.children.tableContent.update({
            eventContents: events,
            offset: 0,
            total: total
        });
        this.$(".table-container").scrollTop(0);
    },
    clearMessage: function() {
        this.$(".message-container-top").text("");
    },
    removeChildren: function() {
        BaseView.prototype.removeChildren.apply(this);
        this.clearMessage();
    },
    showLoading: function() {
        this.$(".table-loading").show();
    },
    hideLoading: function() {
        this.$(".table-loading").hide();
    },
    template: Template
});
