import _ from "lodash";
import * as MessageUtil from "app/utils/MessageUtil";
import BaseStepView from "./BaseStepView";
import SuccessTemplate from "contrib/text!./Success.html";

export default BaseStepView.extend({
    className: "ta-step-success ta-step-view",
    template: SuccessTemplate,
    initialize: function() {
        BaseStepView.prototype.initialize.apply(this, arguments);
    },
    events: {
        "click .left-option-logo": "onClickAddMoreModularInputLogo",
        "click .right-option-logo": "onClickFieldExtractionLogo",
        "click .left-option-text": "onClickAddMoreModularInputLogo",
        "click .right-option-text": "onClickFieldExtractionLogo"
    },
    onClickAddMoreModularInputLogo() {
        this.controller.navigate({
            view: "data-collection",
            action: "add"
        });
    },
    onClickFieldExtractionLogo() {
        this.controller.navigate({
            view: "field-extraction"
        });
    },
    truncate: function(str) {
        var wordsArr = str.trim().split(new RegExp(" +"));
        var ret = "";
        for (var i = 0; ret.length < 20 && i < wordsArr.length; ++i) {
            ret += wordsArr[i];
            ret += " ";
        }
        if (ret.trim().length > 0) {
            ret += "...";
        }
        return ret;
    },
    render: function() {
        var descStr = this.truncate(this.model.get("description"));
        var metas = {
            [_.t("Source type name")]: this.model.get("sourcetype"),
            [_.t("Input internal name")]: this.model.get("name"),
            [_.t("Input display name")]: this.model.get("title"),
            [_.t("Description")]: descStr,
            [_.t("Collection Interval")]: this.model.get("interval") +
                _.t(" seconds")
        };

        this.$el.html(
            this.compiledTemplate({
                resultTitle: MessageUtil.getFormattedMessage(12000),
                lineText: MessageUtil.getFormattedMessage(12003),
                metas: metas
            })
        );
        this.controller.showNavBar();
        this.$(".options").append(
            _.template(
                '<div class="left-option-logo ta-logo-modular-input"></div><div class="left-option-text"><%- left_text %></div>'
            )({
                left_text: MessageUtil.getFormattedMessage(12001)
            })
        );

        this.$(".options").append(
            _.template(
                '<div class="right-option-logo ta-logo-field-extraction"></div><div class="right-option-text"><%- right_text %></div>'
            )({
                right_text: MessageUtil.getFormattedMessage(12002)
            })
        );

        return this;
    }
});
