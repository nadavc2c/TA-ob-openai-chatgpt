import _ from "lodash";
import Backbone from "backbone";

import SingleInputControl from "app/components/controls/SingleInputControl";
import { SyntheticCheckboxControl }
    from "swc-aob/index";
import { TextControl } from "swc-aob/index";

var TableHeader = Backbone.View.extend({
    tagName: "thead",

    Template: [
        "<tr>",
        "<% columns.each(function(element, index) { %>",
        '<th name="<%= element.get(\'name\') %>" class="<%= thClass %> editable-head-<%= index %>">',
        "<%- element.get('label') %>",
        "</th>",
        "<% }); %> ",
        '<th class="<%= thClass %> action-head"></th>',
        "</tr>"
    ].join(""),

    initialize: function() {
        Backbone.View.prototype.initialize.apply(this, arguments);
        this.options = arguments[0] || {};
        this.compiledTemplate = _.template(this.Template);
    },

    render: function() {
        this.$el.empty();
        this.$el.append(
            this.compiledTemplate({
                columns: this.options.columnMetas,
                thClass: this.options.thClass || ""
            })
        );
        return this;
    }
});

var TableRow = Backbone.View.extend({
    tagName: "tr",

    AddNewTemplate: [
        "<% columns.each(function(element, index) { %>",
        '<td name="<%= element.get(\'name\') %>" class="<%= td_class %> editable-column-<%= index %>">',
        "</td>",
        "<% }); %>",
        '<td class="<%= td_class %> action-column">',
        '<span name="add-new-row-btn" class="icon-plus tbTable-icon"></span>',
        "</td>"
    ].join(""),

    EditingTemplate: [
        "<% columns.each(function(element, index) { %>",
        '<td name="<%= element.get(\'name\') %>" class="<%= td_class %> editable-column-<%= index %>">',
        "</td>",
        "<% }); %>",
        '<td class="tbTable-editable-data <%= td_class %> action-column">',
        '<span name="remove-row-btn" class="icon-minus tbTable-icon"></span>',
        "</td>"
    ].join(""),

    initialize: function(options) {
        Backbone.View.prototype.initialize(this, arguments);
        this.options = options || {};
        if (this.options.columnMetas == null) {
            this.options.columnMetas = new Backbone.Collection();
            this.options.columnMetas.comparator = "name";
            // if columns is not defined, use the keys in the models.
            var data = this.model.toJSON();
            var columnName;
            for (columnName in data) {
                if (data.hasOwnProperty(columnName)) {
                    this.options.columnMetas.add(
                        new Backbone.Model({
                            name: columnName,
                            label: columnName,
                            control: "text"
                        })
                    );
                }
            }
        }
        this.options.tdClass = this.options.tdClass || "";
        this.tableView = this.options.table;
        this.isAddNewRow = this.options.addNew;
        if (this.isAddNewRow == null) {
            this.isAddNewRow = false;
        }
        this.compiledAddNewTemplate = _.template(this.AddNewTemplate);
        this.compiledEditingTemplate = _.template(this.EditingTemplate);
    },

    render: function() {
        this.$el.empty();
        if (this.isAddNewRow) {
            this.$el.html(
                this.compiledAddNewTemplate({
                    columns: this.options.columnMetas,
                    td_class: this.options.tdClass
                })
            );
            this.$el.addClass("add-new");
            this.$('span[name="add-new-row-btn"]').on(
                "click",
                _.bind(this.clickAdd, this)
            );
        } else {
            // render the editing row
            this.$el.html(
                this.compiledEditingTemplate({
                    columns: this.options.columnMetas,
                    td_class: this.options.tdClass
                })
            );
            // render each control
            this.columnControlView = {};
            var that = this;
            this.options.columnMetas.each(function(meta) {
                var colName = meta.get("name");
                var control = meta.get("control");
                var defaultValue = meta.get("defaultValue");
                var controlInstance;
                var $td = that.$('td[name="' + colName + '"]');
                if (that.model.get(colName) === undefined) {
                    that.model.set(colName, "");
                }
                if (control === "text") {
                    controlInstance = new TextControl({
                        model: that.model,
                        modelAttribute: colName,
                        el: $td
                    });
                } else if (control === "password") {
                    controlInstance = new TextControl({
                        model: that.model,
                        modelAttribute: colName,
                        el: $td,
                        password: true
                    });
                } else if (control === "dropdown") {
                    controlInstance = new SingleInputControl({
                        model: that.model,
                        modelAttribute: colName,
                        disableSearch: true,
                        autoCompleteFields: meta.get("items"),
                        placeholder: "----",
                        el: $td
                    });
                } else if (control === "checkbox") {
                    controlInstance = new SyntheticCheckboxControl({
                        model: that.model,
                        modelAttribute: colName,
                        el: $td
                    });
                }
                if (controlInstance) {
                    that.columnControlView[colName] = controlInstance;
                    if (
                        controlInstance.model.toJSON()[colName] === undefined &&
                        defaultValue != null
                    ) {
                        controlInstance.setValue(defaultValue);
                    }
                    controlInstance.render();
                }
            });

            this.$('span[name="remove-row-btn"]').on(
                "click",
                _.bind(this.clickRemove, this)
            );
        }
        this.$el.attr("row-id", this.model.cid);
        return this;
    },

    clickRemove: function() {
        // pass the row model to the table view
        this.tableView.removeRow(this.model);
        this.$el.remove();
    },

    clickAdd: function() {
        // delegate the events to table view
        this.tableView.addNewRow();
    }
});

export default Backbone.View.extend({
    TableTemplate: "<table class='table editable-table'></table>",
    /**
      Use collection to define a table. Each model in the collection is a
      row.
      options:
        @param collection: a collection which contains all the data in the table.
        @param columnNames: a collection which contains the column meta.
                  - The 'name' attribute define the key name of this column
                    data
                  - The 'label' attribute defines the displayed label text in
                    the table header
                  - The 'control' attribute defines the UI control for this
                    collumn, it can be 'checkbox'/'dropdown'/'text'
                  - The 'items' attribute is an arrary, which contains the
                    dropdown control metas. like [{value:'column-value',
                    label:'displayed-text'}, ...]
        @param thClass: table header css class
        @param tdClass: table data css class
        @param prependRow: boolean value. if true, the table row is inserted
                    in the beginning. default: true
        @param rowDefaultValues: object which contains the default values
                          for each row
    */
    initialize: function(options) {
        Backbone.View.prototype.initialize.apply(this, arguments);
        this.options = options || {};
        // preprocess the column names option
        this.options.columnNames.each(function(column) {
            // set default values
            if (column.get("control") === undefined) {
                column.set("control", "text");
            }
            if (
                column.get("control") === "dropdown" &&
                column.get("items") === undefined
            ) {
                console.error(
                    "control for column ",
                    column.get("label"),
                    " is dropdown. But no items attribute found."
                );
            }
        });

        this.header = new TableHeader({
            columnMetas: this.options.columnNames,
            thClass: this.options.thClass
        });
        this.rows = new Backbone.Collection();
        this._resetRowsWithCollectionModels();
        this.addNewRowView = new TableRow({
            model: new Backbone.Model(),
            tdClass: this.options.tdClass,
            columnMetas: this.options.columnNames,
            addNew: true,
            table: this
        });
        this.listenTo(this.collection, "add", this._onRowModelAdded);
        this.listenTo(this.collection, "remove", this._onRowModelRemoved);
        this.listenTo(this.rows, "add", this.renderRow);
        this.listenTo(
            this.collection,
            "reset",
            this._resetRowsWithCollectionModels
        );
        this.listenTo(this.rows, "reset", this._resetTableRows);

        this.options.prependRow = this.options.prependRow === undefined
            ? false
            : this.options.prependRow;
    },

    _resetRowsWithCollectionModels: function() {
        this.rows.reset();
        this.collection.each(function(model) {
            this.rows.push({
                view: new TableRow({
                    model: model,
                    tdClass: this.options.tdClass,
                    columnMetas: this.options.columnNames,
                    table: this
                })
            });
        }, this);
    },

    _resetTableRows: function() {
        this.$("tbody tr:not(.add-new)").remove();
    },

    renderRow: function(rowView) {
        var childRow = rowView.get("view").render().$el;
        if (this.options.prependRow) {
            this.$("tbody").prepend(childRow);
        } else {
            var l = this.$("tbody").children().length;
            if (l > 1) {
                this.$("tbody > tr:nth-child(" + (l - 1) + ")").after(childRow);
            } else {
                // if plus button line is the only line, just prepend to the table head
                this.$("tbody").prepend(childRow);
            }
        }
    },

    /*
      exposed api to add a row to table
    */
    addRow: function(rowModel, prepend) {
        prepend = prepend || this.options.prependRow;
        prepend = prepend === true;
        if (prepend) {
            this.collection.add(rowModel, {
                at: 0
            });
        } else {
            this.collection.push(rowModel);
        }
    },

    _onRowModelAdded: function(rowModel) {
        var rowView = new TableRow({
            model: rowModel,
            tdClass: this.options.tdClass,
            columnMetas: this.options.columnNames,
            table: this
        });
        if (this.options.prependRow) {
            this.rows.add(
                {
                    view: rowView
                },
                {
                    at: 0
                }
            );
        } else {
            this.rows.push({
                view: rowView
            });
        }
    },

    _onRowModelRemoved: function(rowModel) {
        this.$("tr[row-id=" + rowModel.cid + "]").remove();
        var toRemoveRow = null;
        this.rows.each(function(row) {
            if (row.get("view").model.cid === rowModel.cid) {
                toRemoveRow = row;
            }
        });
        this.rows.remove(toRemoveRow);
    },

    render: function() {
        this.$el.empty();
        this.$el.html(this.TableTemplate);
        this.$("table").append(this.header.render().$el);
        this.$("table").append("<tbody></tbody>");
        this.rows.each(function(row) {
            this.$("tbody").append(row.get("view").render().$el);
        }, this);
        this.$("tbody").append(this.addNewRowView.render().$el);
        return this;
    },

    removeRow: function(rowModel) {
        this.collection.remove(rowModel);
    },

    addNewRow: function() {
        var rowModel = new Backbone.Model();
        this.options.columnNames.each(function(element) {
            if (element.get("control") === "checkbox") {
                rowModel.set(element.get("name"), 0);
            } else {
                rowModel.set(element.get("name"), "");
            }
        });
        if (this.options.rowDefaultValues) {
            rowModel.set(this.options.rowDefaultValues);
        }

        this.addRow(rowModel);
    }
});
