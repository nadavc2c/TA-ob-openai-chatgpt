import $ from "jquery";
import _ from "lodash";
import "bootstrap";
import { Control } from "swc-aob/index";
import * as RegexUtil from "app/utils/RegexUtil";
import Pagination from "app/components/tables/Pagination";
import TableContent from "./TableContent";

export default Control.extend({
    initialize: function(options) {
        Control.prototype.initialize.apply(this, arguments);
        options.silent = true;
        this.update(options);
        this._currentFilter = "all";
    },
    update: function(options) {
        if (options.eventContents != null) {
            this._eventContents = options.eventContents;
        }
        if (options.regex != null) {
            this._regex = RegexUtil.escapeRegex(options.regex);
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
        var events = this._eventContents;
        if (events.length && this._nonmatchedEvents.length) {
            events = this._nonmatchedEvents;
            this._currentFilter = "nonmatch";
        }
        var total = events.length;
        this._paginationTop = new Pagination({
            offset: 0,
            limit: this._limit,
            total: total
        });
        this.$(".pagination-container-top").html(
            this._paginationTop.render().$el
        );
        this._paginationTop.on("paging", function(data) {
            var offset = data.offset;
            that._paginationTop.setOffset(offset);
            that._tableContent.setOffset(offset);
        });
        this._tableContent = new TableContent({
            eventContents: events,
            regex: this._regex,
            offset: 0,
            limit: this._limit,
            total: events
        });
        this.$(".table-container").html(this._tableContent.render().$el);
        return this;
    },
    calculate: function() {
        var that = this;
        this._matchedEvents = [];
        this._nonmatchedEvents = [];
        var regex = this._regex;
        _(this._eventContents).each(function(event) {
            if (RegexUtil.matchRegex(event, regex)) {
                that._matchedEvents.push(event);
            } else {
                that._nonmatchedEvents.push(event);
            }
        });
    },
    getMatchedEvents: function() {
        return this._matchedEvents;
    },
    getTemplateParas: function() {
        var numOfEvents = this._eventContents.length;
        var matchRatio = 0;
        var nonmatchRatio = 0;
        if (numOfEvents !== 0) {
            matchRatio = Math.floor(
                this._matchedEvents.length / numOfEvents * 100
            );
            nonmatchRatio = 100 - matchRatio;
        }

        var description =
            numOfEvents +
            _.t(" events, ") +
            matchRatio +
            _.t("% matched, ") +
            nonmatchRatio +
            _.t("% unmatched.");

        var hasNonmatch = false;
        if (numOfEvents && this._nonmatchedEvents.length) {
            hasNonmatch = true;
        }
        return {
            description: description,
            hasNonmatch: hasNonmatch
        };
    },
    events: {
        "click .btn-filter": "onFilterButtonClick"
    },
    onFilterButtonClick: function(event) {
        var $target = $(event.currentTarget);
        var filterType = $target.data("name");
        if (filterType === this._currentFilter) {
            return;
        }
        this.$(".btn-filter.active").removeClass("active");
        $target.addClass("active");
        this._currentFilter = filterType;
        var events;
        switch (filterType) {
            case "all":
                events = this._eventContents;
                break;
            case "match":
                events = this._matchedEvents;
                break;
            case "nonmatch":
                events = this._nonmatchedEvents;
                break;
        }
        var total = events.length;
        this._paginationTop.update({
            offset: 0,
            total: total
        });
        this._tableContent.update({
            eventContents: events,
            offset: 0,
            total: total
        });
    },
    highlightField: function(groupIndex, isHighlight) {
        this._tableContent.highlightField(groupIndex, isHighlight);
    },
    template: [
        '<div class="pagination-container-top"></div>',
        '<div class="filter-container-top">',
        '<div class="btn-group btn-group-radio">',
        "<% if (hasNonmatch) { %>",
        '<a class="btn btn-filter" data-name="all"><%- _.t("All") %></a>',
        '<a class="btn btn-filter" data-name="match"><%- _.t("Matches") %></a>',
        '<a class="btn btn-filter active" data-name="nonmatch"><%- _.t("Non-matches") %></a>',
        "<% } else { %>",
        // '<a class="btn btn-filter active" data-name="all"><%- _.t("All") %></a>',
        // '<a class="btn btn-filter" data-name="match"><%- _.t("Matches") %></a>',
        // '<a class="btn btn-filter" data-name="nonmatch"><%- _.t("Non-matches") %></a>',
        "<% } %>",
        "</div>",
        "</div>",
        '<div class="message-container-top">',
        "<%- description %>",
        "</div>",
        '<div class="table-container"></div>'
    ].join("")
});
