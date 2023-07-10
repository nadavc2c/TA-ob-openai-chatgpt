import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import Template from "contrib/text!app/views/common/AddonSummaryFooter.html";
import BlockTemplate
    from "contrib/text!app/views/common/AddonSummaryFooterBlock.html";
import TASummary from "app/models/step_view/summary/ta_summary";
import MASummary
    from "app/collections/step_view/modular_alert/modular_alert_summary";
import ETSummary from "app/models/build_cim/get_eventtype_info";
import Collector from "app/profiles/partyjsCollector";
import ValidationLoad from "app/models/ta_validation/load_validation";
import { getOrCreateSearchManager } from "app/utils/SearchManagerUtil";
import { SplunkMvc } from "swc-aob/index";

const MvcComponents = SplunkMvc.Components;

const getValidationId = function(appId) {
    // get vlidation Id
    let promise = new Promise(function(resolve, reject) {
        var loadValidation = new ValidationLoad();
        loadValidation
            .fetch({
                type: "POST",
                data: {
                    app_name: appId
                }
            })
            .done(response => {
                if (response.validation_id) {
                    resolve(response.validation_id);
                } else {
                    reject();
                }
            });
    });
    return promise;
};

let FooterBlock = BaseSubViewComponent.extend({
    className: "ta-footer-block",
    template: BlockTemplate,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.model = new Backbone.Model({
            title: this.options.title || "",
            description: this.options.description || "",
            content: this.options.content || "-"
        });
        this.view = this.options.view;
    },
    render() {
        this.$el.html(this.compiledTemplate(this.model.toJSON()));
        return this;
    },
    events: {
        click: "onBlockClick"
    },
    setColor(color = "#000") {
        this.$(".ta-footer-block-content").css("color", color);
    },
    setContent(content) {
        this.$(".ta-footer-block-content").text(content);
        return this;
    },
    onBlockClick() {
        this.controller.navigate({
            view: this.view,
            refreshNav: true
        });
    }
});

export default BaseSubViewComponent.extend({
    className: "ta-addon-summary-footer",
    template: Template,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.taSummaryModel = new TASummary();
        this.maSummaryModel = new MASummary();
        this.etSummaryModel = new ETSummary();
        this.listenTo(this.taSummaryModel, "sync", this.renderTAContent);
        this.listenTo(this.maSummaryModel, "sync", this.renderMAContent);
        this.listenTo(this.etSummaryModel, "sync", this.renderCIMContent);
        this.defaultTokenModel = MvcComponents.get("default", {
            create: true
        });
    },
    render() {
        this.$el.html(this.compiledTemplate());
        this.createChild("validationBlock", FooterBlock, {
            title: _.t("Validation Score"),
            description: _.t(""),
            view: "validation"
        });
        this.createChild("dataCollectionBlock", FooterBlock, {
            title: _.t("Data Inputs"),
            description: _.t(""),
            view: "data-collection"
        });
        this.createChild("fieldExtractionBlock", FooterBlock, {
            title: _.t("Extracted Fields"),
            description: _.t(""),
            view: "field-extraction"
        });
        this.createChild("cimMappingBlock", FooterBlock, {
            title: _.t("Event Types"),
            description: _.t(""),
            view: "cim-mapping"
        });
        this.createChild("modularAlertBlock", FooterBlock, {
            title: _.t("Alert Actions"),
            description: _.t(""),
            view: "modular-alert"
        });
        _.each(this.children, child => {
            child.render().$el.appendTo(this.$(".ta-footer-content"));
        });

        let xhrs = [];
        xhrs.push(
            this.taSummaryModel.fetch({
                data: {
                    app_name: this.controller.getAppName()
                },
                type: "GET",
                reset: true
            })
        );
        xhrs.push(this.maSummaryModel.fetch());
        xhrs.push(this.etSummaryModel.fetch());

        let getScore = this.getValidationScore();
        getScore.then(this.renderValidationScore.bind(this));
        xhrs.push(getScore);

        $.when(...xhrs).done(() => {
            let collectedData = {};
            collectedData.validationScore = this.validationScore;
            collectedData.sourcetype = this.taSummaryModel.get(
                "sourcetype_summary"
            );
            collectedData.modular_alert = _(this.maSummaryModel.toJSON())
                .map(model =>
                    _.omit(model, ["code", "smallIcon", "largeIcon", "uuid"])
                )
                .value();
            collectedData.event_type = this.etSummaryModel.toJSON();
            Collector.collect("track_addon_summary", collectedData);
        });
        return this;
    },
    renderTAContent() {
        let dataCount = this.taSummaryModel.get("input_count", 0);
        let fieldExtCount = 0;
        _.each(this.taSummaryModel.get("sourcetype_summary") || [], item => {
            if (item.has_field_extraction) {
                fieldExtCount++;
            }
        });
        this.children.dataCollectionBlock.setContent(dataCount);
        this.children.fieldExtractionBlock.setContent(fieldExtCount);
    },
    renderValidationScore(data) {
        let value;
        try {
            value = +data.rows[0][0];
            if (isNaN(value) || value < 0) {
                value = "-";
            }
        } catch (err) {
            value = "-";
        }
        let color;
        this.validationScore = value;
        if (_.isString(value)) {
            this.validationScore = null;
            color = "#000";
        } else {
            color = value >= 90
                ? "#5dc05c"
                : value >= 70 ? "#ffd162" : "#ff4f5a";
        }
        if (this.children.validationBlock) {
            // this if line is necessary, cuz user may leave, but the ajax call may still trigger the callback
            this.children.validationBlock.setColor(color);
            this.children.validationBlock.setContent(value);
        }
    },
    renderMAContent() {
        this.children.modularAlertBlock.setContent(this.maSummaryModel.length);
    },
    renderCIMContent() {
        this.children.cimMappingBlock.setContent(
            this.etSummaryModel.get("data").length
        );
    },

    getValidationScore() {
        let dfd = $.Deferred();
        const appName = this.controller.getAppName();
        getValidationId(appName)
            .then(validationId => {
                const searchScore = getOrCreateSearchManager({
                    id: "score_search",
                    search: 'index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible="true" status!="" | eval error_count=if(severity="Fatal", 1, 0) | eval warn_count=if(severity="Warning", 1, 0) | eval rule_run = 1 | stats sum(error_count) as total_error, sum(warn_count) as total_warn, sum(rule_run) as total_run | eval total_score=if(total_error=0, 100, 70) | eval score=total_score - floor((total_error*2 + total_warn) / total_run * 100) | eval final_score=if(score>10, score, 10)| fields final_score',
                    auto_cancel: 1800,
                    autostart: false
                });
                searchScore.data("results").on("data", (model, data) => {
                    if (!data) {
                        return;
                    }
                    dfd.resolve(data);
                });
                this.defaultTokenModel.set({
                    v_id: validationId,
                    earliest_search_time: "-7d",
                    latest_search_time: "now",
                    search_mode: "normal"
                });
                searchScore.startSearch(true);
            })
            .catch(() => {
                dfd.resolve(null);
            });

        return dfd;
    }
});
