import BaseSearchPresenter from "app/views/subviews/BaseSearchPresenter";
import Template from "contrib/text!./SingleValuePresenter.html";

export default BaseSearchPresenter.extend({
    className: "ta-search-presenter ta-single-value-presenter",
    template: Template,
    initialize() {
        BaseSearchPresenter.prototype.initialize.apply(this, arguments);
    },
    events: {
        click: "onClick"
    },
    render() {
        this.$el.html(
            this.compiledTemplate({
                title: this.options.title,
                icon: this.options.icon
            })
        );
        return this;
    },
    onDataChange(data) {
        let value;
        try {
            value = data.rows[0][0];
        } catch (err) {
            value = "-";
        }
        this.updateValue(value);
    },
    updateValue(val) {
        this.value = val;
        this.$el.addClass("is-interaction-enabled");
        this.$(".ta-value-container").text(val);
    },
    onClick(event) {
        if (!this.$el.hasClass("is-interaction-enabled")) {
            return;
        }
        event.preventDefault();
        this.trigger("click", this.options.value, this);
    },
    select() {
        this.$el.addClass("is-selected");
    },
    unselect() {
        this.$el.removeClass("is-selected");
    }
});
