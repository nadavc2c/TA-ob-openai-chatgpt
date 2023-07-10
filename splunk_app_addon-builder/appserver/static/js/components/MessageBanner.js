import BaseView from "app/components/BaseView";

export default BaseView.extend({
    initialize(...args) {
        BaseView.prototype.initialize.apply(this, args);
    },
    render() {
        this.$el.empty();
        this.$el.hide();
        this.$el.append('<span class="ta-message-container"></span>');
        return this;
    },
    showMessage(msg) {
        this.$(".ta-message-container").text(msg);
        this.$el.show();
    },
    clearMessage() {
        this.$(".ta-message-container").text("");
        this.$el.hide();
    }
});
