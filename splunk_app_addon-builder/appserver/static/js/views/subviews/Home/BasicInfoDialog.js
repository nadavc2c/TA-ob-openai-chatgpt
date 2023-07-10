import Dialog from "app/components/modal/Dialog";
import BasicInfoSubView from "./BasicInfo/Master";
import CurrentTa from "app/models/flow_wizard/current_ta";
import { splunkUtils } from "swc-aob/index";

export default Dialog.extend({
    initialize() {
        Dialog.prototype.initialize.apply(this, arguments);
        this._appName = this.options.appName || null;
        this._rootView = this.options.rootView;
        this._actions = this.options.actions;
    },
    render() {
        Dialog.prototype.render.apply(this, arguments);
        this.basicInfoView = new BasicInfoSubView({
            parentView: this
        });
        this.$(".modal-body").html(this.basicInfoView.render().$el);
    },
    getAppName() {
        return this._appName;
    },
    onYesClick(e) {
        if (this.isElementDisabled(".ta-btn-yes")) {
            return;
        }
        e.preventDefault();
        var ta = new CurrentTa();
        ta.clear();
        ta.save(
            {},
            {
                success: () => {
                    this.basicInfoView.submitProjectCreation(this._actions);
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    },
    hideModal() {
        if (this.basicInfoView) {
            this.basicInfoView.remove();
        }
        Dialog.prototype.hideModal.apply(this);
    }
});
