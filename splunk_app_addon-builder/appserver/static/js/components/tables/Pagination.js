import $ from "jquery";
import "bootstrap";
import BaseView from "app/components/BaseView";
import Template from "contrib/text!app/components/tables/Pagination.html";

var DEFAULT_DISPLAY = 5;
/**
* Render a radio button group.
* @param {Integer} options.offset Offset of the pagination
* @param {Integer} options.limit Number of the items in one page
* @param {Integer} options.total Total number of the items
* @param {Integer} options.display Number of buttons to be displayed in the pagination
* @fires Pagination#paging
*        @param {Integer} offset Offset value of the buttons being clicked
*/
export default BaseView.extend({
    template: Template,
    initialize: function(options) {
        BaseView.prototype.initialize.apply(this, arguments);
        options = options || {};
        options.silent = true;
        this.update(options);
    },
    update: function(options) {
        if (options.offset != null) {
            this._offset = options.offset;
        }
        if (options.limit != null) {
            this._limit = options.limit;
        }
        if (options.total != null) {
            this._total = options.total;
        }
        if (options.display != null) {
            this._display = options.display;
        }
        if (!this._display) {
            this._display = DEFAULT_DISPLAY;
        }
        this.calculate();
        if (!options.silent) {
            return this.render();
        }
        return this;
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                buttons: this.getButtonConfigs()
            })
        );
        return this;
    },
    setOffset: function(offset) {
        return this.update({
            offset: offset
        });
    },
    events: {
        "click .btn": "onButtonClick"
    },
    onButtonClick: function(event) {
        var $target = $(event.currentTarget);
        var index = $target.data("index");
        if (+index === this._currentPage) {
            return;
        }
        if (index === "prev") {
            index = this._currentPage - 1;
        } else if (index === "next") {
            index = this._currentPage + 1;
        }
        index = Math.max(0, Math.min(this._maxPage, index));
        this.trigger("paging", {
            offset: index * this._limit
        });
    },
    calculate: function() {
        this._total = Math.max(0, this._total);
        this._offset = Math.max(0, Math.min(this._total - 1, this._offset));

        var limit = Math.max(0, Math.min(this._total, this._limit));
        this._maxPage = Math.ceil(this._total / limit) - 1;
        if (isNaN(this._maxPage)) {
            this._maxPage = -1;
        }
        this._realDisplay = Math.max(
            0,
            Math.min(this._maxPage + 1, this._display)
        );
        this._currentPage = Math.floor(this._offset / limit);
        if (isNaN(this._currentPage)) {
            this._currentPage = -1;
        }
        return this;
    },
    getButtonConfigs: function() {
        var disablePrev = false;
        if (this._currentPage === 0) {
            disablePrev = true;
        }
        var disableNext = false;
        if (this._currentPage === this._maxPage) {
            disableNext = true;
        }
        var hasPage = true;
        if (this._currentPage === -1 || this._maxpage === -1) {
            disablePrev = true;
            disableNext = true;
            hasPage = false;
        }
        var configs = [];
        configs.push({
            index: "prev",
            text: "<",
            active: false,
            disabled: disablePrev
        });
        if (hasPage) {
            var currentPage = this._currentPage;
            var halfDisplay = Math.floor(this._realDisplay / 2);
            var start = currentPage - halfDisplay;
            var end = currentPage + halfDisplay;
            if (start < 0) {
                start = 0;
                end = start + this._realDisplay - 1;
            }
            if (end > this._maxPage) {
                end = this._maxPage;
                start = end - this._realDisplay + 1;
            }
            if (end - start + 1 !== this._realDisplay) {
                end = start + this._realDisplay - 1;
            }
            for (var i = start; i <= end; ++i) {
                configs.push({
                    index: i,
                    text: String(i + 1),
                    active: i === currentPage,
                    disabled: false
                });
            }
        }
        configs.push({
            index: "next",
            text: ">",
            active: false,
            disabled: disableNext
        });
        return configs;
    }
});
