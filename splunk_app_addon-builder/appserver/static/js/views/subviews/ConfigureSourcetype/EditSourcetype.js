import _ from "lodash";
import Backbone from "backbone";
import BaseSubView from "./BaseConfigSourcetype";
import * as HelpLinkUtil from "app/utils/HelpLinkUtil";
import UpdateSourcetype from "app/models/configure_sourcetype/UpdateSourcetype";
import PreviewUploaderView from "./PreviewUploader";
import SourcetypeSettingsView from "./SourcetypeSettings/Master";
import EventTableView from "./EventTable/Master";
import Template from "contrib/text!./EditSourcetype.html";

export default BaseSubView.extend({
    template: Template,
    initialize: function(options) {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.models.sourcetype = new UpdateSourcetype();
        this.models.name.set("name", options.sourcetype);

        this.models.settings = this.parseConfData(options.confData);
        this.listenTo(
            this.models.settings,
            "change update add remove",
            _.debounce(this.onSettingsChange, 300)
        );
    },
    parseConfData: function(confData) {
        var collection = new Backbone.Collection();
        for (var name in confData) {
            if (confData.hasOwnProperty(name)) {
                collection.add(
                    new Backbone.Model({
                        name: name,
                        value: confData[name]
                    })
                );
            }
        }
        return collection;
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                sourcetype: this.models.name.get("name"),
                helplink: HelpLinkUtil.getHelpLinkObj("step_sourcetype_edit")
            })
        );
        this.createChild("sourcetypeSettings", SourcetypeSettingsView, {
            settings: this.models.settings
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
        this.$(".ta-sub-view-sample-data-panel").append(
            this.children.fileUploader.render().$el
        );
        this.$(".ta-sub-view-sample-data-panel").append(
            this.children.eventTable.render().$el
        );
        return this;
    }
});
