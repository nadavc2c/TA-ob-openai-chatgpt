import _ from "lodash";
import Backbone from "backbone";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import * as MessageUtil from "app/utils/MessageUtil";
import MessageBanner from "app/components/MessageBanner";

const BaseStepView = BaseSubViewComponent.extend({
    className: "ta-step-view",
    events: {
        "click button.ta-btn-test": "onTestClicked",
        "click button.ta-btn-save": "onSaveClicked"
    },
    initialize: function() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.models = this.options.models;
        this.modelCloned = this.options.modelCloned;
        this.stepModel = this.models.step;
        this.globalSettingsModel = this.models.globalSettings;
    },
    validate() {
        // To be implemented by children.
    },
    showError(msg) {
        if (!this.children.errMsgBanner) {
            let child = (this.children.errMsgBanner = new MessageBanner({
                className: "ta-error-msg-banner"
            }));
            child.render();
            if (this.$(".ta-help-link-header")[0]) {
                child.$el.insertAfter(this.$(".ta-help-link-header"));
            } else {
                this.$el.prepend(child.$el);
            }
        }
        this.$el.addClass("is-showing-error");
        this.children.errMsgBanner.showMessage(msg);
    },
    clearError() {
        this.$el.removeClass("is-showing-error");
        if (this.children.errMsgBanner) {
            this.children.errMsgBanner.clearMessage();
        }
    },
    showFormattedError(code, ...params) {
        let msg;
        if (code instanceof Backbone.Model) {
            msg = MessageUtil.getMessageFromModel(code);
        } else if (_.isObject(code)) {
            msg = MessageUtil.getMessageFromObject(code);
        } else {
            msg = MessageUtil.getFormattedMessage(code, ...params);
        }
        this.showError(msg);
        return this;
    },
    renderSave() {
        if (!this.$(".ta-sub-view-btn-group")[0]) {
            this.$el.prepend('<div class="ta-sub-view-btn-group"></div>');
        }
        this.$(".ta-sub-view-btn-group").append(
            `<button class="btn pull-right ta-btn-save ta-sub-view-btn"><i class="icon-check-circle fadeIcon"></i>${_.t("Save")}</button>`
        );
        this.hideCheckIcon();
        return this;
    },
    showCheckIcon() {
        window.setTimeout(() => {
            this.$(".ta-btn-save .icon-check-circle").removeClass("fade-in");
            window.setTimeout(() => {
                this.hideElement(".ta-btn-save .icon-check-circle");
            }, 500);
        }, 1000);
        this.showElement(".ta-btn-save .icon-check-circle");
        this.$(".ta-btn-save .icon-check-circle").addClass("fade-in");
    },
    hideCheckIcon() {
        return this.hideElement(".ta-btn-save .icon-check-circle");
    }
});
export default BaseStepView;
