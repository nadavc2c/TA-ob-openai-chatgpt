import _ from "lodash";
import Backbone from "backbone";

let BaseView = Backbone.View.extend({
    initialize(options = {}) {
        Backbone.View.prototype.initialize.apply(this, arguments);
        this.options = options;
        this.model = this.options.model || new Backbone.Model();
        this.children = {};

        if (_.isString(this.template)) {
            this.compiledTemplate = this.compileTemplate(this.template);
        }
        if (this.moduleId) {
            this.$el.attr("data-view", this.moduleId);
        }
    },
    render() {
        //This method must be implemented in children classes.
        throw new Error(
            "Function render() must be implemented in children classes"
        );
    },
    compileTemplate: _.memoize(function(templateStr) {
        return _.template(templateStr);
    }),
    removeChildren() {
        _.each(this.children, child => {
            if (_.isFunction(child.remove)) {
                child.remove();
            }
        });
        this.children = {};
    },
    remove() {
        this.removeChildren();
        this.stopListening();
        this.$el.remove();
    },
    isElementDisabled(selector) {
        return this.$(selector).attr("disabled") != null;
    },
    disableElement(selector) {
        this.$(selector).attr("disabled", "disabled");
        return this;
    },
    enableElement(selector) {
        this.$(selector).removeAttr("disabled");
        return this;
    },
    hideElement(selector, param) {
        this.$(selector).hide(param);
        return this;
    },
    showElement(selector, param) {
        this.$(selector).show(param);
        return this;
    }
});
// Extend events from BaseView.
BaseView.extend = function(child) {
    var view = Backbone.View.extend.apply(this, arguments);
    view.prototype.events = _.extend({}, this.prototype.events, child.events);
    return view;
};

export default BaseView;
