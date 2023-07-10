import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import HelpBlockTemplate from "contrib/text!app/views/common/WarningView.html";

/**
 * Render a help block with/without help link.
 * @param {String} options.description
 * @param {String} options.url
 */
export default BaseView.extend({
    className: "modal warning-view",
    template: HelpBlockTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.model = new Backbone.Model({
            content: this.options.content || ""
        });
    },
    render: function() {
        this.$el.html(this.compiledTemplate(this.model.toJSON()));
        return this;
    },
    events: {
        "click .ta-btn-back": "onBackClick"
    },
    onBackClick: function() {
        window.history.back();
    }
});
