import BaseView from "app/components/BaseView";
import Template from "contrib/text!./TableBody.html";

/**
 * Render a help block with/without help link.
 * @param {String} options.description
 * @param {String} options.url
 */
export default BaseView.extend({
    tagName: "tbody",
    template: Template,
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
        if (options.data != null) {
            this._data = options.data;
        }
        if (options.offset != null) {
            this._offset = options.offset;
        }
        if (options.limit != null) {
            this._limit = options.limit;
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
        var events = this._data.slice(this._offset, this._offset + this._limit);
        this.$el.html(
            this.compiledTemplate({
                header: this.options.header,
                events: events
            })
        );
    }
});
