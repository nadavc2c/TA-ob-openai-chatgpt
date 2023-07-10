import BaseView from "app/components/BaseView";
import { getHelpLinkObj } from "app/utils/HelpLinkUtil";
import Template from "contrib/text!app/components/controls/HelpLinkHeader.html";

/**
 * Render a help block with/without help link.
 * @param {String} options.description
 * @param {String} options.url
 */
export default BaseView.extend({
    className: "ta-help-link-header",
    template: Template,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        if (this.options.helpLinkKey != null) {
            this.model.set(getHelpLinkObj(this.options.helpLinkKey));
        } else {
            this.model.set({
                description: this.options.description || "",
                url: this.options.url || ""
            });
        }
        this.model.set("title", this.options.title);
    },
    render: function() {
        this.$el.html(this.compiledTemplate(this.model.toJSON()));
        if (!this.model.get("description") && !this.model.get("url")) {
            this.$el.addClass("no-description");
        }
        return this;
    }
});
