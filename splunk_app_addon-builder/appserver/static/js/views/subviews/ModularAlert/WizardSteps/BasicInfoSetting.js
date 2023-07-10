import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import { BaseView } from "swc-aob/index";
import { SplunkMvc } from "swc-aob/index";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import MultiSelectInputControl
    from "app/components/controls/MultiSelectInputControlEx";
import IconUploaderView from "app/views/subviews/Home/BasicInfo/IconUploader";
import TechnologyOptionValueTemplate
    from "contrib/text!app/templates/playground/property/technology_option_value.html";
import * as AppInfo from "app/utils/AppInfo";
import * as NameConvertUtil from "app/utils/NameConvertUtil";
import * as SearchManagerUtil from "app/utils/SearchManagerUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import BasicSettingTemplate from "contrib/text!./BasicInfoSetting.html";
import ReactDOM from "react-dom";
import AlertActionProperties from "./alertActionPropertiesComponent.jsx";
import React from "react";

export default BaseView.extend({
    className: "basic_setting_section",
    template: BasicSettingTemplate,
    initialize: function(options) {
        BaseView.prototype.initialize.apply(this, arguments);
        this.model = options.model;
        this.collection = options.collection;
        this.modularInputNames = options.modularInputNames;
        if (this.modularInputNames) {
            this.modularInputNames.fetch().done(
                function() {
                    this.modularInputNames.isFetched = true;
                }.bind(this)
            );
        }
        if (this.model.get("active_response")) {
            this.activeResponseModel = new Backbone.Model(
                this.model.get("active_response")
            );
        } else {
            this.activeResponseModel = new Backbone.Model({
                technology: [],
                supports_adhoc: false
            });
        }
        this.uploadFileModel = new Backbone.Model({
            endpoint: AppInfo.getCustomURLPrefix() + "/app_create/upload_icon"
        });
        this.uploadFileModel.set(this.model.toJSON());
        this.iconUrlPrefix =
            "/" +
            AppInfo.getLocale() +
            "/static/app/" +
            AppInfo.getCurrentApp() +
            "/img/icon/playground/";
        this.searches = {};
        this._initializeToken();
        this._initializeSearch();

        this.onPropertiesChange = this.onPropertiesChange.bind(this);
        this.errorModel = new Backbone.Model();
        this.isTouchedMap = {};
        this.VALIDATORS = {
            short_name: valueInternal => {
                let msg = null;
                if (!valueInternal) {
                    msg = MessageUtil.getFormattedMessage(10100, "Name");
                } else if (!valueInternal.match(/^\w+$/)) {
                    msg = MessageUtil.getFormattedMessage(10102, "Name");
                } else if (
                    !this.model.get("uuid") && this.collection &&
                    _.find(this.collection.models, function(model) {
                        return model.get("short_name") === valueInternal;
                    })
                ) {
                    msg = MessageUtil.getFormattedMessage(10104, "Name");
                } else {
                    if (
                        this.modularInputNames &&
                        this.modularInputNames.isFetched
                    ) {
                        if (
                            _.indexOf(
                                this.modularInputNames.get("input_names"),
                                valueInternal
                            ) > -1
                        ) {
                            msg = MessageUtil.getFormattedMessage(
                                10106,
                                valueInternal
                            );
                        }
                    }
                }
                return msg;
            },
            label: valueDisplay => {
                let msg = null;
                if (!valueDisplay) {
                    msg = MessageUtil.getFormattedMessage(10100, "Label");
                }
                return msg;
            }
        };
    },
    remove() {
        ReactDOM.unmountComponentAtNode(this.$("#input_name")[0]);
        BaseView.prototype.remove.apply(this, arguments);
    },
    onPropertiesChange(attr, value) {
        let model = this.model;
        let attrs = {
            [attr]: value
        };
        this.isTouchedMap[attr] = true;
        if (attr === "label") {
            if (!this.isTouchedMap["short_name"]) {
                attrs["short_name"] = NameConvertUtil.convertNameToInternalName(
                    value
                );
            }
        }
        model.set(attrs);
        this.validateModel();
        this.renderInputProps();
    },

    renderInputProps() {
        ReactDOM.render(
            <AlertActionProperties
                { ...this.model.toJSON() }
                onPropertiesChange={ this.onPropertiesChange }
                errors={ this.errorModel.toJSON() }
            />,
            this.$("#input_name")[0]
        );
    },
    validateModel(strict = false) {
        const model = this.model;
        const isTouchedMap = this.isTouchedMap;
        const errorModel = this.errorModel;
        errorModel.clear();

        _.map(["short_name", "label"], attr => {
            let msg = null;
            if (strict || isTouchedMap[attr]) {
                if (_.isFunction(this.VALIDATORS[attr])) {
                    msg = this.VALIDATORS[attr](model.get(attr).trim());
                }
            }
            if (msg) {
                errorModel.set(attr, msg);
            } else {
                errorModel.unset(attr);
            }
        });
    },

    _initializeSearch: function() {
        this.searches.categorySearch = SearchManagerUtil.getOrCreateSearchManager(
            {
                id: "arf_category_search",
                search: "| inputlookup cam_categories.csv",
                auto_cancel: 1800,
                autostart: false
            }
        );
        this.categorySearchResult = this.searches.categorySearch.data(
            "results"
        );

        this.searches.taskSearch = SearchManagerUtil.getOrCreateSearchManager({
            id: "arf_task_search",
            search: "| inputlookup cam_tasks.csv",
            auto_cancel: 1800,
            autostart: false
        });
        this.taskSearchResult = this.searches.taskSearch.data("results");

        this.searches.subjectSearch = SearchManagerUtil.getOrCreateSearchManager(
            {
                id: "arf_subject_search",
                search: "| inputlookup cam_subjects.csv",
                auto_cancel: 1800,
                autostart: false
            }
        );
        this.subjectSearchResult = this.searches.subjectSearch.data("results");

        var that = this;
        this.listenTo(this.categorySearchResult, "data", function() {
            if (that.categoryControlRendered) {
                return;
            }
            var resultArray = that.categorySearchResult.data().rows;
            that.categoryTags = _.map(resultArray, function(array) {
                return array[0];
            });
            if (that.categoryControl) {
                that.categoryControl.setTags(that.categoryTags);
                if (!that.model.get("active_response")) {
                    this.toggleControl(true);
                }
                that.categoryControlRendered = true;
            }
        });

        this.listenTo(this.taskSearchResult, "data", function() {
            if (that.taskControlRendered) {
                return;
            }
            var resultArray = that.taskSearchResult.data().rows;
            that.taskTags = _.map(resultArray, function(array) {
                return array[0];
            });
            if (that.taskControl) {
                that.taskControl.setTags(that.taskTags);
                if (!that.model.get("active_response")) {
                    this.toggleControl(true);
                }
                that.taskControlRendered = true;
            }
        });

        this.listenTo(this.subjectSearchResult, "data", function() {
            if (that.subjectControlRendered) {
                return;
            }
            var resultArray = that.subjectSearchResult.data().rows;
            that.subjectTags = _.map(resultArray, function(array) {
                return array[0];
            });
            if (that.subjectControl) {
                that.subjectControl.setTags(that.subjectTags);
                if (!that.model.get("active_response")) {
                    this.toggleControl(true);
                }
                that.subjectControlRendered = true;
            }
        });

        this.enableNormalSearch();
        this.searches.categorySearch.startSearch(false);
        this.searches.taskSearch.startSearch(false);
        this.searches.subjectSearch.startSearch(false);
    },

    _initializeToken: function() {
        // token
        this.defaultTokenModel = SplunkMvc.Components.get("default", {
            create: true
        });
    },

    enableNormalSearch() {
        this.defaultTokenModel.set({
            earliest_search_time: "-7d",
            latest_search_time: "now",
            search_mode: "normal"
        });
    },

    startListening: function() {
        this.listenTo(
            this.uploadFileModel,
            "change:error",
            this.onUploadErrorChange
        );
        this.listenTo(
            this.uploadFileModel,
            "change:smallIcon",
            this.onUploadSmallIconChange
        );
        this.listenTo(
            this.uploadFileModel,
            "change:largeIcon",
            this.onUploadLargeIconChange
        );
    },

    onUploadErrorChange: function(model, error) {
        if (!error) {
            this.removeErrorMessage(this.$("div[name=logo]"));
            return;
        }
        var fileName = this.uploadFileModel.get("loadingFile").name;
        this.displayErrorMessage(
            this.$("div[name=logo]"),
            MessageUtil.getFormattedMessage(2001, fileName, _.t(error))
        );
    },

    onUploadSmallIconChange: function() {
        this.model.set("smallIcon", this.uploadFileModel.get("smallIcon"));
    },

    onUploadLargeIconChange: function() {
        this.model.set("largeIcon", this.uploadFileModel.get("largeIcon"));
    },

    render: function() {
        var that = this;
        this.$el.html(this.compiledTemplate());
        this.children.helpLinkHeader = new HelpLinkHeader({
            title: _.t("Alert Action Properties"),
            helpLinkKey: "step_alert_basic_setting"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);

        if (this.model.get("short_name") && this.model.get("label")) {
            this.isTouchedMap["short_name"] =
                NameConvertUtil.convertNameToInternalName(
                    this.model.get("label")
                ) !== this.model.get("short_name") || this.model.get("uuid");
        }

        if (!this.model.get("description")) {
            this.model.set("description", "");
        }
        this.renderInputProps();

        if (this.model.get("active_response")) {
            this.$("input[name=modular_alert_arf]").prop("checked", true);
        }
        if (this.activeResponseModel.get("technology").length) {
            this.$(".technology_options").empty();
            _.each(this.activeResponseModel.get("technology"), tech => {
                this.$(".technology_options").append(
                    _.template(TechnologyOptionValueTemplate)({
                        vendor_value: tech.vendor ? tech.vendor : "",
                        product_value: tech.product ? tech.product : "",
                        version_value: tech.version
                            ? tech.version.join(",")
                            : "",
                        iconx: this.iconUrlPrefix + "iconx.png"
                    })
                );
            });
        }
        this.$("input[name=supports_adhoc]").prop(
            "checked",
            this.activeResponseModel.get("supports_adhoc")
        );

        this.$("input[name=drilldown_uri]").val(
            this.activeResponseModel.get("drilldown_uri")
        );

        this.$("input[name=sourcetype]").val(
            this.activeResponseModel.get("sourcetype")
        );

        this.$("textarea[name=description]").blur(function() {
            that.model.set("description", $(this).val());
        });

        // adaptive response checkbox event
        this.$("input[name=modular_alert_arf]").click(function() {
            that.toggleControl(!$(this).is(":checked"));
            if ($(this).is(":checked")) {
                $(this).prop("checked", true);
                if (!that.model.get("active_response")) {
                    that.model.set("active_response", {});
                }
                // set the supports adhoc to checked
                that.$("input[name=supports_adhoc]").prop("checked", true);
                that.activeResponseModel.set("supports_adhoc", true);
            } else {
                // remove error messages if adaptive response is unchecked
                that.removeErrorMessage(
                    that.$("div[name=modularalert-arf-subject]")
                );
                that.removeErrorMessage(that.$(".modular_alert_version"));
                // set the adaptive response property
                $(this).prop("checked", false);
                that.model.unset("active_response");
                // set the supports adhoc to unchecked
                that.$("input[name=supports_adhoc]").prop("checked", false);
                that.activeResponseModel.set("supports_adhoc", false);
            }
        });

        // vendor, product and version validation event
        this.$("input[name=modular_alert_vendor]")
            .blur(function() {
                var element = $(this);
                if (!element.val()) {
                    that.displayErrorMessage(
                        that.$(".modular_alert_version"),
                        MessageUtil.getFormattedMessage(10100, "Vendor")
                    );
                } else {
                    if (that.activeResponseModel.get("technology").length) {
                        that.activeResponseModel.get(
                            "technology"
                        )[0].vendor = element.val();
                    } else {
                        that.activeResponseModel
                            .get("technology")
                            .push({ vendor: element.val() });
                    }
                }
            })
            .focus(() => {
                // remove corresponding error message
                _.each(
                    this.$(".modular_alert_version").nextAll(".error_message"),
                    function(error) {
                        if (error.innerText.indexOf("Vendor") > -1) {
                            $(error).remove();
                        }
                    }
                );
            });
        this.$("input[name=modular_alert_product]")
            .blur(function() {
                var element = $(this);
                if (!element.val()) {
                    that.displayErrorMessage(
                        that.$(".modular_alert_version"),
                        MessageUtil.getFormattedMessage(10100, "Product")
                    );
                } else {
                    if (that.activeResponseModel.get("technology").length) {
                        that.activeResponseModel.get(
                            "technology"
                        )[0].product = element.val();
                    } else {
                        that.activeResponseModel
                            .get("technology")
                            .push({ product: element.val() });
                    }
                }
            })
            .focus(() => {
                // remove corresponding error message
                _.each(
                    this.$(".modular_alert_version").nextAll(".error_message"),
                    function(error) {
                        if (error.innerText.indexOf("Product") > -1) {
                            $(error).remove();
                        }
                    }
                );
            });
        this.$("input[name=modular_alert_version]")
            .blur(function() {
                var element = $(this);
                if (!element.val()) {
                    that.displayErrorMessage(
                        that.$(".modular_alert_version"),
                        MessageUtil.getFormattedMessage(10100, "Version")
                    );
                } else if (!element.val().match(/^[0-9\.]+$/)) {
                    that.displayErrorMessage(
                        that.$(".modular_alert_version"),
                        MessageUtil.getFormattedMessage(10103, "Version")
                    );
                } else {
                    if (that.activeResponseModel.get("technology").length) {
                        that.activeResponseModel.get(
                            "technology"
                        )[0].version = element.val().split(",");
                    } else {
                        that.activeResponseModel
                            .get("technology")
                            .push({ version: element.val().split(",") });
                    }
                }
            })
            .focus(() => {
                // remove corresponding error message
                _.each(
                    this.$(".modular_alert_version").nextAll(".error_message"),
                    function(error) {
                        if (error.innerText.indexOf("Version") > -1) {
                            $(error).remove();
                        }
                    }
                );
            });
        // supports_adhoc checbox click event
        this.$("input[name=supports_adhoc]").click(function() {
            var element = $(this);
            if (element.is(":checked")) {
                element.prop("checked", true);
                that.activeResponseModel.set("supports_adhoc", true);
            } else {
                element.prop("checked", false);
                that.activeResponseModel.set("supports_adhoc", false);
            }
        });
        // customer drilldown uri event
        this.$("input[name=drilldown_uri]").blur(function() {
            that.activeResponseModel.set("drilldown_uri", $(this).val());
        });
        // sourcetype event
        this.$("input[name=sourcetype]")
            .blur(function() {
                var element = $(this);
                if (element.val() && !element.val().match(/^[\w\-:]{0,50}$/)) {
                    that.displayErrorMessage(
                        element.parent(),
                        MessageUtil.getFormattedMessage(10109, "Sourcetype")
                    );
                    return;
                } else if (element.val()) {
                    that.activeResponseModel.set("sourcetype", element.val());
                } else if (!element.val()) {
                    that.activeResponseModel.unset("sourcetype");
                }
            })
            .focus(function() {
                that.removeErrorMessage($(this).parent());
            });
        // technology option add action
        this.$("#add_new_technology").click(() => {
            this.$(".technology_options").append(
                _.template(TechnologyOptionValueTemplate)({
                    vendor_value: "",
                    product_value: "",
                    version_value: "",
                    iconx: this.iconUrlPrefix + "iconx.png"
                })
            );
            this.$(".technology_option a").click(function(e) {
                e.preventDefault();
                $(e.target).closest(".technology_option").remove();
            });
        });
        // technology option delete action
        this.$(".technology_option a").click(function(e) {
            e.preventDefault();
            $(e.target).closest(".technology_option").remove();
        });

        // Icon upload
        var iconUploaderView = new IconUploaderView({
            model: this.uploadFileModel,
            uploadBtnText: "Upload my icon",
            maxFileSize: 1 * 1024 * 1024,
            showProgress: false
        });

        this.$(".modularalert-input.logo").append(
            iconUploaderView.render().$el
        );
        if (!this.model.get("smallIcon")) {
            iconUploaderView.setDefaultIcon("alerticon.png");
        }

        this.categoryControl = new MultiSelectInputControl({
            el: this.$("div[name=modularalert-arf-group]"),
            model: this.activeResponseModel,
            modelAttribute: "category",
            tags: this.categoryTags || []
        });
        this.taskControl = new MultiSelectInputControl({
            el: this.$("div[name=modularalert-arf-task]"),
            model: this.activeResponseModel,
            modelAttribute: "task",
            tags: this.taskTags || []
        });
        this.subjectControl = new MultiSelectInputControl({
            el: this.$("div[name=modularalert-arf-subject]"),
            model: this.activeResponseModel,
            modelAttribute: "subject",
            tags: this.subjectTags || []
        });

        this.categoryControl.render();
        this.taskControl.render();
        this.subjectControl.render();

        // validation events
        this.categoryControl.on("change", () => {
            this.validate(this.categoryControl, "Category");
        });
        this.taskControl.on("change", () => {
            this.validate(this.taskControl, "Task");
        });
        this.subjectControl.on("change", () => {
            this.validate(this.subjectControl, "Subject");
        });

        // enable the adaptive response when edit
        if (this.model.get("active_response")) {
            this.toggleControl(false);
        } else {
            this.toggleControl(true);
        }
        this.$('[data-toggle="tooltip"]').tooltip();
        this.startListening();
        return this;
    },

    toggleControl: function(flag) {
        if (flag) {
            this.$(".arf_field_block").css("color", "#9b9b9b");
        } else {
            this.$(".arf_field_block").css("color", "#333");
        }
        this.$('.modularalert-arf-field input[type="checkbox"]').prop(
            "disabled",
            flag
        );
        this.$(".modularalert-arf-field input").prop("disabled", flag);
    },

    validate: function(controller, field) {
        if (controller.getValue() && !controller.getValue().length) {
            this.displayErrorMessage(
                this.$("div[name=modularalert-arf-subject]"),
                MessageUtil.getFormattedMessage(10100, field)
            );
        } else {
            // remove corresponding error message
            _.each(
                this.$("div[name=modularalert-arf-subject]").nextAll(
                    ".error_message"
                ),
                function(error) {
                    if (error.innerText.indexOf(field) > -1) {
                        $(error).remove();
                    }
                }
            );
        }
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
    }
});
