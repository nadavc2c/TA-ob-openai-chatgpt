import _ from "lodash";
import Backbone from "backbone";
import BaseSubView from "./BaseConfigSourcetype";
import * as HelpLinkUtil from "app/utils/HelpLinkUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import CreateSourcetype from "app/models/configure_sourcetype/CreateSourcetype";
import { TextControl } from "swc-aob/index";
import PreviewUploaderView from "./PreviewUploader";
import SourcetypeSettingsView from "./SourcetypeSettings/Master";
import EventTableView from "./EventTable/Master";
import Template from "contrib/text!./AddSourcetype.html";
import { DEFAULT_CONF_SETTINGS } from "./Util";

export default BaseSubView.extend({
    template: Template,
    initialize: function() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.models.sourcetype = new CreateSourcetype();
        this.models.settings = new Backbone.Collection();
        this.models.settings.reset(DEFAULT_CONF_SETTINGS);
        this.listenTo(
            this.models.settings,
            "change update add remove",
            _.debounce(this.onSettingsChange, 300)
        );
        this.listenTo(
            this.models.name,
            'change:name',
            this.onNameChange.bind(this)
        );
    },
    onNameChange() {
        if (this.models.name.get('name')) {
            this.enableElement('.ta-btn-save');
        } else {
            this.disableElement('.ta-btn-save');
        }
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                helplink: HelpLinkUtil.getHelpLinkObj("step_sourcetype_add")
            })
        );
        this.createChild("sourcetypeSettings", SourcetypeSettingsView, {
            settings: this.models.settings
        });
        this.createChild("sourcetypeName", TextControl, {
            model: this.models.name,
            modelAttribute: "name",
            placeholder: _.t("Enter name")
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
        this.$(".ta-sub-view-new-sourcetype .ta-input-container").append(
            this.children.sourcetypeName.render().$el
        );
        this.$(".ta-sub-view-sample-data-panel").append(
            this.children.fileUploader.render().$el
        );
        this.$(".ta-sub-view-sample-data-panel").append(
            this.children.eventTable.render().$el
        );
        return this;
    },
    validateSourcetypeSetting: function() {
        var n = this.children.sourcetypeName.getValue() || "";
        if (n.length === 0) {
            return MessageUtil.getFormattedMessage(8005);
        }
        return this.children.sourcetypeSettings.validateSettings();
    }
});
