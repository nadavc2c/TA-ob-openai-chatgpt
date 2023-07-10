import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import { JSONTree } from "swc-aob/index";
import EventCellTemplate from "contrib/text!./EventCell.html";

export default BaseView.extend({
    className: "event event-cell",
    tagName: "td",
    template: EventCellTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.state = "json";
    },
    events: {
        "click a.collapse": "onStateControlClick"
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        this.renderStateController();
        this.renderEvent();
        return this;
    },
    renderEvent: function() {
        if (this.children.jsontree) {
            this.children.jsontree.remove();
        }
        if (this.state === "json") {
            this.children.jsontree = new JSONTree({
                json: this.options.content
            });
            this.$(".json-event").html(this.children.jsontree.render().$el);
        } else {
            this.$(".json-event").text(this.options.content);
        }
    },
    renderStateController: function() {
        var aTag = $('<a class="collapse"></a>');
        if (this.state === "json") {
            aTag.html(_.t("Show as raw text"));
        } else if (this.state === "raw") {
            aTag.html(_.t("Show syntax highlighted"));
        }
        this.$(".controller-group").append(aTag);
    },
    onStateControlClick: function() {
        var aTag = this.$(".controller-group a.collapse");
        if (this.state === "json") {
            this.state = "raw";
            aTag.html(_.t("Show syntax highlighted"));
        } else if (this.state === "raw") {
            this.state = "json";
            aTag.html(_.t("Show as raw text"));
        }
        this.renderEvent();
    }
});
