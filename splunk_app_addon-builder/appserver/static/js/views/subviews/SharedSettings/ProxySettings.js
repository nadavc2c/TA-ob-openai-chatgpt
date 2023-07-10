import _ from "lodash";
import Template
    from "contrib/text!app/views/subviews/SharedSettings/ProxySettings.html";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import ControlGroupView from "app/components/ControlGroupView";
import { TextControl } from "swc-aob/index";
import { SyntheticCheckboxControl }
    from "swc-aob/index";
import SingleInputControl from "app/components/controls/SingleInputControl";

const LABEL_WIDTH = 150;

const ProxySettingsView = BaseSubViewComponent.extend({
    template: Template,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        const model = this.model;
        this.children.enableProxy = new ControlGroupView({
            label: _.t("Enable proxy"),
            controls: [
                new SyntheticCheckboxControl({
                    model: model,
                    modelAttribute: "proxy_enabled"
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form").append(this.children.enableProxy.render().$el);

        this.children.proxyUrl = new ControlGroupView({
            label: _.t("Proxy host"),
            controls: [
                new TextControl({
                    model: model,
                    modelAttribute: "proxy_url"
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form-indent-section").append(
            this.children.proxyUrl.render().$el
        );

        this.children.proxyPort = new ControlGroupView({
            label: _.t("Proxy port"),
            controls: [
                new TextControl({
                    model: model,
                    modelAttribute: "proxy_port"
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form-indent-section").append(
            this.children.proxyPort.render().$el
        );

        this.children.proxyUsername = new ControlGroupView({
            label: _.t("Proxy username"),
            controls: [
                new TextControl({
                    model: model,
                    modelAttribute: "proxy_username"
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form-indent-section").append(
            this.children.proxyUsername.render().$el
        );

        this.children.proxyPassword = new ControlGroupView({
            label: _.t("Proxy password"),
            controls: [
                new TextControl({
                    model: model,
                    modelAttribute: "proxy_password",
                    password: true
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form-indent-section").append(
            this.children.proxyPassword.render().$el
        );

        this.children.proxyType = new ControlGroupView({
            label: _.t("Proxy type"),
            controls: [
                new SingleInputControl({
                    model: model,
                    modelAttribute: "proxy_type",
                    disableSearch: true,
                    autoCompleteFields: [
                        { value: "http", label: "http" },
                        { value: "socks4", label: "socks4" },
                        { value: "socks5", label: "socks5" }
                    ]
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form-indent-section").append(
            this.children.proxyType.render().$el
        );

        this.children.proxyRDNS = new ControlGroupView({
            label: _.t("Remote DNS resolution"),
            controls: [
                new SyntheticCheckboxControl({
                    model: model,
                    modelAttribute: "proxy_rdns"
                })
            ],
            labelWidth: LABEL_WIDTH
        });
        this.$(".form-indent-section").append(
            this.children.proxyRDNS.render().$el
        );

        return this;
    }
});

export default ProxySettingsView;
