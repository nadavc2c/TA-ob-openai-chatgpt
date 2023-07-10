import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import HelpBlockTemplate
    from "contrib/text!app/components/controls/HelpBlock.html";

/**
 * Render a help block with/without help link.
 * @param {String} options.description
 * @param {String} options.url
 */
export default BaseView.extend({
    tagName: "span",
    className: "help-block",
    template: HelpBlockTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.model = new Backbone.Model({
            description: this.options.description || "",
            url: this.options.url || ""
        });
    },
    render: function() {
        this.$el.html(this.compiledTemplate(this.model.toJSON()));
        return this;
    }
});
