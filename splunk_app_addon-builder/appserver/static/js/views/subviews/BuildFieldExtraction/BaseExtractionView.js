import $ from "jquery";
import _ from "lodash";
import BaseSubView from "app/views/subviews/BaseSubView";
import * as DialogUtil from "app/utils/DialogUtil";
import * as MessageUtil from "app/utils/MessageUtil";

export default BaseSubView.extend({
    initialize() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this._sourcetype = this.options.sourcetype;
        this._data = this.options.data;
    },
    onSaveClick() {
        DialogUtil.showDialog({
            el: $("#parse-confirm-modal"),
            title: "Warning",
            content: MessageUtil.getFormattedMessage(7, this._sourcetype),
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Continue"),
            yesCallback: () => {
                this.clearError();
                this.saveResultsToServer();
                return true;
            }
        });
    }
});
