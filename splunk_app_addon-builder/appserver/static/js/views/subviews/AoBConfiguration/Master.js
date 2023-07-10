import $ from "jquery";
import _ from "lodash";
import BaseSubView from "app/views/subviews/BaseSubView";
import PageTemplate
    from "contrib/text!app/views/subviews/AoBConfiguration/Master.html";
import { showDialog } from "app/utils/DialogUtil";
import { getFormattedMessage } from "app/utils/MessageUtil";
import * as LocalStorageUtil from "app/utils/LocalStorageUtil";
import GetGlobalSettings from "app/models/common/get_global_setting";
import SetGlobalSettings from "app/models/common/set_global_setting";
import TestAppCert from "app/models/ta_validation/test_app_cert";
import { getHelpUrl } from "app/utils/HelpLinkUtil";
import Collector from "app/profiles/partyjsCollector";

export default BaseSubView.extend({
    events: {
        "click .proxy-enable-class": function() {
            if (this.$(".proxy-enable-class").is(":checked")) {
                this.$(".proxy-settings-class").removeClass(
                    "ta-proxy-disabled"
                );
                this.$(".proxy-settings-class .ta-config-input-group")
                    .children()
                    .prop("disabled", false);
            } else {
                this.$(".proxy-settings-class").addClass("ta-proxy-disabled");
                this.$(".proxy-settings-class .ta-config-input-group")
                    .children()
                    .prop("disabled", true);
            }
        },
        "click .save-proxy-class": function() {
            this.disableButtons();
            this.clearError();

            this.$(".test-text-class").hide();
            this.$(".save-success-class").show();
            this.$(".save-success-class").html("Saving");
            var settings = this.getUISettings();
            var msg = this.validateSettings(settings);
            if (msg) {
                this.$(".save-success-class").html(msg);
                this.enableButtons();
            } else {
                var model = new SetGlobalSettings();
                model
                    .fetch({
                        data: {
                            settings: JSON.stringify(settings)
                        },
                        type: "POST",
                        reset: true
                    })
                    .done(
                        function(response) {
                            if (response.err_code) {
                                this.showFormattedError(response);
                            } else {
                                this.$(".save-success-class").html(
                                    "Your settings have been saved."
                                );
                                var that = this;
                                if (this.validate_categories) {
                                    showDialog({
                                        el: $("#alert-modal"),
                                        title: _.t("Back to Validation"),
                                        content: getFormattedMessage(29),
                                        btnNoText: _.t("Cancel"),
                                        btnYesText: _.t("Return to Validation"),
                                        yesCallback: function() {
                                            LocalStorageUtil.setValidateCategories(
                                                that.validate_categories
                                            );
                                            that.validate_categories = null;
                                            window.location.href =
                                                "tab_main_flow?view=validation";
                                        }
                                    });
                                }
                            }
                            this.enableButtons();
                        }.bind(this)
                    )
                    .fail(
                        function() {
                            this.$(".save-success-class").html("Save error!");
                            this.enableButtons();
                        }.bind(this)
                    );
            }
        },
        "click .test-app-cert-class": function(event) {
            if ($(event.currentTarget).attr("disabled")) {
                return;
            }
            this.$(".save-success-class").hide();
            this.clearError();
            var settings = this.getUISettings();
            this.testAppCertConnection(settings);
        }
    },
    template: PageTemplate,

    initialize: function() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.model = new GetGlobalSettings();
        this.validate_categories = LocalStorageUtil.getValidateCategories();
        LocalStorageUtil.clearValidateCategories();
        // this.listenTo(this.model, 'sync', this.renderAppCertSettings);
        this.$el.addClass("ta-configuration");
    },
    renderAppCertSettings: function(appCertConf) {
        this.$('input[name="app_cert_user"]').val(appCertConf.username);
        this.$('input[name="app_cert_pwd"]').val(appCertConf.password);

        var proxy_enabled = appCertConf.proxy_enabled;
        if (proxy_enabled) {
            this.$(".proxy-settings-class").removeClass("ta-proxy-disabled");
            this.$(".proxy-settings-class .ta-config-input-group")
                .children()
                .prop("disabled", false);
            this.$(".proxy-enable-class").attr("checked", true);
        } else {
            this.$(".proxy-settings-class").addClass("ta-proxy-disabled");
            this.$(".proxy-settings-class .ta-config-input-group")
                .children()
                .prop("disabled", true);
            this.$(".proxy-enable-class").attr("checked", false);
        }

        this.$(".proxy-type-class").val(appCertConf.proxy_type);
        this.$('input[name="app_cert_proxy_host"]').val(appCertConf.proxy_host);
        this.$('input[name="app_cert_proxy_port"]').val(appCertConf.proxy_port);
        this.$('input[name="app_cert_proxy_user"]').val(
            appCertConf.proxy_username
        );
        this.$('input[name="app_cert_proxy_pwd"]').val(
            appCertConf.proxy_password
        );
    },

    render: function() {
        this.$el.empty();
        this.$el.html(
            this.compiledTemplate({
                helpUrl: getHelpUrl("home_configuration")
            })
        );
        // this.createChild('helpLinkHeader', HelpLinkHeader, {
        //     title: _.t('Configuration'),
        //     helpLinkKey: 'home_configuration'
        // });
        // this.$el.prepend(this.children.helpLinkHeader.render().$el);
        var toggler = new Collector.Views.Toggler({
            learnMoreLink: Collector.HELPLINK_ID
        });
        toggler.render().$el.appendTo(this.$("#partyjs_configuration"));

        this.$(".proxy-settings-class .ta-config-input-group")
            .children()
            .prop("disabled", true);
        this.$(".save-success-class").hide();
        this.$(".test-text-class").hide();
        this.model
            .fetch({
                type: "GET",
                reset: true
            })
            .done(response => {
                if (response.err_code) {
                    this.showFormattedError(response);
                } else {
                    var data = this.model.get("data");
                    var appCertConf = data.app_cert;
                    this.renderAppCertSettings(appCertConf);
                    // test App Cert connection when username & password exists
                    if (appCertConf.username && appCertConf.password)
                        {this.testAppCertConnection(data);}
                }
            });
        return this;
    },

    getUISettings: function() {
        return {
            app_cert: {
                username: this.$('input[name="app_cert_user"]').val().trim(),
                password: this.$('input[name="app_cert_pwd"]').val().trim(),
                proxy_enabled: this.$(".proxy-enable-class").is(":checked"),
                proxy_type: (this.$(".proxy-type-class").val() || "HTTP")
                    .trim(),
                proxy_host: this.$('input[name="app_cert_proxy_host"]')
                    .val()
                    .trim(),
                proxy_port: this.$('input[name="app_cert_proxy_port"]')
                    .val()
                    .trim(),
                proxy_username: this.$('input[name="app_cert_proxy_user"]')
                    .val()
                    .trim(),
                proxy_password: this.$('input[name="app_cert_proxy_pwd"]')
                    .val()
                    .trim()
            }
        };
    },

    testAppCertConnection: function(settings) {
        var msg = this.validateSettings(settings);
        this.disableButtons();
        this.$(".test-text-class").show();
        // check the username & password not NaN
        if (msg) {
            this.$(".test-text-class").html(msg);
            this.enableButtons();
            return;
        }

        this.$(".test-text-class").html("Testing the connection...");
        var testModel = new TestAppCert();
        testModel
            .fetch({
                data: {
                    settings: JSON.stringify(settings)
                },
                type: "POST",
                reset: true
            })
            .done(response => {
                if (response.err_code) {
                    // this.showFormattedError(response);
                    msg = getFormattedMessage(response.err_code);
                    this.$(".test-text-class").html(
                        '<i class="icon-error"></i>' + msg
                    );
                } else {
                    this.$(".test-text-class").html(
                        '<i class="icon-box-checked"></i>Login to the Splunk App Certification service was successful.'
                    );
                }
                this.enableButtons();
            });
    },

    disableButtons: function() {
        this.$(".save-proxy-class").attr("disabled", true);
        this.$(".test-app-cert-class").attr("disabled", true);
    },

    enableButtons: function() {
        this.$(".save-proxy-class").attr("disabled", false);
        this.$(".test-app-cert-class").attr("disabled", false);
    },

    validateSettings: function(settings) {
        var app_cert = settings.app_cert;
        // check the mandatory fields
        if (!app_cert.username) {
            return getFormattedMessage(6000, { field: "Username" });
        }
        if (!app_cert.password) {
            return getFormattedMessage(6000, { field: "Password" });
        }

        if (app_cert.proxy_enabled) {
            // check proxy_host
            var httpPatt = new RegExp("^https?://", "i");
            var hostPatt = new RegExp("^[\\w\\.\\-\\/]+$");
            if (httpPatt.test(app_cert.proxy_host)) {
                return getFormattedMessage(6002, { field: "Proxy Host" });
            }

            if (!hostPatt.test(app_cert.proxy_host)) {
                return getFormattedMessage(6009, { field: "Proxy Host" });
            }
            // check proxy_credential
            if (app_cert.proxy_password && !app_cert.proxy_username) {
                return getFormattedMessage(6000, { field: "Proxy Username" });
            }
            // check proxy_port
            var portPatt = new RegExp("^\\d{1,5}$");
            var val = parseInt(app_cert.proxy_port, 10);
            if (
                !portPatt.test(app_cert.proxy_port) ||
                isNaN(val) ||
                val < 1 ||
                val > 65535
            ) {
                return getFormattedMessage(6003);
            }
        }
    }
});
