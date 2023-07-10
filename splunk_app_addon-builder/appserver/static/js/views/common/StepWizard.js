import $ from "jquery";
import { Backbone } from "swc-aob/index";
import { StepWizardControl } from "swc-aob/index";
import WaitSpinner from "app/components/WaitSpinner";

export default StepWizardControl.extend({
    initialize() {
        StepWizardControl.prototype.initialize.apply(this, arguments);
        this.textSpinModel = new Backbone.Model();
        this.listenTo(this.textSpinModel, "change:text", this.debouncedRender);
        this.listenTo(this.model, "disablePrev", this.disablePrev);
        this.listenTo(this.model, "showSpin", this.showSpin);
        this.listenTo(this.model, "hideSpin", this.hideSpin);
    },
    disablePrev: function() {
        this.collection.at(this.getPrevIndex()).set("enabled", false);
    },
    render() {
        StepWizardControl.prototype.render.apply(this, arguments);
        if (this.options.exitLabel != null) {
            this.$(".nav-buttons .exit-button").text(this.options.exitLabel);
        }
        return this;
    },
    updateNavButtons() {
        StepWizardControl.prototype.updateNavButtons.apply(this, arguments);
        const text = this.textSpinModel.get("text");
        let $navButtons = this.$(".nav-buttons");
        if (!$navButtons[0]) {
            return;
        }
        let $textSpin = $navButtons.find(".text-spin");
        if (!$textSpin[0]) {
            $textSpin = $(
                '<span class="text-spin"><span class="text-content"/></span>'
            );
            new WaitSpinner({}).render().$el.prependTo($textSpin);
            $navButtons.append($textSpin);
        }
        $textSpin.find(".text-content").text(text);
        if (!text) {
            $textSpin.remove();
        }
    },
    showSpin(text) {
        this.textSpinModel.set("text", text);
    },
    hideSpin() {
        this.textSpinModel.unset("text");
    }
});
