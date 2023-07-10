import _ from "lodash";
import Backbone from "backbone";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import AccordionGroupView from "app/components/AccordionGroupView";
import ProxySettingsView from "app/views/subviews/SharedSettings/ProxySettings";
import LogSettingsView from "app/views/subviews/SharedSettings/LogSettings";
import AccountSettingsView
    from "app/views/subviews/SharedSettings/AccountSettings";
import CustomizedSettingsView
    from "app/views/subviews/SharedSettings/CustomizedSettings";

function getIndex(collection, model) {
    return collection.indexOf(model);
}

const SharedSettingsView = BaseSubViewComponent.extend({
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.models = {};
    },
    render(dfd) {
        if (this.model.isFetched) {
            this._render();
            dfd && dfd.resolve && dfd.resolve();
        } else {
            this.model.fetch().done(() => {
                dfd && dfd.resolve && dfd.resolve();
                this._render();
                this.model.isFetched = true;
            });
        }
        return this;
    },
    _render() {
        let model = this.model;
        let settings;

        settings = model.get("proxy_settings");
        if (settings) {
            let subModel = (this.models.proxySettings = new Backbone.Model(
                settings
            ));
            this.listenTo(subModel, "change", () => {
                model.set("proxy_settings", subModel.toJSON());
            });
            if (!subModel.has("proxy_type")) {
                subModel.set("proxy_type", "http");
            }
            this.createChild("proxySettings", AccordionGroupView, {
                title: _.t("Proxy"),
                contentView: new ProxySettingsView({
                    model: subModel
                })
            });
            this.$el.append(this.children.proxySettings.render().$el);
        }

        settings = model.get("log_settings");
        if (settings) {
            let subModel = (this.models.logSettings = new Backbone.Model(
                settings
            ));
            this.createChild("logSettings", AccordionGroupView, {
                title: _.t("Logging"),
                contentView: new LogSettingsView({
                    model: subModel
                })
            });
            this.$el.append(this.children.logSettings.render().$el);
            this.listenTo(subModel, "change", () => {
                model.set("log_settings", subModel.toJSON());
            });
        }

        settings = model.get("credential_settings");
        if (settings) {
            if (!_.isArray(settings)) {
                //Backward compatible
                settings = _(settings)
                    .toPairs()
                    .map(pair => {
                        return {
                            username: pair[0],
                            password: pair[1].password
                        };
                    })
                    .value();
            }
            let subModel = (this.models.accountSettings = new Backbone.Collection(
                settings
            ));
            model.set("credential_settings", settings);
            if (subModel.length === 0) {
                subModel.add({
                    username: "",
                    password: ""
                });
            }
            this.createChild("accountSettings", AccordionGroupView, {
                title: _.t("Account"),
                contentView: new AccountSettingsView({
                    model: subModel
                })
            });
            this.$el.append(this.children.accountSettings.render().$el);
            this.listenTo(subModel, "add remove update change", () => {
                model.set(
                    "credential_settings",
                    _.filter(
                        subModel.toJSON(),
                        model => model.username && model.password
                    )
                );
            });
        }

        settings = model.get("customized_settings");
        if (settings && settings.length) {
            let collection = (this.models.customizedSettings = new Backbone.Collection(
                settings
            ));
            this.listenTo(collection, "change:value", (m, value) => {
                model.get("customized_settings")[
                    getIndex(collection, m)
                ].value = value;
            });
            this.createChild("customizedSettings", AccordionGroupView, {
                title: _.t("Additional parameter"),
                contentView: new CustomizedSettingsView({
                    collection: collection
                })
            });
            this.$el.append(this.children.customizedSettings.render().$el);
        }
    }
});

export default SharedSettingsView;
