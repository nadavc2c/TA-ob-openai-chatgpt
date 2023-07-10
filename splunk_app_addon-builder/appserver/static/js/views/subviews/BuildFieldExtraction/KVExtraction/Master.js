import _ from "lodash";
import Template from "contrib/text!./Master.html";
import BaseExtractionView from "../BaseExtractionView";
import { getHelpLinkObj } from "app/utils/HelpLinkUtil";
import GetKVFormatResult
    from "app/models/build_field_extraction/get_kv_format_result";
import SaveKVFormatResult
    from "app/models/build_field_extraction/save_kv_format_result";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant";
import DataSummary from "./DataSummary";
import ExtractionSelectView from "./ExtractionSelectView";
import EventTable from "./EventTable/Master";

export default BaseExtractionView.extend({
    template: Template,

    initialize: function() {
        BaseExtractionView.prototype.initialize.apply(this, arguments);

        // console.log('kvdata', this._data);

        this.saveResultModel = new SaveKVFormatResult({
            app_name: this.controller.getAppName(),
            sourcetype: this._sourcetype,
            delim_kv: this._data.delim_kv,
            delim_pair: this._data.delim_pair,
            regex: this._data.regex
        });
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                sourcetype: this._sourcetype,
                helplink: getHelpLinkObj("step_fieldextraction_kv")
            })
        );
        this.renderSaveCancel();
        this.children.dataSummary = new DataSummary({
            data: this._data,
            sourcetype: this._sourcetype,
            formatLabel: Constant.LABEL_KV
        });
        this.createChild("extractionSelect", ExtractionSelectView, {
            model: this.model,
            data: this._data
        });
        this.children.table = new EventTable({
            limit: 20,
            eventContents: this._data.events
        });
        this.$(".tbStep-view-content").append(
            this.children.dataSummary.render().$el
        );
        this.$(".tbStep-view-content").append(
            this.children.extractionSelect.render().$el
        );
        this.$(".tbStep-view-content").append(this.children.table.render().$el);
        this.listenTo(
            this.children.extractionSelect,
            "regexChange",
            this.onRegexChange
        );
        this.listenTo(
            this.children.extractionSelect,
            "delimiterChange",
            this.onDelimiterChange
        );
        return this;
    },
    onRegexChange: function(regex) {
        var data = {
            regex: regex,
            delim_pair: null,
            delim_kv: null
        };
        this.requestKVResult(data);
        this.saveResultModel.set("regex", regex);
        this.saveResultModel.unset("delim_pair");
        this.saveResultModel.unset("delim_kv");
    },
    onDelimiterChange: function(delim1, delim2) {
        var data = {
            regex: null,
            delim_pair: delim1,
            delim_kv: delim2
        };
        this.requestKVResult(data);
        this.saveResultModel.set("delim_pair", delim1);
        this.saveResultModel.set("delim_kv", delim2);
        this.saveResultModel.unset("regex");
    },
    requestKVResult: function(data) {
        _.defaults(data, {
            app_name: this.controller.getAppName(),
            sourcetype: this._sourcetype
        });
        if (this.xhr && this.xhr.state() === "pending") {
            this.xhr.abort("manual");
        }
        var get = new GetKVFormatResult();
        this.children.table.removeChildren();
        this.children.dataSummary.setData({});
        this.xhr = get.fetch({
            type: "POST",
            data: data
        });
        this.clearError();
        this.children.table.showLoading();
        this.xhr
            .done(response => {
                if (response.err_code) {
                    this.showFormattedError(response);
                } else {
                    this._data = response.data;
                    this.children.dataSummary.setData(this._data);
                    this.children.table.update({
                        eventContents: this._data.events
                    });
                }
            })
            .fail(() => {
                this.showFormattedError(4100);
            });
    },
    saveResultsToServer: function() {
        this.clearError();
        this.disableFunctionalButtons();
        var xhr = this.saveResultModel.save({});
        if (xhr) {
            xhr
                .always(() => {
                    this.enableFunctionalButtons();
                })
                .done(response => {
                    if (response.err_code) {
                        this.showFormattedError(response);
                    } else {
                        this.controller.navigate({
                            view: "field-extraction"
                        });
                    }
                })
                .fail(() => {
                    this.showFormattedError(4001);
                });
        }
    }
});
