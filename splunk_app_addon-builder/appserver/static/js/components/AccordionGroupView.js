import $ from "jquery";
import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import AccordionGroupViewTemplate
    from "contrib/text!app/components/AccordionGroupView.html";

export default BaseView.extend({
    className: "ta-accordion-group",
    template: AccordionGroupViewTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.title = this.options.title || "";
        this.children.content = this.options.contentView || new Backbone.View();
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                title: this.title
            })
        );
        this.$(".ta-accordion-inner").append(
            this.children.content.render().$el
        );
        return this;
    },
    events: {
        "click .ta-accordion-heading": "onAccordionClick"
    },
    onAccordionClick: function(event) {
        event.preventDefault();
        var $target = $(event.currentTarget);
        if ($target.attr("disabled")) {
            return;
        }
        this.$(".ta-icon-accordion-toggle")
            .toggleClass("icon-chevron-right")
            .toggleClass("icon-chevron-down");
        this.$el
            .toggleClass("active")
            .find(".ta-accordion-inner")
            .slideToggle(200);
    }
});
