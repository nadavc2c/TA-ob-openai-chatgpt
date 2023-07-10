import $ from "jquery";
import _ from "lodash";
import DeleteDataInput from "app/models/create_project/delete_data_input";
import DataInputSummaryCollection
    from "app/collections/step_view/configure_data_collection/data_inputs_summary";
import * as DialogUtil from "app/utils/DialogUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import * as DataCollectionUtil
    from "app/views/subviews/ConfigureDataInput/DataCollectionUtil";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import RowTemplate from "contrib/text!./Row.html";
import TableTemplate from "contrib/text!./Master.html";
import Collector from "app/profiles/partyjsCollector";
import WaitSpinner from "app/components/WaitSpinner";

const ActionCell = BaseSubViewComponent.extend({
    tagName: "td",
    className: "ta-input-action-cell",
    initialize(options) {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.tableView = options.tableView;
        this.collection = options.collection;
    },
    render() {
        this.$el.append('<a class="edit">' + _.t("Edit") + "</a>");
        this.$el.append('<a class="delete">' + _.t("Delete") + "</a>");
        let model = this.model;
        if (model.get("type") === DataCollectionUtil.INPUT_TYPES.CUSTOMIZED) {
            this.$el.append('<a class="code">' + _.t("Code") + "</a>");
        }
        return this;
    },
    events: {
        "click a.edit": "onEditClick",
        "click a.delete": "onDeleteClick",
        "click a.code": "onCodeClick"
    },

    onEditClick() {
        this.controller.navigate({
            view: "data-collection",
            action: "edit",
            params: {
                model: this.model
            }
        });
    },
    onCodeClick() {
        this.controller.navigate({
            view: "data-collection",
            action: "code",
            params: {
                model: this.model
            }
        });
    },
    onDeleteClick() {
        this.parentView.clearError();
        DialogUtil.showDialog({
            el: $("#delete-confirm-modal"),
            title: "Deleting an input",
            content: MessageUtil.getFormattedMessage(4, this.model.get("name")),
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Delete"),
            yesCallback: dialog => {
                var deleteDataInput = new DeleteDataInput(this.model.toJSON());
                dialog.disableYesNo();
                deleteDataInput.save(
                    {},
                    {
                        success: (model, response) => {
                            if (response.status === "success") {
                                Collector.collect("track_deletion", {
                                    type: "modular-input",
                                    data: {
                                        name: this.model.get("name"),
                                        type: this.model.get("type")
                                    }
                                });
                                this.tableView.render();
                            } else if (response.err_code) {
                                this.parentView.showFormattedError(response);
                            }
                            dialog.hideModal();
                        },
                        error: (model, response) => {
                            this.parentView.showError(
                                _.escape(response.responseText)
                            );
                        }
                    }
                );
                return false;
            }
        });
    }
});

export default BaseSubViewComponent.extend({
    template: TableTemplate,
    initialize: function(options) {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.options = options || {};
        this.compiledRowTemplate = _.template(RowTemplate);
        this.collection = new DataInputSummaryCollection();
        this._actionCells = {};
        this.listenTo(this.collection, "sync", this.renderTable);
    },

    render: function() {
        _.each(this._actionCells, cell => cell.remove());
        this._actionCells = {};
        this.showLoading();
        this.collection.fetch(); // update the models
        return this;
    },

    renderTable: function() {
        this.hideLoading();
        this.$("tbody tr").remove();
        this.collection.each(summary => {
            this.$("tbody").append(this.renderRow(summary));
        });
        if (this.collection.length < 10) {
            var count = 10 - this.collection.length;
            for (var i = 0; i < count; i++) {
                this.$("tbody").append(this.renderEmptyRow());
            }
        }
        return this;
    },

    renderEmptyRow: function() {
        return "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>";
    },
    renderRow: function(model) {
        var name = model.get("name");
        var row = $(
            this.compiledRowTemplate({
                name: name,
                description: model.get("description"),
                category: DataCollectionUtil.getInputCategoryName(model),
                sourcetype: model.get("sourcetype"),
                sample: model.get("sample_count")
            })
        );
        var actionCell = new ActionCell({
            model: model,
            parentView: this.parentView,
            tableView: this,
            controller: this.controller
        });
        this._actionCells[name] = actionCell;
        row.append(actionCell.render().$el);
        return row;
    },

    showLoading: function() {
        this.$el.empty();
        this.$el.append(this.compiledTemplate({}));
        new WaitSpinner({ el: this.$(".ta-wait-spinner") }).render();
        this.$(".table-loading").show();
    },
    hideLoading: function() {
        this.$(".table-loading").hide();
    }
});
