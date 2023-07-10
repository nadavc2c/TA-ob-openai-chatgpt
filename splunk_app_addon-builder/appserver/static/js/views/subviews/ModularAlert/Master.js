import _ from "lodash";
import BaseSubView from "app/views/subviews/BaseSubView";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import ModularAlertSummaryTable from "./ModularAlertTable";
import Template from "contrib/text!./Master.html";

export default BaseSubView.extend({
    initialize: function(options) {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.parentView = options.parentView;
        this.compiledTemplate = _.template(Template);
    },
    render: function() {
        this.$el.html(this.compiledTemplate);
        this.createChild("helpLinkHeader", HelpLinkHeader, {
            title: _.t("Alert Actions"),
            helpLinkKey: "step_alert"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);
        this.createChild("table", ModularAlertSummaryTable, {
            el: this.$(".modular-alert-summary-container"),
            parentView: this
        });
        this.children.table.render();

        this.$("#add-data-btn").click(() => {
            this.controller.navigate({
                view: "modular-alert",
                action: "add",
                params: {
                    collection: this.children.table.collection
                }
            });
        });

        return this;
    }
});
