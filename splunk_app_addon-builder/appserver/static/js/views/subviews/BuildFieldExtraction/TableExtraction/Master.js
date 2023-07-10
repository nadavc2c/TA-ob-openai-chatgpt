import Template from "contrib/text!./Master.html";
import BaseExtractionView from "../BaseExtractionView";
import { getHelpLinkObj } from "app/utils/HelpLinkUtil";
import { removeAll } from "app/utils/EditablePopoverUtil";
import GetTableFormatResult
    from "app/models/build_field_extraction/get_table_format_result";
import SaveTableFormatResult
    from "app/models/build_field_extraction/save_table_format_result";
import RadioButtonGroupWithInput
    from "app/components/controls/RadioButtonGroupWithInput";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant";
import Table from "./Table";
import DataSummary from "./DataSummary";

export default BaseExtractionView.extend({
    template: Template,

    initialize: function() {
        BaseExtractionView.prototype.initialize.apply(this, arguments);

        this.tableFormatSaver = new SaveTableFormatResult({
            sourcetype: this._sourcetype,
            app_name: this.controller.getAppName()
        });
        this.tableFormatSaver.listenTo(this.model, "change:delimiter", function(
            model,
            value
        ) {
            if (!value) {
                return;
            }
            this.set("delim", value);
        });
        this.model.set(
            "delimiter",
            this._data.delim == null ? " " : this._data.delim
        );
        this.listenTo(this.model, "change:delimiter", this.onDelimiterChange);
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                sourcetype: this._sourcetype,
                helplink: getHelpLinkObj("step_fieldextraction_table")
            })
        );
        this.renderSaveCancel();
        this.children.delimiterBtnGroup = new RadioButtonGroupWithInput({
            model: this.model,
            modelAttribute: "delimiter",
            items: [
                {
                    value: " ",
                    label: "Space"
                },
                {
                    value: ",",
                    label: "Comma"
                },
                {
                    value: "\\t",
                    label: "Tab"
                },
                {
                    value: "|",
                    label: "Pipe"
                }
            ]
        });
        this.children.dataSummary = new DataSummary({
            data: this._data,
            sourcetype: this._sourcetype,
            formatLabel: Constant.LABEL_TABLE
        });
        this.$(".tbStep-view-content").prepend(
            this.children.dataSummary.render().$el
        );
        this.$(".table-delimiter-container").append(
            this.children.delimiterBtnGroup.render().$el
        );
        this.renderTable();
        return this;
    },
    renderTable: function() {
        if (this.children.table) {
            this.children.table.setData(this._data);
        } else {
            this.children.table = new Table({
                data: this._data,
                limit: 20
            });
            this.$(".tbStep-view-content").append(
                this.children.table.render().$el
            );
        }
    },
    onDelimiterChange: function() {
        removeAll();
        var delimiter = this.model.get("delimiter");
        if (!delimiter || delimiter === "") {
            return;
        }
        if (this.xhr && this.xhr.state() === "pending") {
            this.xhr.abort("manual");
        }
        var get = new GetTableFormatResult();
        this.children.table.removeChildren();
        this.children.table.showLoading();
        this.children.dataSummary.setData({});
        this.xhr = get.fetch({
            type: "POST",
            data: {
                app_name: this.controller.getAppName(),
                sourcetype: this._sourcetype,
                delim: delimiter
            }
        });
        this.clearError();
        this.xhr
            .done(response => {
                if (response.err_code) {
                    this.showFormattedError(response);
                } else {
                    this._data = response.data;
                    this.tableFormatSaver.set("headers", this._data.header);
                    this.children.dataSummary.setData(this._data);
                    this.renderTable();
                }
            })
            .fail(() => {
                this.showFormattedError(4101);
            });
    },

    saveResultsToServer: function() {
        // fetch header values from table
        this.tableFormatSaver.set(
            "headers",
            this.children.table.getTableHead()
        );
        this.clearError();
        this.disableFunctionalButtons();
        var xhr = this.tableFormatSaver.save({});
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
    },
    onCancelClick: function() {
        removeAll();
        BaseExtractionView.prototype.onCancelClick.apply(this, arguments);
    }
});
