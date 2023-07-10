import $ from "jquery";
import _ from "lodash";
import BaseSubView from "app/views/subviews/BaseSubView";
import Template from "contrib/text!app/views/subviews/Summary/Master.html";
import QuickLinkTemplate
    from "contrib/text!app/views/subviews/Summary/QuickLink.html";
import * as MessageUtil from "app/utils/MessageUtil";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";
import AddonSummaryFooter from "app/views/common/AddonSummaryFooter";

export default BaseSubView.extend({
    events: {
        "click .ta-icon-large": "onQuickLinkClick",
        "click .ta-quick-link-description": "onQuickLinkTextClick",
        "click .ta-quick-link-title": "onQuickLinkTextClick"
    },
    template: Template,
    className: "ta-sub-view ta-sub-view-summary",

    initialize() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.compiledQuickLinkTemplate = _.template(QuickLinkTemplate);
    },

    render() {
        var appDisplayName = this.controller.getAppDisplayName();
        this.$el.empty();
        this.$el.html(this.compiledTemplate({}));
        this.createChild("helpLinkHeader", HelpLinkHeader, {
            title: _.t("Add-on: ") + appDisplayName,
            helpLinkKey: "step_summary"
        });
        this.$el.prepend(this.children.helpLinkHeader.render().$el);

        this.createQuickLink({
            title: _.t("Configure Data Collection"),
            description: MessageUtil.getFormattedMessage(7000),
            view: "data-collection",
            icon: "ta-icon-add-data"
        });
        this.createQuickLink({
            title: _.t("Create Alert Actions"),
            description: MessageUtil.getFormattedMessage(7001),
            view: "modular-alert",
            icon: "ta-icon-modular-alert"
        });

        this.createChild("addonSummary", AddonSummaryFooter);
        this.$el.append(this.children.addonSummary.render().$el);

        return this;
    },
    createDownloadLink(options) {
        this.$(".ta-quick-link-container").append(
            this.compiledDownloadLinkTemplate(options)
        );
    },
    createQuickLink(options) {
        this.$(".ta-quick-link-container").append(
            this.compiledQuickLinkTemplate(options)
        );
    },
    onQuickLinkClick(event) {
        event.preventDefault();
        this.controller.navigate({
            view: $(event.currentTarget.parentNode.parentNode).data("view"),
            refreshNav: true
        });
    },
    onQuickLinkTextClick(event) {
        event.preventDefault();
        this.controller.navigate({
            view: $(event.currentTarget.parentNode).data("view"),
            refreshNav: true
        });
    },
    fillDownloadLink(model) {
        let downloadlink = model.get("link", "#");
        this.$(".ta-download-link .ta-download-link-icon a").attr(
            "href",
            downloadlink
        );
        this.$(".ta-download-link .ta-download-link-title a").attr(
            "href",
            downloadlink
        );
        this.$(".ta-download-link .ta-download-link-description a").attr(
            "href",
            downloadlink
        );

        this.$(".ta-download-link").addClass("ta-download-enabled");
    }
});
