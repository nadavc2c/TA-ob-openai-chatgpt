import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import BaseSubView from "app/views/subviews/BaseSubView";
import SampleUploader from "app/models/common/sample_data_file";
import CreateSourcetype from "app/models/configure_sourcetype/CreateSourcetype";
import PreviewUploader from "app/models/services/data/inputs/Uploader";
import SearchJob from "app/models/services/data/search/Job";
import PreviewModel from "app/models/services/data/Preview";
import Collector from "app/profiles/partyjsCollector";

const SOURCETYPE_NAMING_REGEX = /^[a-zA-Z][:_0-9a-zA-Z]*$/;

export default BaseSubView.extend({
    initialize(options) {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.compiledTemplate = _.template(this.template);
        this.options = options;
        this.models = {};
        this.models.name = new Backbone.Model();
        this.models.previewUploader = new PreviewUploader();
        this.models.sampleUploader = new SampleUploader();
        this.models.preview = new PreviewModel();
        this.models.job = new SearchJob();
        this.models.result = new Backbone.Model();
        this._eventLimit = 20;
        this.children = {};
        this.listenTo(this.models.previewUploader, "uploaded", this.onUploaded);
        this.listenTo(
            this.models.previewUploader,
            "beforeSend",
            this.onBeforeSend
        );
        this.listenTo(
            this.models.previewUploader,
            "clearPreview",
            this.onClearPreview
        );
    },
    onBeforeSend() {
        this.disableFunctionalButtons();
    },
    onUploaded(data, model) {
        this.enableFunctionalButtons();
        var name = model.get("ui.name");
        this.models.job.set("isFileJSON", this.models.preview.isFileJson(name));
        this.models.job.unset("sid");
        this.startNewPreview(name, data.messages[0].text);
    },
    onClearPreview() {
        this.enableFunctionalButtons();
        this.models.job.unset("isFileJSON");
        this.models.job.unset("sid");
        this.models.job.unset("eventCount");
        this.models.result.clear();
    },
    onSettingsChange() {
        var path = this.models.previewUploader.get("ui.name");
        var sid = this.models.job.get("sid");
        if (!sid || !path) {
            return;
        }
        this.startNewPreview(path, sid);
    },

    onSaveClick() {
        this.clearError();
        this.saveSourcetypeToServer();
    },
    startNewPreview(path, sid) {
        var result = this.models.result;
        var uploader = this.children.fileUploader;
        result.clear();
        uploader.updateEventLabel(null);
        var job = this.models.job;
        var limit = this._eventLimit;
        this.models.preview
            .preview(path, sid, this.children.sourcetypeSettings.getSettings())
            .done(function(model) {
                var sid = model.entry[0].name;
                job.set("sid", sid);
                var xhr = job.startSearch(sid, limit);
                xhr.done(function(response) {
                    result.set(response);
                    uploader.updateEventLabel(job.get("eventCount"));
                });
            });
    },
    validateSourcetypeSetting() {
        return this.children.sourcetypeSettings.validateSettings();
    },
    getSourcetypeName() {
        return this.models.name.get("name");
    },
    getRequestBody() {
        let settings = JSON.stringify(
            this.children.sourcetypeSettings.getSettings()
        );
        return {
            app_name: this.controller.getAppName(),
            sourcetype: this.getSourcetypeName(),
            key_values: settings,
            from_splunk: false
        };
    },
    saveSourcetypeToServer() {
        let err = this.validateSourcetypeSetting();
        if (err) {
            this.showError(err);
            return;
        }
        let sourcetype = this.getSourcetypeName();
        // Judge while creating sourcetype.
        let isCreating = this.models.sourcetype instanceof CreateSourcetype;
        if (isCreating && !SOURCETYPE_NAMING_REGEX.exec(sourcetype)) {
            this.showFormattedError(8016, { sourcetype });
            return;
        }

        let data = this.getRequestBody();
        let xhr = this.models.sourcetype.fetch({
            type: "POST",
            data: data
        });
        this.clearError();
        if (xhr) {
            this.disableFunctionalButtons();
            this.children.fileUploader.disable();
            xhr
                .always(() => {
                    this.children.fileUploader.enable();
                    this.enableFunctionalButtons();
                })
                .done(response => {
                    if (response.err_code) {
                        this.showFormattedError(response);
                    } else {
                        if (isCreating) {
                            Collector.collect("track_creation", {
                                type: "sourcetype",
                                data: data
                            });
                        }
                        if (this.models.previewUploader.get("file")) {
                            this.uploadSample(sourcetype);
                        } else {
                            this.controller.navigate({
                                view: "upload-sample"
                            });
                        }
                    }
                })
                .fail(() => {
                    this.showFormattedError(8003, { sourcetype });
                });
        }
    },
    uploadSample(sourcetype) {
        var data = new window.FormData();
        var uploadEndpoint = this.models.sampleUploader.url;

        data.append("sample_file", this.models.previewUploader.get("file"));
        data.append("sourcetype", sourcetype);

        var xhr = $.ajax({
            url: uploadEndpoint,
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST"
        });
        this.clearError();
        if (xhr) {
            this.disableFunctionalButtons();
            this.children.fileUploader.disable();
            xhr
                .always(() => {
                    this.children.fileUploader.enable();
                    this.enableFunctionalButtons();
                })
                .done(() => {
                    this.controller.navigate({
                        view: "upload-sample"
                    });
                })
                .fail(() => {
                    this.showFormattedError(8015, { sourcetype });
                });
        }
    }
});
