import _ from "lodash";
import BaseView from "app/components/BaseView";

export default BaseView.extend({
    className: "ta-sub-view-component",
    initialize() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.controller = this.options.controller || null;
        this.parentView = this.options.parentView || null;
    },
    createChild(name, clazz, options = {}) {
        let child = new clazz(
            _.extend(
                {
                    controller: this.controller,
                    parentView: this
                },
                options
            )
        );
        this.children[name] = child;
        return child;
    }
});
