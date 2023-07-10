import _ from "lodash";
import Backbone from "backbone";
import Template
    from "contrib/text!app/views/subviews/SharedSettings/AccountSettings.html";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import EditableTable from "app/components/tables/editable_table";

const ProxySettingsView = BaseSubViewComponent.extend({
    template: Template,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        // this.accountCollection = new Backbone.Collection();
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        const model = this.model;

        this.createChild("accountTable", EditableTable, {
            collection: model,
            columnNames: new Backbone.Collection([
                {
                    name: "username",
                    label: _.t("Username"),
                    control: "text"
                },
                {
                    name: "password",
                    label: _.t("Password"),
                    control: "password"
                }
            ])
        });
        this.$(".form-indent-section").append(
            this.children.accountTable.render().$el
        );

        return this;
    }
});

export default ProxySettingsView;
