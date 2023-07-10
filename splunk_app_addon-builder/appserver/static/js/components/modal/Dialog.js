import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import ModalTemplate from "contrib/text!app/components/modal/Dialog.html";

var defaultFunc = function() {
    return true;
};

export default BaseView.extend({
    template: ModalTemplate,

    initialize() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.parseOptions(this.options);
    },
    parseOptions(options) {
        this._title = options.title || this._title || "";
        this._content = options.content || this._content || "";
        this._btnNoText = options.btnNoText || this._btnNoText || "No";
        this._btnYesText = options.btnYesText || this._btnYesText || "Yes";
        this._hideCloseBtn =
            options.hideCloseBtn || this._hideCloseBtn || false;
        if (_.isFunction(options.yesCallback)) {
            this._yesCallback = options.yesCallback;
        }
        if (!this._yesCallback) {
            this._yesCallback = defaultFunc;
        }
        if (_.isFunction(options.noCallback)) {
            this._noCallback = options.noCallback;
        }
        if (!this._noCallback) {
            this._noCallback = defaultFunc;
        }
    },
    render() {
        this.$el.html(
            this.compiledTemplate({
                title: this._title,
                content: this._content,
                btnNoText: this._btnNoText,
                btnYesText: this._btnYesText
            })
        );
        this._$dialog = this.$(".ta-modal-dialog");
        this._$dialog.modal({
            backdrop: "static",
            keyboard: false,
            show: false
        });
        this.$(".ta-btn-yes").unbind().click(this.onYesClick.bind(this));
        this.$(".ta-btn-no").unbind().click(this.onNoClick.bind(this));
        this.$("button.close").unbind().click(this.onNoClick.bind(this));
        if (this._hideCloseBtn) {
            this.$("button.close").hide();
        }
    },

    showModal(options = {}) {
        this.parseOptions(options);
        this.render();
        this._$dialog.modal("show");
        this.$(".modal-body").on("mousewheel", e => {
            const wheelDelta =
                e.originalEvent.wheelDeltaY || e.originalEvent.wheelDelta;
            this.$(".modal-body")[0].scrollTop -= wheelDelta;
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
        $(".modal-backdrop").on("mousewheel", e => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    },
    hideModal() {
        this.$el.off("mousewheel");
        $(".modal-backdrop").off("mousewheel");
        this._$dialog.modal("hide");
    },
    onNoClick(e) {
        e.preventDefault();
        var isHide = this._noCallback(this);
        if (isHide !== false) {
            this.hideModal();
        }
    },

    onYesClick(e) {
        e.preventDefault();
        var isHide = this._yesCallback(this);
        if (isHide !== false) {
            this.hideModal();
        }
    },
    disableYesBtn() {
        return this.disableElement(".ta-btn-yes");
    },
    enableYesBtn() {
        return this.enableElement(".ta-btn-yes");
    },
    disableNoBtn() {
        return this.disableElement(".ta-btn-no");
    },
    enableNoBtn() {
        return this.enableElement(".ta-btn-no");
    },
    disableYesNo() {
        return this.disableYesBtn().disableNoBtn();
    },
    enableYesNo() {
        return this.enableYesBtn().enableNoBtn();
    }
});
