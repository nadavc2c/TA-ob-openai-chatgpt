import $ from "jquery";
import _ from "lodash";
import DeleteModularAlert from "app/models/modular_alert/delete_modular_alert";
import ModularAlertSummaryCollection
    from "app/collections/step_view/modular_alert/modular_alert_summary";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import * as AppInfo from "app/utils/AppInfo";
import * as DialogUtil from "app/utils/DialogUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import RowTemplate from "contrib/text!./ModularAlertTableRow.html";
import TableTemplate from "contrib/text!./ModularAlertTable.html";
import Collector from "app/profiles/partyjsCollector";
import WaitSpinner from "app/components/WaitSpinner";
import { splunkUtils } from "swc-aob/index";

const ActionCell = BaseSubViewComponent.extend({
    tagName: "td",
    className: "ta-input-action-cell",
    initialize: function(options) {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.short_name = options.short_name;
        this.parentView = options.parentView;
        this.tableView = options.tableView;
        this.collection = options.collection;
        this.showCode = options.showCode;
    },
    render: function() {
        this.$el.append('<a class="edit">' + _.t("Edit") + "</a>");
        this.$el.append('<a class="delete">' + _.t("Delete") + "</a>");
        if (this.showCode) {
            this.$el.append('<a class="code">' + _.t("Code") + "</a>");
        }
        return this;
    },
    events: {
        "click a.edit": "onEditClick",
        "click a.delete": "onDeleteClick",
        "click a.code": "onCodeClick"
    },
    getModel: function() {
        var modular_alert = this.collection.where({
            short_name: this.short_name
        });
        if (modular_alert.length === 0) {
            this.wizard.showError(MessageUtil.getFormattedMessage(3115));
            return null;
        }
        return modular_alert[0];
    },

    onEditClick: function() {
        this.controller.navigate({
            view: "modular-alert",
            action: "edit",
            params: {
                model: this.getModel(),
                collection: this.collection
            }
        });
    },
    onCodeClick: function() {
        this.controller.navigate({
            view: "modular-alert",
            action: "edit",
            params: {
                model: this.getModel(),
                collection: this.collection,
                step: "alertDefinition"
            }
        });
    },
    onDeleteClick: function(e) {
        e.preventDefault();
        var that = this;
        DialogUtil.showDialog({
            el: $("#delete-confirm-modal"),
            title: "Deleting a modular alert",
            content: MessageUtil.getFormattedMessage(27, this.name),
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Delete"),
            yesCallback: function(dialog) {
                //window.localStorage.removeItem(that.getModel().attributes.short_name);
                var deleteModularAlert = new DeleteModularAlert(
                    that.getModel().toJSON()
                );
                deleteModularAlert.save(
                    {},
                    {
                        success: function(model, response) {
                            if (response.status === "success") {
                                let collectedData = _.omit(
                                    that.getModel().toJSON(),
                                    [
                                        "code",
                                        "smallIcon",
                                        "largeIcon",
                                        "uuid",
                                        "parameters"
                                    ]
                                );
                                Collector.collect("track_deletion", {
                                    type: "modular-alert",
                                    data: collectedData
                                });
                                dialog.hideModal();
                                that.tableView.render();
                            } else if (response.err_code) {
                                this.parentView.showFormattedError(response);
                            }
                        },
                        error: function() {
                            console.log("error in deleting the modular alert.");
                        },
                        'headers': {
                            'X-Splunk-Form-Key': splunkUtils.getFormKey()
                        }
                    }
                );
            }
        });
    }
});
export default BaseSubViewComponent.extend({
    initialize: function(options) {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.options = options || {};
        this.parentView = options.parentView;
        this.compiledRowTemplate = _.template(RowTemplate);
        this.compiledTableTemplate = _.template(TableTemplate);
        this.collection = new ModularAlertSummaryCollection();
        this.defaultIcon =
            "/" +
            AppInfo.getLocale() +
            "/static/app/" +
            AppInfo.getCurrentApp() +
            "/img/alerticon.png";
        this.listenTo(this.collection, "sync", this.renderTable);
    },

    render: function() {
        this.$el.empty();
        this.$el.append(this.compiledTableTemplate({}));
        new WaitSpinner({
            el: this.$(".ta-wait-spinner")
        }).render();
        this.collection.fetch(); // update the models
        // this.renderTable();
        return this;
    },

    renderTable: function() {
        this.hideLoading();
        this.$("tbody tr").remove();
        this.collection.each(summary => {
            this.$("tbody").append(this.renderRow(summary));
        });
        // render 10 rows by default
        if (this.collection.length < 10) {
            var count = 10 - this.collection.length;
            for (var i = 0; i < count; i++) {
                this.$("tbody").append(this.renderEmptyRow());
            }
        }
        return this;
    },

    renderRow: function(model) {
        var row = $(
            this.compiledRowTemplate({
                alert_logo: model.get("largeIcon")
                    ? "data:image/png;base64," + model.get("largeIcon")
                    : this.defaultIcon,
                alert_name: model.get("short_name"),
                alert_type: model.get("active_response") ? "ARF" : "Normal"
            })
        );
        var actionCell = new ActionCell({
            short_name: model.get("short_name"),
            showCode: true,
            parentView: this.parentView,
            tableView: this,
            collection: this.collection,
            controller: this.controller
        });
        row.append(actionCell.render().$el);
        return row;
    },

    renderEmptyRow: function() {
        return "<tr><td></td><td></td><td></td></tr>";
    },

    showLoading: function() {
        this.$(".table-loading").show();
    },
    hideLoading: function() {
        this.$(".table-loading").hide();
    }
});
