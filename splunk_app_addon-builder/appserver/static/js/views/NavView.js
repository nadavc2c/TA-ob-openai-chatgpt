import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import NavViewTemplate from "contrib/text!app/views/NavView.html";

export default BaseView.extend({
    className: "ta-nav-bar",
    template: NavViewTemplate,
    initialize() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.items = this.options.items || [];
        this.modelAttribute = this.options.modelAttribute || "val";
        this.controller = this.options.controller;
        this.navLinks = {};
        this.listenTo(
            this.model,
            "change:" + this.modelAttribute,
            this.onAttrChange
        );
    },
    events: {
        "click .ta-nav-link": "onLinkClick",
        "click .name-banner-container": "onNameBannerClick"
    },
    show() {
        this.$el.show();
    },
    hide() {
        this.$el.hide();
    },
    setItems(items) {
        this.items = items;
        return this.render();
    },
    render() {
        let isAppController = !!this.controller.getAppName;
        let appDisplayName = isAppController
            ? this.controller.getAppDisplayName()
            : "";
        this.$el.html(
            this.compiledTemplate({
                appDisplayName: appDisplayName
            })
        );
        _.each(this.items, (item, index) => {
            const $el = (this.navLinks[item.value] = this.createNavLink(
                item,
                index
            ));
            this.$("ul").append($el);
        });

        this.onAttrChange();
        return this;
    },
    generateUrlFromItem(item) {
        let modelAttributes = _.extend(
            {
                [this.modelAttribute]: item.value
            },
            item.modelAttributes
        );
        let url =
            this.controller.getUrlPrefix() + "?view=" + modelAttributes.view;
        if (modelAttributes.action) {
            url += "&action=" + modelAttributes.action;
        }
        return url;
    },
    createNavLink(item, index) {
        let $item = $("<li></li>");
        let $link = $('<a class="ta-nav-link"></a>');
        $link.text(item.label);
        if (item.title) {
            $item.attr("title", item.title);
        }
        $link.attr("href", this.generateUrlFromItem(item));
        $link.data("index", index);
        $item.append($link);
        return $item;
    },
    onLinkClick(event) {
        event.preventDefault();
        let index = $(event.currentTarget).data("index");
        let item = this.items[index];
        let modelAttributes = _.extend(
            {
                [this.modelAttribute]: item.value
            },
            item.modelAttributes
        );
        let model = this.model;
        if (model.get("action") && !modelAttributes.hasOwnProperty("action")) {
            model.set("action", "");
        }
        model.set(modelAttributes);
    },
    onNameBannerClick(event) {
        event.preventDefault();
        window.location.href = "tab_home";
    },
    onAttrChange() {
        this.$("li.active").removeClass("active");
        const current = this.model.get(this.modelAttribute);
        if (current != null && this.navLinks[current]) {
            this.navLinks[current].addClass("active");
        }
    }
});
