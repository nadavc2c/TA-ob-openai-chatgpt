import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import { getImgUrl } from "app/utils/ImgUtil";
import BaseSubView from "app/views/subviews/BaseSubView";
import { getFormattedMessage } from "app/utils/MessageUtil";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import AlertTestOutput from "./AlertTestOutput";
import AlertDefinitionTemplate from "contrib/text!./AlertDefinition.html";
import CodeEditor from "app/views/common/CodeEditor";
import ModularAlertCodeGet
    from "app/models/modular_alert/modular_alert_get_code";
import ModularAlertCodeTest
    from "app/models/modular_alert/modular_alert_test_code";
import UpdateModularAlert from "app/models/modular_alert/update_modular_alert";
import CreateModularAlert from "app/models/modular_alert/create_modular_alert";
import GlobalSettings from "app/models/common/global_settings";
import SharedSettingsView from "app/views/subviews/SharedSettings/Master";
import CustomizedSettingsView
    from "app/views/subviews/SharedSettings/CustomizedSettings";
import Collector from "app/profiles/partyjsCollector";
import WaitSpinner from "app/components/WaitSpinner";
import { splunkUtils } from "swc-aob/index";

const AlertDefinition = BaseSubView.extend({
    className: "alert_definition_view",
    initialize: function(options) {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.model = options.model;
        this.collection = options.collection;
        this.stepModel = options.stepModel;
        this.globalSettings = options.globalSettings;
        this.parentView = options.parentView;
        this.children = {};
    },
    render: function() {
        var that = this;
        this.$el.html(
            _.template(AlertDefinitionTemplate)({
                alert_name: this.model.get("short_name"),
                alert_logo: this.model.get("largeIcon")
                    ? `data:image/png;base64,${this.model.get("largeIcon")}`
                    : getImgUrl("alerticon.png")
            })
        );
        this.$(".ta-wait-spinner").each(function() {
            new WaitSpinner({
                el: $(this)
            }).render();
        });
        this.stepModel.trigger("disableNext");
        this.stepModel.trigger("disablePrev");
        this.disableButton();

        this.helpLinkHeader = new HelpLinkHeader({
            title: _.t("Alert Action Definition"),
            helpLinkKey: "step_alert_action_definition"
        });
        this.$(".alert_definition_title").append(
            this.helpLinkHeader.render().$el
        );

        this.outputArea = new AlertTestOutput();
        this.$(".ta-test-output-container").append(
            this.outputArea.render().$el
        );

        this.codeEditor = new CodeEditor();
        this.$(".ta-code-editor-container").append(
            this.codeEditor.render().$el
        );
        //render the configed variables
        let collection = (this.paramCollection = new Backbone.Collection(
            this.model.get("parameters")
        ));
        this.children.customizedSettings = new CustomizedSettingsView({
            collection: collection
        });
        this.listenTo(collection, "change:value", (m, value) => {
            this.model.get("parameters")[collection.indexOf(m)].value = value;
        });
        this.$("#modular_alert_definition").append(
            this.children.customizedSettings.render().$el
        );

        this.children.sharedSettings = new SharedSettingsView({
            model: this.globalSettings
        });
        let dfd = $.Deferred();
        dfd.done(() => {
            // get code based on configuration
            let modularAlertCodeGet = new ModularAlertCodeGet({
                code: this.model.get("code") ? this.model.get("code") : "",
                model: this.model.toJSON(),
                global_settings: this.globalSettings.toJSON()
            });
            modularAlertCodeGet.save(
                {},
                {
                    success: response => {
                        this.codeEditor.setValue(response.get("code"));
                        this.stepModel.trigger("enableNext");
                        this.stepModel.trigger("enablePrev");
                        this.enableButton();
                    },
                    error: () => {
                        this.showError(
                            "Error in getting the code."
                        );
                    },
                    'headers': {
                        'X-Splunk-Form-Key': splunkUtils.getFormKey()
                    }
                }
            );
        });
        this.$("#global_definition").append(
            this.children.sharedSettings.render(dfd).$el
        );

        this.$(
            ".ta-test-code-arrows.pull-left i.icon-arrow-left"
        ).click(function() {
            that.$(".ta-alert-parameters-container").hide();
            that.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-left i.icon-arrow-right").show();
            $(this).hide();
        });
        this.$(
            ".ta-test-code-arrows.pull-left i.icon-arrow-right"
        ).click(function() {
            that.$(".ta-alert-parameters-container").show();
            that.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-left i.icon-arrow-left").show();
            $(this).hide();
        });

        this.$(
            ".ta-test-code-arrows.pull-right i.icon-arrow-left"
        ).click(function() {
            that.$(".ta-test-output-container").show();
            that.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-right i.icon-arrow-right").show();
            $(this).hide();
        });
        this.$(
            ".ta-test-code-arrows.pull-right i.icon-arrow-right"
        ).click(function() {
            that.$(".ta-test-output-container").hide();
            that.codeEditor.resize();
            that.$(".ta-test-code-arrows.pull-right i.icon-arrow-left").show();
            $(this).hide();
        });
        // Save button click event
        this.$("#save_code").click(function() {
            var save_button = $(this);
            save_button.prop("disabled", true);
            that.$(".save_process").show();
            // set the code
            that.model.set("code", that.codeEditor.getValue());
            var modularAlertModel;
            //  save the modualr alert
            if (that.model.get("uuid")) {
                modularAlertModel = new UpdateModularAlert({
                    modular_alert: that.model.toJSON(),
                    global_settings: that.globalSettings.toJSON()
                });
            } else {
                modularAlertModel = new CreateModularAlert({
                    modular_alert: that.model.toJSON(),
                    global_settings: that.globalSettings.toJSON()
                });
            }
            that.stepModel.trigger("disableNext");

            // save global configuration
            var globalSettingsModel = new GlobalSettings(
                that.globalSettings.toJSON()
            );
            // save modular alert fisrt, then, save global setting
            modularAlertModel
                .save()
                .then(
                    alertResponse => {
                        if (_.has(alertResponse, "err_code")) {
                            return $.Deferred().reject(alertResponse);
                        }
                        if (
                            alertResponse.status === "success" &&
                            !that.model.get("uuid")
                        ) {
                            let collectedData = _.omit(that.model.toJSON(), [
                                "code",
                                "smallIcon",
                                "largeIcon",
                                "uuid"
                            ]);
                            Collector.collect("track_creation", {
                                type: "modular-alert",
                                data: collectedData
                            });
                            that.model.set("uuid", alertResponse.meta);
                            that.collection.add(modularAlertModel);
                        }
                        return globalSettingsModel.save();
                    },
                    () => {
                        return $.Deferred().reject({
                            err_code: 10111,
                            err_args: {
                                short_name: modularAlertModel.get("short_name")
                            }
                        });
                    }
                )
                .then(
                    response => {
                        if (_.has(response, "err_code")) {
                            return $.Deferred().reject(response);
                        }
                        return true;
                    },
                    error => {
                        let errValue;
                        if (_.has(error, "err_code")) {
                            errValue = error;
                        } else {
                            errValue = {
                                err_code: 11005,
                                err_args: {}
                            };
                        }
                        return $.Deferred().reject(errValue);
                    }
                )
                .always(() => {
                    that.stepModel.trigger("enableNext");
                    save_button.prop("disabled", false);
                    that.$(".save_process").hide();
                    that.$(".test_process").hide();
                })
                .done(() => {
                    that.$("#save_code i").show();
                })
                .fail(error => {
                    that.showError(
                        getFormattedMessage(error.err_code, error.err_args)
                    );
                });
        });
        //Test button click events
        this.$("#test_code").click(function() {
            var test_button = $(this);
            that.$(".test_process").show();
            test_button.prop("disabled", true);

            that.model.set("code", that.codeEditor.getValue());
            that.$(".ta-test-code-arrows.pull-right i.icon-arrow-left").click();

            let configuration = {};
            //Get alert action parameters
            that.paramCollection.each(model => {
                configuration[model.get("name")] = model.get("value");
            });

            var modularAlertCodeTest = new ModularAlertCodeTest({
                model: that.model.toJSON(),
                configuration: configuration,
                code: that.codeEditor.getValue(),
                global_settings: that.globalSettings.toJSON()
            });
            that.outputArea.empty();

            modularAlertCodeTest.save(
                {},
                {
                    success: function(model, response) {
                        that.$(".test_process").hide();
                        test_button.prop("disabled", false);
                        if (response.test_framework.status === 0) {
                            that.outputArea.addHtml(
                                '<b style="margin: 10px;">Test finished. Output and log of the code:</b></br>'
                            );
                            if (
                                response.alert_output &&
                                response.alert_output.stdout
                            ) {
                                that.outputArea.addHtml(
                                    response.alert_output.stdout + "</br>"
                                );
                            }
                            if (
                                response.alert_output &&
                                response.alert_output.stderr
                            ) {
                                if (
                                    response.alert_output.stderr.match(
                                        /^Traceback.*/
                                    ) ||
                                    response.alert_output.stderr.match(
                                        /^Error.*/
                                    )
                                ) {
                                    that.outputArea.addErrorMessage(
                                        response.alert_output.stderr
                                    );
                                } else {
                                    let messages = response.alert_output.stderr.split(
                                        /\n(?=\d{4}-\d{2}-\d{2})/
                                    );
                                    _.each(messages, function(message) {
                                        if (
                                            message &&
                                            (message.match(/\d+\sINFO/) ||
                                                message.match(/\d+\sINFO/))
                                        ) {
                                            that.outputArea.addInfoMessage(
                                                message
                                            );
                                        } else if (
                                            message &&
                                            message.match(/\d+\sWARN/)
                                        ) {
                                            that.outputArea.addWarningMessage(
                                                message
                                            );
                                        } else if (
                                            message &&
                                            message.match(/\d+\sERROR/)
                                        ) {
                                            that.outputArea.addErrorMessage(
                                                message
                                            );
                                        } else if (
                                            message &&
                                            message.match(/\d+\sDEBUG/)
                                        ) {
                                            that.outputArea.addInfoMessage(
                                                message
                                            );
                                        }
                                    });
                                }
                            }
                        } else if (response.test_framework.status === -1) {
                            that.outputArea.addHtml(
                                "<b>Error in testing the code:</b></br>"
                            );
                            that.outputArea.addHtml(
                                response.test_framework.message
                            );
                        }
                        that.outputArea.show();
                    },
                    error: function(model, error) {
                        that.$(".test_process").hide();
                        test_button.prop("disabled", false);

                        that.outputArea.addHtml(
                            "<b>Error in testing the code:</b></br>"
                        );
                        that.outputArea.addHtml(error);
                        that.outputArea.show();
                    },
                    'headers': {
                        'X-Splunk-Form-Key': splunkUtils.getFormKey()
                    }
                }
            );
        });
        return this;
    },

    displayErrorMessage: function(selector, content) {
        var html =
            '<div class="error_message"><i class="icon-warning-sign"></i>' +
            content +
            "</div>";
        selector.after(html);
    },

    removeErrorMessage: function(selector) {
        _.each(selector.nextAll(".error_message"), function(error) {
            $(error).remove();
        });
    },
    disableButton: function() {
        this.$(".ta-btn-test").attr("disabled", "disabled");
        this.$(".ta-btn-save").attr("disabled", "disabled");
    },

    enableButton: function() {
        this.$(".ta-btn-test").removeAttr("disabled");
        this.$(".ta-btn-save").removeAttr("disabled");
    }
});
export default AlertDefinition;
