import _ from "lodash";
import BaseView from "app/components/BaseView";
import * as JSONEventUtil from "app/utils/JSONEventUtil";
import JSONTableHead from "./JSONTableHead";
import JSONTableBody from "./JSONTableBody";

export default BaseView.extend({
    tagName: "table",
    className: "table",
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, "change", this.render);
    },
    render: function() {
        var fields = _.filter(this.model.get("fields"), function(field) {
            return !JSONEventUtil.isReservedKey(field.name);
        });
        if (this.children.head) {
            this.children.head.remove();
        }
        this.children.head = new JSONTableHead({
            fields: fields
        });
        this.$el.append(this.children.head.render().$el);

        if (this.children.body) {
            this.children.body.remove();
        }
        this.children.body = new JSONTableBody({
            fields: fields,
            results: this.model.get("results"),
            model: this.model
        });
        this.$el.append(this.children.body.render().$el);
        return this;
    }
});
