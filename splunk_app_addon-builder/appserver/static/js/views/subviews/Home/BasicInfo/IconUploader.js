import $ from "jquery";
import _ from "lodash";
import { BaseView } from "swc-aob/index";
import * as ImgUtil from "app/utils/ImgUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import Template from "contrib/text!./IconUploader.html";
import "blueimp-file-upload/js/jquery.fileupload"; // jquery.iframe-transport //NO IMPORT

const IMAGE_TYPE = /^image\//;
function resizeImage(src, width, x = 0, height = width, y = x, ratio = 1) {
    let dfd = $.Deferred();
    let canvas = document.createElement("canvas");
    let img = document.createElement("img");
    img.onload = function() {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        var lctx = canvas.getContext("2d");
        lctx.scale(ratio, ratio);
        lctx.drawImage(img, x, y, width - x * 2, height - y * 2);
        dfd.resolve(canvas.toDataURL());
    };
    img.src = src;
    return dfd.promise();
}

function resizeImageWithDeferred(promise, ...args) {
    let dfd = $.Deferred();
    promise.done(src => {
        resizeImage(src, ...args).done((...args) => {
            dfd.resolve(...args);
        });
    });
    return dfd.promise();
}

export default BaseView.extend({
    template: Template,

    events: {
        "click .btn-upload-file": function(e) {
            e.preventDefault();
            if (!this._enabled) {
                return;
            }
            this.$("#inputReference").click();
            this.clearError();
        }
    },
    /**
    @param: model. a model should be bind to file uploader.
    - endpoint: the endpoint url for the file uploader
    The view saves the file name to model. key: ui.filename
    @param: uploadBtnText
    @param maxFileSize. the max byte length for the uploaded file
    */
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);

        this.uploadBtnText =
            this.options.uploadBtnText || _.t("Upload from local disk");
        this.maxFileSize = this.options.maxFileSize || 500 * 1024 * 1024;
        this.maxFileSizeMb = Math.floor(this.maxFileSize / 1024 / 1024);

        this._enabled = true; // default is enabled
    },

    render: function() {
        this.$("#inputReference").remove();
        this.$el.html(
            this.compiledTemplate({
                uploadBtnText: this.uploadBtnText
            })
        );
        this.renderUploadControl();
        return this;
    },
    updateSelectedFileLabel: function(filename) {
        if (filename) {
            this.$(".ta-source-label").text(_.escape(filename));
        } else {
            this.$(".ta-source-label").text(_.t("No file selected"));
        }
    },
    renderUploadControl: function() {
        var that = this;
        var inputReference = this.$("#inputReference");
        var file;
        this.updateSelectedFileLabel("");
        this.$(".icon-uploader-error-container").hide();

        inputReference.on("change", function(e) {
            file = e.target.files[0];
            if (file) {
                that.model.set("loadingFile", file);
                that.resizeImageAndUpload(file);
            }
        });
        if (this.model.get("smallIcon")) {
            this.setSmallIcon(this.model.get("smallIcon"));
            this.setLargeIcon(this.model.get("largeIcon"));
        } else {
            this.setDefaultIcon(
                "icon-app-default.png",
                "icon-app-default-small.png"
            );
        }
    },
    isInputValid: function(file) {
        //check file size
        let valid = true;
        if (file.size > this.maxFileSize) {
            valid = false;
            var fileSizeMb = file.size / 1024 / 1024;
            this.model.set(
                "error",
                MessageUtil.getFormattedMessage(
                    2018,
                    fileSizeMb.toPrecision(3),
                    this.maxFileSizeMb
                ),
                { silent: true }
            );
            this.showError(
                MessageUtil.getFormattedMessage(
                    2018,
                    fileSizeMb.toPrecision(3),
                    this.maxFileSizeMb
                )
            );
            this.model.trigger(
                "change:error",
                this.model,
                this.model.get("error")
            );
        } else if (!IMAGE_TYPE.test(file.type)) {
            valid = false;
            this.showError(MessageUtil.getFormattedMessage(2013));
            this.model.set("error", MessageUtil.getFormattedMessage(2013), {
                silent: true
            });
            this.model.trigger(
                "change:error",
                this.model,
                this.model.get("error")
            );
        }
        return valid;
    },
    sendFile: function(file) {
        this.model.unset("error");

        if (this.fileUploadXhr) {
            this.fileUploadXhr.abort();
        }

        if (!this.isInputValid(file)) {
            return;
        }

        this.inputFile = file;
        this.model.set("ui.filename", file.name);
        this.model.set("file", file);
        var data = new window.FormData();
        var uploadEndpoint = this.model.get("endpoint");
        data.append("uploadFile", file);

        this.fileUploadXhr = $.ajax({
            url: uploadEndpoint,
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: this.onSendDone.bind(this),
            error: this.onSendFail.bind(this)
        });
    },

    setLargeIcon: function(dataContent) {
        if (dataContent) {
            this.model.set("largeIcon", dataContent);
        }
    },

    setSmallIcon: function(dataContent) {
        if (dataContent) {
            this.$(".ta-icon-container").html(
                "<img width='36' height='36' src='data:image/png;base64," +
                    dataContent +
                    "'></img>"
            );
            this.model.set("smallIcon", dataContent);
        }
    },
    setDefaultIcon: function(iconName, iconSmallName = iconName) {
        resizeImage(
            ImgUtil.getImgUrl(iconName),
            72,
            6,
            undefined,
            undefined,
            1
        ).done(dataUrl => {
            this.largeIconURI = dataUrl.split(",")[1];
            this.setLargeIcon(this.largeIconURI);
        });

        resizeImage(
            ImgUtil.getImgUrl(iconSmallName),
            36,
            3,
            undefined,
            undefined,
            1
        ).done(dataUrl => {
            this.smallIconURI = dataUrl.split(",")[1];
            this.setSmallIcon(this.smallIconURI);
        });
    },
    resizeImageAndUpload: function(file) {
        if (!this.isInputValid(file)) {
            return;
        }
        this.updateSelectedFileLabel(file.name);
        this.inputFile = file;
        this.model.set("ui.filename", file.name);
        this.model.set("file", file);

        let dfd = $.Deferred();
        let reader = new window.FileReader();
        reader.onload = function(e) {
            dfd.resolve(e.target.result);
        };
        reader.readAsDataURL(file);
        let resizeLargeDfd = resizeImageWithDeferred(dfd.promise(), 72);
        let resizeSmallDfd = resizeImageWithDeferred(dfd.promise(), 36);
        $.when(
            resizeLargeDfd,
            resizeSmallDfd
        ).done((largeDataUrl, smallDataUrl) => {
            this.uploadIcons(largeDataUrl, smallDataUrl);
        });
    },

    uploadIcons: function(largeIconDataUrl, smallIconDataUrl) {
        this.model.unset("error");

        if (this.fileUploadXhr) {
            this.fileUploadXhr.abort();
        }

        var data = new window.FormData();
        var uploadEndpoint = this.model.get("endpoint");
        this.smallIconURI = smallIconDataUrl.split(",")[1];
        this.largeIconURI = largeIconDataUrl.split(",")[1];

        data.append("large_icon", this.largeIconURI);
        data.append("small_icon", this.smallIconURI);

        // upload the files, and see if there is any errors
        this.fileUploadXhr = $.ajax({
            url: uploadEndpoint,
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: this.onSendDone.bind(this),
            error: this.onSendFail.bind(this)
        });
    },

    // overwrite teh onSendDone
    onSendDone: function(data, status) {
        if (status === "success" && data) {
            if (data.error) {
                var e = {
                    data: data
                };
                this.onSendFail(e);
            } else {
                this.finished = true;
                // set the URI to model
                this.setLargeIcon(this.largeIconURI);
                this.setSmallIcon(this.smallIconURI);
            }
        } else {
            this.onSendFail();
        }
    },
    onSendFail: function(e) {
        var msg = "";
        if (e.data && e.data.error) {
            msg = e.data.error;
            this.model.set("error", msg);
        }

        if (
            e.responseJSON &&
            e.responseJSON.messages &&
            e.responseJSON.messages[0].type === "ERROR"
        ) {
            msg = e.responseJSON.messages[0].message;
            this.model.set("error", msg);
        }

        if (!e || (msg.length < 1 && e.statusText !== "abort")) {
            msg = "Unspecified upload error. Refresh and try again.";
            this.model.set("error", msg);
        }
    },
    showError: function(msg) {
        this.$(".icon-uploader-error-container").show();
        this.$el.find(".icon-uploader-error-message").text(msg);
    },
    clearError: function() {
        this.$(".icon-uploader-error-container").hide();
    }
});
