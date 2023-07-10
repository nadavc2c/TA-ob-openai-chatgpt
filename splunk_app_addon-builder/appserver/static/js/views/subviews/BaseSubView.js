import _ from "lodash";
import Backbone from "backbone";
import ReactDOM from "react-dom";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import * as MessageUtil from "app/utils/MessageUtil";
import MessageBanner from "app/components/MessageBanner";

export default BaseSubViewComponent.extend({
    className: "ta-sub-view",
    showNavBar: true,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
    },
    events: {
        "click button.ta-btn-save": "onSaveClick",
        "click button.ta-btn-cancel": "onCancelClick",
        "click a.ta-sub-view-return-link": "onCancelClick"
    },
    isShowNavBar() {
        return this.showNavBar;
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
    renderSaveCancel() {
        if (!this.$(".ta-sub-view-btn-group")[0]) {
            this.$el.prepend('<div class="ta-sub-view-btn-group"></div>');
        }
        this.$(".ta-sub-view-btn-group").append(
            `<button class="btn btn-primary pull-right ta-btn-save ta-sub-view-btn">${_.t("Save")}</button>`
        );
        this.$(".ta-sub-view-btn-group").append(
            `<button class="btn pull-right ta-btn-cancel ta-sub-view-btn">${_.t("Cancel")}</button>`
        );
        return this;
    },
    disableFunctionalButtons() {
        return this.disableElement(".ta-sub-view-btn");
    },
    enableFunctionalButtons() {
        return this.enableElement(".ta-sub-view-btn");
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
    onCancelClick() {
        this.clearError();
        this.controller.navigate({
            view: this.controller.models.navigation.get("view")
        });
    },
    getAppInfo() {
        return {
            appName: this.controller.getAppName()
        };
    },
    remove() {
        ReactDOM.unmountComponentAtNode(this.el);
        BaseSubViewComponent.prototype.remove.apply(this, arguments);
    }
});
