import _ from "lodash";
import Dialog from "app/components/modal/Dialog";

export default Dialog.extend({
    tableTemplate: _.template(
        `<table class="table table-chrome table-striped wrapped-results  table-drilldown table-drilldown-row">
        <thead class="shared-resultstable-resultstableheader">
        <tr><th><%- _.t('Check Category') %></th>
        <th><%- _.t('Check Description') %></th>
        <th><%- _.t('Solution') %></th></tr>
        </thead>
        <tbody>
    <% for(var i=0; i<errors.length; i++) { %>
    <tr class="shared-resultstable-resultstablerow even">
        <td class="string">
            <%- _.t(errors[i].sub_category) %>
        </td>
        <td class="string">
            <%- _.t(errors[i].description) %>
        </td>
        <td class="string">
            <%- _.t(errors[i].solution) %>
        </td>
    </rt>
    <% } %>
    </tbody></table>`
    ),

    initialize() {
        Dialog.prototype.initialize.apply(this, arguments);
        this.options.title = "App Inspect Internal Errors";
        this.options.btnYesText = "Close";
        this.options.hideCloseBtn = true;
        this.parseOptions(this.options);
        this.errors = this.options.errors;
    },

    render() {
        Dialog.prototype.render.apply(this, arguments);
        this.renderTable();
        this.$(".ta-btn-no").hide();
        this.$(".higherWider").addClass("ta-certification-dialog");
        return this;
    },

    renderTable() {
        this.$(".modal-body").append(
            this.tableTemplate({
                errors: this.errors
            })
        );
    }
});
