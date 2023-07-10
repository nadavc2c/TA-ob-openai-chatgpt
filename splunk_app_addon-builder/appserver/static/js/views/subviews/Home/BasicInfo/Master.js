import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import * as AppInfo from "app/utils/AppInfo";
import * as MessageUtil from "app/utils/MessageUtil";
import CurrentTa from "app/models/flow_wizard/current_ta";
import ControlGroupView from "app/components/ControlGroupView";
import EditableTextControl from "app/components/controls/EditableTextControl";
import { TextControl } from "swc-aob/index";
import { TextareaControl } from "swc-aob/index";
import { SyntheticCheckboxControl } from "swc-aob/index";
import ColorPickerControl from "app/components/controls/ColorPickerControl";
import BaseSubView from "app/views/subviews/BaseSubView";
import IconUploaderView from "./IconUploader";
import BasicProjectInfo from "app/models/step_view/name_project/basic_project_info";
import Collector from "app/profiles/partyjsCollector";
import Template from "contrib/text!./Master.html";
import React from "react";
import ReactDOM from "react-dom";
import ErrorBanner from "app/views/common/ErrorBanner.jsx";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import { KeyboardUtil } from "swc-aob/index";
import { splunkUtils } from "swc-aob/index";

const LABEL_WIDTH = 190;
const loadingtag = $(
    '<div style="height:100%;width:100%;background-color:white;position:absolute;z-index:2;opacity:0.2;"></div>'
);
const SPLUNK_TA_PREFIX = "Splunk_TA_";
const TA_PREFIX = "TA-";

function shouldSyncProjectNames(friendlyName, projectName) {
    let suffix = _.replace(friendlyName.toLowerCase(), /\s/g, "-");
    return projectName === TA_PREFIX + suffix || projectName === SPLUNK_TA_PREFIX + suffix;
}

export default BaseSubView.extend({
    className: "ta-sub-view-basic-info",
    template: Template,

    initialize: function() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.model = new BasicProjectInfo();
        this.visibleAttributeModel = new Backbone.Model({ visible: 0 });
        this.uploadFileModel = new Backbone.Model({
            endpoint: AppInfo.getCustomURLPrefix() + "/app_create/upload_icon"
        });
    },
    remove() {
        ReactDOM.unmountComponentAtNode(this.parentView.$(".modal-error .showError")[0]);
        BaseSubView.prototype.remove.apply(this, arguments);
    },
    startListening: function() {
        this.listenTo(this.uploadFileModel, "change:error", this.onUploadErrorChange);
        this.listenTo(this.uploadFileModel, "change:smallIcon", this.onUploadSmallIconChange);
        this.listenTo(this.uploadFileModel, "change:largeIcon", this.onUploadLargeIconChange);
        this.listenTo(this.model, "change:projectName", this.onProjectNameChange);
        this.listenTo(this.model, "change:friendlyName", this.onFriendlyNameChange);
        this.listenTo(this.model, "change:projectAuthor", this.onAuthorChange);
        let control = this.children.projectName.controls[0];
        this.listenTo(control, "enterEditing", this.onEditEnter);
        this.listenTo(control, "exitEditing", this.onEditExit);
        this.listenTo(control, "beforeConfirm", this.onEditBeforeConfirm);

        this.listenTo(this.visibleAttributeModel, "change:visible", this.onVisibleAttributeChange);
    },

    onVisibleAttributeChange: function() {
        var isSetupEnabled = this.model.isSetupEnabled();
        if (!isSetupEnabled) {
            this.model.set("visible", this.visibleAttributeModel.get("visible", 0));
        }
    },

    onUploadErrorChange: function(model, error) {
        if (!error) {
            this.clearError();
            return;
        }
        var fileName = this.uploadFileModel.get("loadingFile").name;
        this.showFormattedError(2001, fileName, _.t(error));
    },
    onUploadSmallIconChange: function() {
        this.model.set("smallIcon", this.uploadFileModel.get("smallIcon"));
    },
    onUploadLargeIconChange: function() {
        this.model.set("largeIcon", this.uploadFileModel.get("largeIcon"));
    },

    render: function() {
        this._startNamingSync = true;
        var app = this.parentView.getAppName();
        if (!app) {
            this._isCreation = true;
            this.parentView.disableYesBtn();
        } else {
            this.model.fetch({
                data: {
                    app_name: app
                },
                async: false
            });
            this._startNamingSync = shouldSyncProjectNames(
                this.model.get("friendlyName", ""),
                this.model.get("projectName", "")
            );
            if (this.model.isSetupEnabled()) {
                this.visibleAttributeModel.set("visible", 1);
            } else {
                this.visibleAttributeModel.set("visible", this.model.get("visible"));
            }
        }
        this.uploadFileModel.set(this.model.toJSON());
        this.$el.html(this.compiledTemplate({}));
        let $container = this.$(".ta-basic-project-info-section");
        let child;
        child = this.createChild("previousProjectName", TextControl, {
            model: this.model,
            modelAttribute: "previousProjectName"
        });
        child.render().$el.appendTo($container).hide();

        let tempControl;
        const onInputKeydown = this.onInputKeydown.bind(this);

        tempControl = new TextControl({
            model: this.model,
            modelAttribute: "friendlyName",
            placeholder: _.t("Add-on Name"),
            updateOnKeyUp: true
        });
        child = this.createChild("friendlyName", ControlGroupView, {
            required: true,
            label: _.t("Add-on Name:"),
            labelWidth: LABEL_WIDTH,
            controls: [tempControl]
        });
        child.render().$el.appendTo($container);
        tempControl.$input.off("keydown", onInputKeydown).on("keydown", onInputKeydown);

        tempControl = new TextControl({
            model: this.model,
            modelAttribute: "projectAuthor",
            placeholder: _.t("Add-on Author"),
            updateOnKeyUp: true
        });
        child = this.createChild("projectAuthor", ControlGroupView, {
            label: _.t("Author:"),
            labelWidth: LABEL_WIDTH,
            controls: [tempControl]
        });
        child.render().$el.appendTo($container);
        tempControl.$input.off("keydown", onInputKeydown).on("keydown", onInputKeydown);

        child = this.createChild("projectName", ControlGroupView, {
            label: _.t("Add-on Folder Name:"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new EditableTextControl({
                    model: this.model,
                    modelAttribute: "projectName",
                    editLinkText: _.t("Edit")
                })
            ]
        });
        child.render().$el.appendTo($container);

        tempControl = new TextControl({
            model: this.model,
            modelAttribute: "projectVersion",
            placeholder: _.t("1.0.0")
        });
        child = this.createChild("projectVersion", ControlGroupView, {
            label: _.t("Version:"),
            labelWidth: LABEL_WIDTH,
            controls: [tempControl]
        });
        child.render().$el.appendTo($container);
        tempControl.$input.off("keydown", onInputKeydown).on("keydown", onInputKeydown);

        child = this.createChild("projectDescription", ControlGroupView, {
            label: _.t("Description:"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new TextareaControl({
                    model: this.model,
                    modelAttribute: "projectDescription",
                    placeholder: _.t("Add-on Description")
                })
            ]
        });
        child.render().$el.appendTo($container);

        child = this.createChild("visible", ControlGroupView, {
            label: _.t("Visible:"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new SyntheticCheckboxControl({
                    model: this.visibleAttributeModel,
                    modelAttribute: "visible",
                    enabled: !this.model.isSetupEnabled()
                })
            ]
        });
        child.render().$el.appendTo($container);

        child = this.createChild("icon", ControlGroupView, {
            label: _.t("Icon:"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new IconUploaderView({
                    model: this.uploadFileModel,
                    uploadBtnText: "Upload my icon",
                    maxFileSize: 1 * 1024 * 1024,
                    showProgress: false
                })
            ]
        });
        child.render().$el.appendTo($container);
        if (!this._isCreation) {
            child.controls[0].setSmallIcon(this.model.get("smallIcon"));
            child.controls[0].setLargeIcon(this.model.get("largeIcon"));
        }

        child = this.createChild("themeColor", ControlGroupView, {
            label: _.t("Theme Color:"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new ColorPickerControl({
                    model: this.model,
                    modelAttribute: "themeColor",
                    paletteColors: [
                        "#65A637",
                        "#f07a35",
                        "#297ba5",
                        "#4fa484",
                        "#b6c75a",
                        "#3c6188",
                        "#ec9960",
                        "#a65c7d",
                        "#708794",
                        "#38b8bf",
                        "#ffde63",
                        "#c19975"
                    ],
                    popContainer: this.$el
                })
            ]
        });
        child.render().$el.appendTo($container);

        this.startListening();

        return this;
    },
    onEditEnter: function() {
        this.parentView.disableYesBtn();
    },
    onEditExit: function(result) {
        this.parentView.enableYesBtn();
        this.validateName();
        if (_.has(result, "value")) {
            this._startNamingSync = shouldSyncProjectNames(this.model.get("friendlyName", ""), result.value);
        }
    },
    onEditBeforeConfirm: function(result) {
        let msg = this.model.validateProjectName(result.value);
        if (msg) {
            this.showError(msg);
            result.stop = true;
        } else {
            this.clearError(msg);
        }
    },
    onInputKeydown: function(event) {
        if (event.keyCode === KeyboardUtil.KEYS["ENTER"]) {
            event.preventDefault();
            event.stopPropagation();
            $(event.currentTarget).blur();
            this.parentView.onYesClick(event);
        }
    },
    validateName: function() {
        let msg = this.model.validateName();
        if (msg) {
            this.showError(msg);
            this.parentView.disableYesBtn();
        } else {
            this.clearError();
            if (this.children.projectName.controls[0].isEditing()) {
                this.parentView.disableYesBtn();
            } else {
                this.parentView.enableYesBtn();
            }
        }
        return msg;
    },
    onProjectNameChange: function() {
        this.validateName();
    },
    onFriendlyNameChange: function() {
        let msg = this.model.validateFriendlyName();
        if (!msg && this._startNamingSync) {
            let projectName = this.model.get("projectName", "");
            let prefix = "";
            if (_.startsWith(projectName, TA_PREFIX)) {
                prefix = TA_PREFIX;
            } else if (_.startsWith(projectName, SPLUNK_TA_PREFIX)) {
                prefix = SPLUNK_TA_PREFIX;
            } else if (_.isEmpty(projectName)) {
                prefix = TA_PREFIX;
            }
            projectName = prefix + _.replace(this.model.get("friendlyName", "").toLowerCase(), /\s/g, "-");
            this.model.set("projectName", projectName);
        }
        this.validateName();
    },
    onAuthorChange: function() {
        let author = this.model.get("projectAuthor");
        // Judge whether author is a splunker.
        if (_.toLower(author) === "splunk" || /@splunk\.com$/.test(author)) {
            let projectName = this.model.get("projectName");
            // only convert the projet name when it follows "TA-xxxx" pattern
            if (_.startsWith(projectName, TA_PREFIX)) {
                this.model.set("projectName", _.replace(projectName, TA_PREFIX, SPLUNK_TA_PREFIX));
            }
        }
        // if author is changed from splunker to non spluker,
        // do not convert the project name back, because non splunker can
        // build TA like Splunk_TA_xxx
    },
    submitProjectCreation: function(actions) {
        // validate user input
        this.addLoading();
        this.clearError();
        if (!this.model.isValid()) {
            this.showError(this.model.validationError);
            return;
        }

        this.parentView.disableYesNo();
        let theme = this.model.get("themeColor");
        if (theme) {
            // replace 0x123456 with #123456, because splunk only knows #123456
            this.model.set("themeColor", _.replace(theme, "0x", "#"), { silent: true });
        }

        this.model
            .save(null)
            .always(response => {
                this.parentView.enableYesNo();
                this.model.set(response);
            })
            .done(response => {
                if (response.err_code) {
                    this.removeLoading();
                    this.showError(MessageUtil.getFormattedMessage(response.err_code, response.err_args));
                } else {
                    if (this._isCreation) {
                        let ta = new CurrentTa();
                        ta.save(
                            {
                                app_name: response.cookies.ta_builder_current_ta_name.value,
                                app_display_name: response.cookies.ta_builder_current_ta_display_name.value,
                                built: "yes"
                            },
                            {
                                success: () => {
                                    const collectedData = _.omit(this.model.toJSON(), [
                                        "smallIcon",
                                        "largeIcon",
                                        "cookies",
                                        "resp_status",
                                        "previousProjectName"
                                    ]);
                                    Collector.collect("track_creation", {
                                        type: "add-on",
                                        data: collectedData
                                    });
                                    window.location.href = "tab_main_flow";
                                },
                                'headers': {
                                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                                }
                            }
                        );
                    } else {
                        this.removeLoading();
                        this.parentView.hideModal();
                        Backbone.history.stop();
                        Backbone.history.start();
                        actions.modifyRow(this.model.attributes);
                    }
                }
            })
            .fail(() => {
                this.removeLoading();
                this.showError(
                    MessageUtil.getFormattedMessage(1000, {
                        url: this.model.url
                    })
                );
            });

        return;
    },
    showError(error) {
        ReactDOM.render(<ErrorBanner message={ error } />, this.parentView.$(".modal-error .showError")[0]);
    },
    clearError() {
        ReactDOM.render(<ErrorBanner message="" />, this.parentView.$(".modal-error .showError")[0]);
    },
    addLoading() {
        ReactDOM.render(
            <LoadingScreen loadCondition={ true } loadingText=" " />,
            this.parentView.$(".loading-footer")[0]
        );
        this.parentView.$(".ta-modal-dialog").prepend(loadingtag);
    },
    removeLoading() {
        ReactDOM.unmountComponentAtNode(this.parentView.$(".loading-footer")[0]);
        loadingtag.remove();
    }
});
