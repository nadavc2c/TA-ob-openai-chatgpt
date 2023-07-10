import Template from "contrib/text!./Master.html";
import BaseExtractionView from "../BaseExtractionView";
import { getHelpLinkObj } from "app/utils/HelpLinkUtil";
import SaveXMLFormatResult
    from "app/models/build_field_extraction/save_xml_format_result";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant";
import DataSummary from "./DataSummary";
import EventTable from "./EventTable/Master";

export default BaseExtractionView.extend({
    template: Template,

    initialize: function() {
        BaseExtractionView.prototype.initialize.apply(this, arguments);

        this.saveResultModel = new SaveXMLFormatResult({
            app_name: this.controller.getAppName(),
            sourcetype: this._sourcetype
        });
    },
    render: function() {
        this.$el.html(
            this.compiledTemplate({
                sourcetype: this._sourcetype,
                helplink: getHelpLinkObj("step_fieldextraction_xml")
            })
        );
        this.renderSaveCancel();
        this.children.dataSummary = new DataSummary({
            data: this._data,
            sourcetype: this._sourcetype,
            formatLabel: Constant.LABEL_XML
        });
        this.children.table = new EventTable({
            limit: 20,
            eventContents: this._data
        });
        this.$(".tbStep-view-content").append(
            this.children.dataSummary.render().$el
        );
        this.$(".tbStep-view-content").append(this.children.table.render().$el);
        return this;
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
