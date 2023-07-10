import BaseView from "app/components/BaseView";
import Spinner from "contrib/text!./WaitSpinner.svg";

export default BaseView.extend({
    tagName: "span",
    className: "ta-wait-spinner",
    initialize(...args) {
        BaseView.prototype.initialize.apply(this, args);
    },
    render() {
        this.$el.html(Spinner);
        return this;
    }
});
