import _ from "lodash";
import BaseSubView from "app/views/subviews/BaseSubView";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import DataInputSummaryTable
    from "app/views/subviews/ConfigureDataInput/DataInputTable/Master";
import Template
    from "contrib/text!app/views/subviews/ConfigureDataInput/Master.html";

export default BaseSubView.extend({
    template: Template,
    initialize: function() {
        BaseSubView.prototype.initialize.apply(this, arguments);
    },
    events: {
        "click #add-data-btn": "onAddDataClick"
        // 'click #configure-setup-info-btn': 'onConfigureClick',
    },
    render: function() {
        this.$el.html(this.compiledTemplate());
        this.createChild("helpLinkHeader", HelpLinkHeader, {
            title: _.t("Configure Data Collection"),
            helpLinkKey: "step_datainput"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);
        this.createChild("table", DataInputSummaryTable, {
            el: this.$(".ta-input-summary-container"),
            parentView: this
        });
        this.children.table.render();
        return this;
    },
    onAddDataClick: function() {
        this.controller.navigate({
            view: "data-collection",
            action: "add"
        });
    }
});
