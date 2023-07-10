import $ from "jquery";
import _ from "lodash";
import { BaseView } from "swc-aob/index";
import { splunkUtils } from "swc-aob/index";
import { ConfigModel } from "swc-aob/index";
import { route } from "swc-aob/index";
import { SplunkJsUtils } from "swc-aob/index";
import * as DialogUtil from "app/utils/DialogUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import template from "contrib/text!./PreviewUploader.html";

function humanFileSize(size) {
    if (!size) {
        return 0;
    }
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (
        (size / Math.pow(1024, i)).toFixed(2) * 1 +
        " " +
        ["B", "kB", "MB", "GB", "TB"][i]
    );
}

export default BaseView.extend({
    template: template,
    className: "fileUpload",
    events: {
        "click a.btn": function(e) {
            if ($(e.currentTarget).attr("disabled")) {
                return;
            }
            e.preventDefault();
            this.$("#inputReference").click();
        }
    },
    disable: function() {
        this.$("a.btn").attr("disabled", "disabled");
    },
    enable: function() {
        this.$("a.btn").removeAttr("disabled");
    },
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.maxFileSize = ConfigModel.get("MAX_UPLOAD_SIZE");
        this.pageInfo = SplunkJsUtils.getPageInfo();
    },
    render: function() {
        //remove any old fileReferences
        this.$("#inputReference").remove();

        var helpLinkBrowser = route.docHelp(
            this.pageInfo.root,
            this.pageInfo.locale,
            "learnmore.adddata.browser"
        );

        var template = this.compiledTemplate({
            helpLinkBrowser: helpLinkBrowser,
            isOptional: this.options.isOptional
        });
        this.$el.html(template);

        if (!window.File) {
            this.$(".browserWarning").show();
            this.$(".ta-upload-control-wrapper").hide();
        }

        this.renderUpload();
        return this;
    },
    renderUpload: function() {
        var that = this;
        var inputReference = this.$("#inputReference");
        var file;
        this.updateSelectedFileLabel();

        inputReference.on("change", function(e) {
            file = e.target.files[0];
            if (file) {
                that.model.set("ui.name", file.name);
                that.model.set("file.size", file.size);
                that.updateSelectedFileLabel();
                that.sendFile(file);
            }
        });
    },
    isInputValid: function(file) {
        //check file size
        if (file.size > this.maxFileSize) {
            var maxFileSizeMb = Math.floor(this.maxFileSize / 1024 / 1024);
            var fileSizeMb = Math.floor(file.size / 1024 / 1024);
            DialogUtil.showDialog({
                el: $("#alert-modal"),
                type: "alert",
                title: _.t("Error"),
                content: splunkUtils.sprintf(
                    _.t(
                        "File too large. The file selected is %sMb. Maximum file size is %sMb"
                    ),
                    fileSizeMb,
                    maxFileSizeMb
                )
            });
            this.model.unset("file");
            this.model.unset("ui.name");
            this.updateSelectedFileLabel();
            return false;
        }

        //check if this is an archive file
        if (this.model.isArchive(file.name)) {
            DialogUtil.showDialog({
                el: $("#alert-modal"),
                type: "alert",
                title: _.t("Error"),
                content: MessageUtil.getFormattedMessage(8013)
            });
            this.model.unset("file");
            this.model.unset("ui.name");
            this.updateSelectedFileLabel();
            return false;
        }

        return true;
    },
    sendFile: function(file) {
        if (this.fileUploadXhr) {
            this.fileUploadXhr.abort();
        }

        this.updateEventLabel(null);
        this.model.trigger("clearPreview");
        if (!this.isInputValid(file)) {
            return;
        }

        this.inputFile = file;

        var data = new window.FormData();
        var pageInfo = this.pageInfo;
        var uploadEndpoint =
            route.indexingPreviewUpload(pageInfo.root, pageInfo.locale) +
            "?output_mode=json&props.NO_BINARY_CHECK=1&input.path=" +
            file.name;
        data.append("spl-file", file);
        this.model.trigger("beforeSend");
        var onSendProgress = this.onSendProgress.bind(this);
        this.fileUploadXhr = $.ajax({
            url: uploadEndpoint,
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: this.onSendDone.bind(this),
            error: this.onSendFail.bind(this),
            xhr: function() {
                var xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener("progress", onSendProgress);
                return xhr;
            }
        });
    },
    onSendProgress: function(e) {
        if (e.lengthComputable) {
            var loaded = e.loaded || 0;
            var total = e.total || 1;
            var progress = Math.round(loaded / total * 100);
            if (progress === 100) {
                this.updateProgressMsg(", " + _.t("Loading data..."));
            } else {
                this.updateProgressMsg(
                    ", " + _.t("Uploading progress: ") + progress + "%"
                );
            }
        }
    },
    onSendDone: function(data, status) {
        if (status === "success" && data && data.messages && data.messages[0]) {
            this.finished = true;
            this.model.set({
                file: this.inputFile
            });
            this.model.validate();
            this.model.trigger("uploaded", data, this.model);
        } else {
            this.onSendFail();
        }
        this.updateProgressMsg();
    },
    onSendFail: function(e) {
        var msg = "";
        this.updateEventLabel(null);
        this.updateProgressMsg();
        if (
            e.responseJSON &&
            e.responseJSON.messages &&
            e.responseJSON.messages[0]
        ) {
            msg = e.responseJSON.messages[0].text;
            DialogUtil.showDialog({
                el: $("#alert-modal"),
                type: "alert",
                title: _.t("Error"),
                content: _.t(msg)
            });
            this.model.unset("file");
            this.model.unset("ui.name");
            this.updateSelectedFileLabel();
        }

        if (msg.indexOf("Cannot preview binary file:") === 0) {
            DialogUtil.showDialog({
                el: $("#alert-modal"),
                type: "alert",
                title: _.t("Error"),
                content: MessageUtil.getFormattedMessage(8014)
            });
            this.model.unset("file");
            this.model.unset("ui.name");
            this.updateSelectedFileLabel();
        }

        if (!e || (msg.length < 1 && e.statusText !== "abort")) {
            DialogUtil.showDialog({
                el: $("#alert-modal"),
                type: "alert",
                title: _.t("Error"),
                content: _.t("Unspecified upload error. Refresh and try again.")
            });
            this.model.unset("file");
            this.model.unset("ui.name");
            this.updateSelectedFileLabel();
        }
        this.model.trigger("clearPreview");
    },
    updateSelectedFileLabel: function() {
        var filename = this.model.get("ui.name");
        if (filename) {
            this.$(".source-label").text(
                filename + ", " + humanFileSize(this.model.get("file.size"))
            );
        } else {
            this.$(".source-label").text(_.t("No file selected"));
        }
    },
    updateEventLabel: function(numOfEvents) {
        var text = "";
        if (numOfEvents != null) {
            if (+numOfEvents > 1000) {
                numOfEvents = "more than 1000";
            }
            text = ", " + numOfEvents + " Events";
        }
        this.$(".event-label").text(text);
    },
    updateProgressMsg: function(text) {
        text = text || "";
        this.$(".progress-msg").text(text);
    }
});
