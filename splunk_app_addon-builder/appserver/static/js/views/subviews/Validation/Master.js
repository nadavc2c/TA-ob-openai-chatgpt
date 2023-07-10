import $ from "jquery";
import _ from "lodash";
import { splunkUtils } from "swc-aob/index";

import { SplunkMvc } from "swc-aob/index";
import { SplunkTableView } from "swc-aob/index";

import { TableElement } from "swc-aob/index";

import BaseSubView from "app/views/subviews/BaseSubView";
import SingleValuePresenter from "./SingleValuePresenter";
import GaugeChartPresenter from "./GaugeChartPresenter";
import ColumnChartPresenter from "./ColumnChartPresenter";
import CertificationReadyBanner from "./CertificationReadyBanner";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader";

import ValidationForm from "./ValidationForm";
import PackageGenerate from "app/models/step_view/summary/package_generate";

import * as MessageUtil from "app/utils/MessageUtil";
import * as SearchManagerUtil from "app/utils/SearchManagerUtil";
import BaseSearchPresenter from "app/views/subviews/BaseSearchPresenter";
import Collector from "app/profiles/partyjsCollector";
import Template from "contrib/text!./Master.html";

let MvcComponents = SplunkMvc.Components;
const ICONS = {
    _1severe: "alert",
    _2elevated: "warning",
    _3low: "box-checked"
};

const SEVERITY = {
    _1severe: "severe",
    _2elevated: "elevated",
    _3low: "low"
};
// customized table render
let RangeMapIconRenderer = SplunkTableView.BaseCellRenderer.extend({
    initialize() {
        SplunkTableView.BaseCellRenderer.prototype.initialize.apply(
            this,
            arguments
        );
        this.cellTemplate = _.template(
            '<div class="multivalue-subcell"><i class="icon-<%-icon%> <%- range %>" title="<%- range %>"></i>&nbsp;<%-text%></div>'
        );
    },

    canRender(cell) {
        // Only use the cell renderer for the severity field
        return cell.field.match(/[Ss]everity/);
    },
    render($td, cell) {
        var icon = null, range = null, text = null;
        if (_.isString(cell.value)) {
            var val = cell.value.split("!!!");
            if (ICONS.hasOwnProperty(val[0])) {
                icon = ICONS[val[0]];
                range = SEVERITY[val[0]];
                text = val[1] != null ? val[1] : "";
            }
            if (icon) {
                // Create the icon element and add it to the table cell
                $td.addClass("icon").append(
                    this.cellTemplate({
                        icon: icon,
                        range: range,
                        text: text
                    })
                );
            }
        }
    }
});

export default BaseSubView.extend({
    template: Template,

    initialize: function() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        this.packageGenerator = new PackageGenerate();
        this.listenTo(this.packageGenerator, "sync", this.fillDownloadLink);
        this._initializeToken();
        this._initializeSearch();
        this.validationTerminated = false;
    },
    events: {
        "click .btn-download": "onDownloadClick",
        "click .ta-section-top": "unselectAllElement"
    },
    _initializeToken: function() {
        // token
        this.defaultTokenModel = MvcComponents.get("default", {
            create: true
        });
    },

    _initializeSearch: function() {
        this.searches = {};
        // search managers
        this.searches.scoreSearch = SearchManagerUtil.getOrCreateSearchManager({
            id: "score_search",
            // the algorithm of final score:
            // 1. if there is errors, total_score=70, otherwise it's 100
            // 2. gap = (total_error*2 + total_warn) / total_rule_count * 100
            // 3. score = total_score - gap, if <10, use 10 as the score
            search: 'index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible="true" status!="" | eval error_count=if(severity="Fatal", 1, 0) | eval warn_count=if(severity="Warning", 1, 0) | eval rule_run = 1 | stats sum(error_count) as total_error, sum(warn_count) as total_warn, sum(rule_run) as total_run | eval total_score=if(total_error=0, 100, 70) | eval score=total_score - floor((total_error*2 + total_warn) / total_run * 100) | eval final_score=if(score>10, score, 10)| fields final_score',
            auto_cancel: 1800,
            autostart: false
        });
        this.searches.appCertInternalErrSearch = SearchManagerUtil.getOrCreateSearchManager(
            {
                id: "app_cert_internal_error_search",
                search: "index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible=false message_id=7001 | fields sub_category, description, solution ",
                auto_cancel: 1800,
                autostart: false
            }
        );
        this.searches.errorSearch = SearchManagerUtil.getOrCreateSearchManager({
            id: "error_search",
            search: 'index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible="true" severity=Fatal | stats count as "tcount"',
            autostart: false
        });
        this.searches.warnSearch = SearchManagerUtil.getOrCreateSearchManager({
            id: "warning_search",
            search: 'index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible="true" severity=Warning | stats count as "tcount"',
            autostart: false
        });
        this.searches.passSearch = SearchManagerUtil.getOrCreateSearchManager({
            id: "pass_search",
            search: 'index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible="true" status=Pass | stats count as "tcount"',
            autostart: false
        });
        this.searches.ruleDistSearch = SearchManagerUtil.getOrCreateSearchManager(
            {
                id: "rule_distribution_search",
                search: 'index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible="true" status!="" | eval passed =if(match(status, "Pass"), 1, 0) | eval warned = if(match(severity, "Warning"), 1, 0) | eval errored = if(match(severity, "Fatal"), 1, 0) | chart sum(errored) as Error, sum(warned) as Warning, sum(passed) as Pass over category',
                autostart: false
            }
        );
        this.searches.ruleDetailSearch = SearchManagerUtil.getOrCreateSearchManager(
            {
                id: "rule_detail_search",
                // use _1severe and _2elevated as the prefix, then, fatal rules are at the beginning
                search: 'index=add_on_builder_index source=tabuilder validation_id=$v_id$ ext_data.is_visible="true" $v_severity$ $v_category$ | eval severity= coalesce(case(match(severity, "Warning"), "_2elevated!!!Warning" , match(severity, "Fatal"), "_1severe!!!Error", match(severity, "Pass"), "_3low!!!Pass"), severity) | rename rule_name as "Rule Name" severity as "Severity" display_category as "Category" description as "Description" solution as "Solution Suggestion"|table Rule*, Severity, Category, Description, Solution*  | sort Severity',
                autostart: false
            }
        );
    },

    enableRealtimeSearch() {
        this.defaultTokenModel.set({
            earliest_search_time: "rt-1h",
            latest_search_time: "rtnow",
            search_mode: "realtime"
        });
    },

    enableNormalSearch() {
        this.defaultTokenModel.set({
            earliest_search_time: "-7d",
            latest_search_time: "now",
            search_mode: "normal"
        });
    },

    startSearch() {
        this.controlSearches("startSearch", true);
    },

    cancelSearch() {
        this.controlSearches("cancel");
    },

    finalizeSearch() {
        this.controlSearches("finalize");
    },

    pauseSearch() {
        this.controlSearches("pause");
    },

    controlSearches(method, ...params) {
        _.each(this.searches, search => {
            (_.isFunction(method) ? method : search[method]).apply(
                search,
                params
            );
        });
    },
    render() {
        this.$el.empty();
        this.$el.html(this.compiledTemplate());

        this.createChild("helpLinkValidationHeader", HelpLinkHeader, {
            title: _.t("Validate & Package"),
            helpLinkKey: "step_validate"
        });
        this.children.helpLinkValidationHeader
            .render()
            .$el.insertBefore(this.$(".ta-sub-view-validation-content"));

        this.createChild("validationForm", ValidationForm, {
            model: this.model,
            parentView: this
        });
        this.$(".ta-sub-view-validation-controller-container").prepend(
            this.children.validationForm.render().$el
        );

        this.listenTo(this.model, "startValidation", this.onStartValidation);
        this.listenTo(this.model, "finishValidation", this.onFinishValidation);
        this.listenTo(
            this.model,
            "terminateValidation",
            this.onTerminateValidation
        );
        this.listenTo(this.model, "showDashboard", this.onShowDashboard);
        // create the input forms for validators
        this.renderRuleTable();
        this.$(".ta-validation-overall-container").hide();
        this.$(".ta-validation-detail-container").hide();

        this.disableElement(".btn-download");
        this.packageGenerator.fetch({
            data: {
                app_name: this.controller.getAppName()
            },
            type: "GET",
            reset: true
        });
        return this;
    },
    getValidatorMap() {
        if (!this.children.validationForm) {
            return {};
        }
        return this.children.validationForm.getValidatorMap();
    },
    createPresenter(searchName, className, options) {
        let childName = `${searchName}Presenter`;
        if (this.children[childName]) {
            this.children[childName].remove();
        }
        return this.createChild(
            childName,
            className,
            _.extend(
                {
                    searchManager: this.searches[searchName]
                },
                options
            )
        );
    },
    getPresenter(searchName) {
        return this.children[`${searchName}Presenter`];
    },
    renderSingleValues() {
        // creates the views and bind to the search managers
        this.createPresenter("scoreSearch", GaugeChartPresenter, {
            value: 'status!=""'
        })
            .render()
            .$el.appendTo(
                this.$(
                    ".ta-section-left .ta-section-top .ta-health-score-container"
                )
            );

        this.$(
            ".ta-section-left .ta-section-top .ta-certification-ready-banner .no-certification-banner"
        ).remove();
        if (
            this.model.get("validators") &&
            _.includes(
                splunkUtils.stringToFieldList(this.model.get("validators")),
                "app_cert_validation"
            )
        ) {
            this.createPresenter(
                "appCertInternalErrSearch",
                CertificationReadyBanner,
                {
                    errorSearch: this.searches.errorSearch,
                    warnSearch: this.searches.warnSearch,
                    parentView: this
                }
            )
                .render()
                .$el.appendTo(
                    this.$(
                        ".ta-section-left .ta-section-top .ta-certification-ready-banner"
                    )
                );
        } else {
            let child = this.getPresenter("appCertInternalErrSearch");
            if (child) {
                child.remove();
            }
            this.$(
                ".ta-section-left .ta-section-top .ta-certification-ready-banner"
            ).html(
                $(
                    `<div class="no-certification-banner"><div class="ta-cert-title">${_.t("No results for certification")}</div><div class="ta-cert-description">${MessageUtil.getFormattedMessage(6012)}</div></div>`
                )
            );
        }

        this.createPresenter("errorSearch", SingleValuePresenter, {
            title: _.t("Error"),
            icon: "icon-error",
            value: "severity=Fatal"
        })
            .render()
            .$el.appendTo(this.$(".ta-section-left .ta-section-bottom"));

        this.createPresenter("warnSearch", SingleValuePresenter, {
            title: _.t("Warning"),
            icon: "icon-warning",
            value: "severity=Warning"
        })
            .render()
            .$el.appendTo(this.$(".ta-section-left .ta-section-bottom"));

        this.createPresenter("passSearch", SingleValuePresenter, {
            title: _.t("Pass"),
            icon: "icon-box-checked",
            value: "status=Pass"
        })
            .render()
            .$el.appendTo(this.$(".ta-section-left .ta-section-bottom"));
        this.addSingleValueClickListeners();
    },
    addSingleValueClickListeners() {
        this.listenTo(
            this.getPresenter("scoreSearch"),
            "click",
            this.onSingleValuePresenterClick
        );
        this.listenTo(
            this.getPresenter("errorSearch"),
            "click",
            this.onSingleValuePresenterClick
        );
        this.listenTo(
            this.getPresenter("warnSearch"),
            "click",
            this.onSingleValuePresenterClick
        );
        this.listenTo(
            this.getPresenter("passSearch"),
            "click",
            this.onSingleValuePresenterClick
        );
    },
    onSingleValuePresenterClick(value, instance) {
        this.unselectAllSingleValuePresenters();
        if (instance && _.isFunction(instance.select)) {
            instance.select();
        }
        this.refreshDetailTable({
            severity: value
        });
        this.unselectColumns();
    },
    unselectAllSingleValuePresenters() {
        this.getPresenter("errorSearch").unselect();
        this.getPresenter("warnSearch").unselect();
        this.getPresenter("passSearch").unselect();
    },
    refreshDetailTable({ severity = 'status!=""', category = 'category!=""' }) {
        this.defaultTokenModel.set({
            v_severity: severity,
            v_category: category
        });
        if (this.defaultTokenModel.hasChanged()) {
            // reset table's page to zero.
            this.detailRuleTable.visualization.paginator.settings.set(
                "page",
                0
            );
            this.searches.ruleDetailSearch.startSearch(false);
        }
    },
    renderColumnChart() {
        this.createPresenter("ruleDistSearch", ColumnChartPresenter, {
            categories: splunkUtils.stringToFieldList(
                this.model.get("validators")
            ),
            categoryMapper: this.getValidatorMap.bind(this)
        })
            .render()
            .$el.appendTo(this.$(".ta-section-right"));

        this.listenTo(
            this.getPresenter("ruleDistSearch"),
            "select",
            this.onChartSelect
        );
    },
    onChartSelect(series, category) {
        this.updateRuleDetailTable(series, category);
        this.unselectAllSingleValuePresenters();
    },
    updateRuleDetailTable(series, category) {
        let v_category;
        if (category) {
            v_category = `category="${category}"`;
        } else {
            v_category = 'category!=""';
        }
        let v_severity = 'status!=""';
        switch (series) {
            case "Error":
                v_severity = "severity=Fatal";
                break;
            case "Warning":
                v_severity = "severity=Warning";
                break;
            case "Pass":
                v_severity = "status=Pass";
                break;
        }
        this.refreshDetailTable({
            severity: v_severity,
            category: v_category
        });
    },
    unselectColumns() {
        this.getPresenter("ruleDistSearch").unselectColumns();
    },
    renderRuleTable: function() {
        if (MvcComponents.hasInstance("detail_rule_table")) {
            MvcComponents.revokeInstance("detail_rule_table");
        }
        this.detailRuleTable = new TableElement(
            {
                id: "detail_rule_table",
                data: "preview",
                drilldown: "row",
                drilldownRedirect: false,
                height: "100%",
                managerid: "rule_detail_search",
                wrap: false
            },
            {
                tokens: true
            }
        ).render();
        this.listenTo(this.detailRuleTable, "click:row", this.onDetailRowClick);

        this.detailRuleTable.getVisualization(viz => {
            viz.addCellRenderer(new RangeMapIconRenderer());
        });

        this.detailRuleTable.$el
            .addClass("dashboard-element")
            .appendTo(this.$(".ta-validation-detail-table"));
    },
    onDetailRowClick(event) {
        event.preventDefault();
        event.drilldown({
            drilldownNewTab: true
        });
    },
    onShowDashboard() {
        this.renderSingleValues();
        this.renderColumnChart();
        this.$(".ta-validation-overall-container").show();
        this.$(".ta-validation-detail-container").show();
    },
    onStartValidation(validationId) {
        this.validationTerminated = false;
        this.defaultTokenModel.set({
            v_id: validationId,
            v_severity: 'status!=""',
            v_category: 'category!=""'
        });
        this.onShowDashboard();
        this.startPresentersPreviewListening();
        this.enableRealtimeSearch();
        this.startSearch();
        this._startValidateTime = new Date();
    },
    onFinishValidation(validationId) {
        if (
            validationId &&
            this.defaultTokenModel.get("vid") !== validationId
        ) {
            this.defaultTokenModel.set({
                v_id: validationId,
                v_severity: 'status!=""',
                v_category: 'category!=""'
            });
        }
        this.cancelSearch();
        this.startPresentersResultsListening();
        this.enableNormalSearch();
        this.startSearch();
        if (this._startValidateTime) {
            Collector.collect("track_validation", {
                timeStart: this._startValidateTime.getTime(),
                timeEnd: new Date().getTime(),
                categories: splunkUtils.stringToFieldList(
                    this.model.get("validators")
                ),
                score: this.children.scoreSearchPresenter.value,
                num_of_warnings: this.children.warnSearchPresenter.value,
                num_of_errors: this.children.errorSearchPresenter.value,
                num_of_passes: this.children.passSearchPresenter.value,
                app_name: this.controller.getAppName()
            });
            this._startValidateTime = null;
        }
    },
    onTerminateValidation(validationId) {
        this.validationTerminated = true;
        this.onFinishValidation(validationId);
    },
    isValidationTerminated() {
        return this.validationTerminated;
    },
    startPresentersPreviewListening: function() {
        _.each(this.children, child => {
            if (child instanceof BaseSearchPresenter) {
                child.startPreviewListening();
            }
        });
    },
    startPresentersResultsListening: function() {
        _.each(this.children, child => {
            if (child instanceof BaseSearchPresenter) {
                child.startResultsListening();
            }
        });
    },
    onDownloadClick(event) {
        if ($(event.currentTarget).attr("disabled")) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    },
    fillDownloadLink(model) {
        let downloadlink = model.get("link", "#");
        const collectedData = {
            app_name: this.controller.getAppName()
        };
        const collectDownload = () => {
            Collector.collect("track_package", collectedData);
        };
        this.$(".btn-download")
            .attr("href", downloadlink)
            .click(collectDownload);
        this.enableElement(".btn-download");
    },
    unselectAllElement(e) {
        e.preventDefault();
        e.stopPropagation();
        this.unselectColumns();
        this.unselectAllSingleValuePresenters();
        this.updateRuleDetailTable(null, null); // show all rules
    }
});
