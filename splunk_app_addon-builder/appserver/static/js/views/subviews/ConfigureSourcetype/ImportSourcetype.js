import _ from "lodash";
import $ from "jquery";
import Backbone from "backbone";
import BaseSubView from "./BaseConfigSourcetype";
import * as HelpLinkUtil from "app/utils/HelpLinkUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import PreviewUploaderView from "./PreviewUploader";
import SourcetypeSettingsView from "./SourcetypeSettings/Master";
import EventTableView from "./EventTable/Master";
import Template from "contrib/text!./ImportSourcetype.html";
import SingleInputControl from "app/components/controls/SingleInputControl";
import ImportSourcetypeModel
    from "app/models/configure_sourcetype/ImportSourcetype";

import ExternalSourcetypeModel
    from "app/models/configure_sourcetype/GetExternalSourcetype";
import sourcetypeContentModel
    from "app/models/configure_sourcetype/get_imported_sourcetype_contents";

import { showDialog } from "app/utils/DialogUtil";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { DEFAULT_CONF_SETTINGS } from "./Util";

export default BaseSubView.extend({
    template: Template,
    initialize() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.models.sourcetype = new ImportSourcetypeModel();
        this.models.externalSourcetype = new ExternalSourcetypeModel();
        this.models.sourcetypeContent = new sourcetypeContentModel();
        this.models.settings = new Backbone.Collection();
        this.models.settings.reset(DEFAULT_CONF_SETTINGS);
        this.listenTo(
            this.models.settings,
            "change update add remove reset",
            _.debounce(this.onSettingsChange, 300)
        );
        this.listenTo(this.models.name, "change:name", this.onNameChange);
    },
    onNameChange() {
        const name = this.models.name.get("name");
        const index = _.findIndex(
            this._cachedSourceTypeList,
            o => o.name === name
        );
        this.disableElement(".ta-btn-save");
        if (name) {
            if (this._cachedSourceTypeList[index].key_values) {
                this.enableElement(".ta-btn-save");
                this.setNewConfData(
                    this._cachedSourceTypeList[index].key_values
                );
            } else {
                const xhr = this.models.sourcetypeContent.fetch({
                    data: {
                        sourcetype: name
                    },
                    type: "GET"
                });
                this.children.sourcetypeName.disable();
                xhr
                    .done(response => {
                        this.children.sourcetypeName.enable();
                        if (response.err_code) {
                            this.showFormattedError(response);
                        } else {
                            this.enableElement(".ta-btn-save");
                            this._cachedSourceTypeList[index] =
                            response.sourcetype_contents;
                            this.setNewConfData(
                                this._cachedSourceTypeList[index].key_values
                            );
                        }
                    })
                    .fail(() => {
                        this.children.sourcetypeName.enable();
                        this.showFormattedError({
                            err_code: 4102,
                            err_args: { sourcetype: name }
                        });
                    });
            }
        }
    },
    setNewConfData(confData) {
        let collection = [];
        for (let name in confData) {
            if (confData.hasOwnProperty(name)) {
                collection.push({
                    name: name,
                    value: confData[name]
                });
            }
        }
        _.each(DEFAULT_CONF_SETTINGS, setting => {
            if (!_.includes(_.map(collection, 'name'), setting.name)) {
                collection.push(setting);
            }
        });
        collection = _.map(collection, item => new Backbone.Model(item));
        this.models.settings.reset(collection);
        this.children.sourcetypeSettings.reloadSettings();
        return collection;
    },
    getRequestBody() {
        let data = BaseSubView.prototype.getRequestBody.apply(this);
        data.source_app = _.find(this._cachedSourceTypeList, {
            name: data.sourcetype
        }).source_app;
        data.from_splunk = true;
        return data;
    },
    render() {
        this.$el.html(
            this.compiledTemplate({
                helplink: HelpLinkUtil.getHelpLinkObj("step_sourcetype_import")
            })
        );

        this.createChild("sourcetypeSettings", SourcetypeSettingsView, {
            settings: this.models.settings
        });
        this.createChild("sourcetypeName", SingleInputControl, {
            model: this.models.name,
            modelAttribute: "name",
            placeholder: _.t("Select a source type"),
            disableSearch: false,
            filter: true
        });
        this.createChild("fileUploader", PreviewUploaderView, {
            model: this.models.previewUploader,
            isOptional: true
        });
        this.createChild("eventTable", EventTableView, {
            model: this.models.result,
            jobModel: this.models.job,
            limit: this._eventLimit
        });
        this.renderSaveCancel();
        this.$(".ta-sub-view-sourcetype-settings-panel").append(
            this.children.sourcetypeSettings.render().$el
        );
        this.$(
            ".ta-sub-view-new-sourcetype .ta-single-select-container"
        ).append(this.children.sourcetypeName.render().$el);
        this.$(".ta-sub-view-sample-data-panel").append(
            this.children.fileUploader.render().$el
        );
        this.$(".ta-sub-view-sample-data-panel").append(
            this.children.eventTable.render().$el
        );
        this.disableFunctionalButtons();
        this.children.sourcetypeName.disable();
        this._xhr = this.models.externalSourcetype.fetch({
            success: (model, response) => {
                this._xhr = null;
                if (response.err_code) {
                    this.showErrorMsg(
                        MessageUtil.getFormattedMessage(
                            response.err_code,
                            response.err_args
                        )
                    );
                } else {
                    this._cachedSourceTypeList = response.indexed_sourcetypes;
                    const items = _.map(
                        response.indexed_sourcetypes,
                        ({ name }) => ({
                            value: name,
                            label: name
                        })
                    );
                    this.children.sourcetypeName.setAutoCompleteFields(items);
                    this.children.sourcetypeName.enable();
                }
                this.enableElement(".ta-btn-cancel");
            },
            error: (model, response) => {
                this._xhr = null;
                if (response.statusText === "manual") {
                    return;
                }
                this.showErrorMsg(MessageUtil.getFormattedMessage(8010));
                this.enableElement(".ta-btn-cancel");
            }
        });
        return this;
    },
    validateSourcetypeSetting() {
        var n = this.children.sourcetypeName.getValue() || "";
        if (n.length === 0) {
            return MessageUtil.getFormattedMessage(8005);
        }
        return this.children.sourcetypeSettings.validateSettings();
    },
    onSaveClick() {
        const superOnSaveClick = BaseSubView.prototype.onSaveClick.bind(this);
        let data = BaseSubView.prototype.getRequestBody.apply(this);
        const source_app = _.find(this._cachedSourceTypeList, {
            name: data.sourcetype
        }).source_app;
        if (source_app) {
            showDialog({
                el: $("#parse-confirm-modal"),
                title: "Warning",
                content: getFormattedMessage(8017, {
                    sourcetype: data.sourcetype,
                    app: source_app
                }),
                btnNoText: _.t("Cancel"),
                btnYesText: _.t("Continue"),
                yesCallback: () => {
                    this.clearError();
                    this.saveSourcetypeToServer();
                    return true;
                }
            });
        } else {
            superOnSaveClick();
        }
    },
    remove() {
        if (this._xhr) {
            this._xhr.abort("manual");
        }
        return BaseSubView.prototype.remove.apply(this);
    }
});
