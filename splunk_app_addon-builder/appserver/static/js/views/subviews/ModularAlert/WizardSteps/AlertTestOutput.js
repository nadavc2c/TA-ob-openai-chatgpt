import _ from "lodash";
import BaseView from "app/components/BaseView";
import Template from "contrib/text!./AlertTestOutput.html";

export default BaseView.extend({
    template: Template,
    className: "ta-output-area-view",
    initialize() {
        BaseView.prototype.initialize.apply(this, arguments);
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        this.$output = this.$(".ta-output-text-wrapper");
        this.hide();
        return this;
    },
    hide() {
        this.$output.hide();
    },
    show() {
        this.$output.show();
    },
    empty() {
        this.$output.empty();
    },
    addHtml(html) {
        this.$output.append(html);
    },
    addInfoMessage(msg) {
        this.$output.append(
            _.template(this.infoMessageTemplate)({
                message: msg
            })
        );
    },
    addErrorMessage(msg) {
        this.$output.append(
            _.template(this.errorMessageTemplate)({
                message: msg
            })
        );
    },
    addWarningMessage(msg) {
        this.$output.append(
            _.template(this.warningMessageTemplate)({
                message: msg
            })
        );
    },
    infoMessageTemplate: '<div style="margin: 10px;"><i class="icon-info-circle"></i><%- message %></div>',
    warningMessageTemplate: '<div style="margin: 10px;"><i class="icon-warning"></i><%- message %></div>',
    errorMessageTemplate: '<div style="margin: 10px;"><i class="icon-warning-sign"></i><%- message %></div>'
});
