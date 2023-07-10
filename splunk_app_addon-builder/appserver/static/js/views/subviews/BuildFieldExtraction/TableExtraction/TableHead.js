import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import Template from "contrib/text!./TableHead.html";
import * as RegexUtil from "app/utils/RegexUtil";
import * as EditablePopoverUtil from "app/utils/EditablePopoverUtil";
import * as MessageUtil from "app/utils/MessageUtil";

/**
 * Render a help block with/without help link.
 * @param {String} options.description
 * @param {String} options.url
 */
export default BaseView.extend({
    tagName: "thead",
    template: Template,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this._data = this.options.data;
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        var that = this;
        var $el = this.$("tr");
        _(this._data).each(function(label, index) {
            var $label = $(
                "<th data-group-index='" +
                    index +
                    "'>" +
                    _.escape(label) +
                    "<i class='icon-action icon-pencil editable-field' " +
                    "data-name='" +
                    label +
                    "' " +
                    "data-value='" +
                    label +
                    "' " +
                    "data-type='input' " +
                    "data-title='Enter New Field Name:' ></i></th>"
            );
            $el.append($label);
            var $iconEdit = $label.find(".editable-field");
            EditablePopoverUtil.addPopover($iconEdit, {
                placement: "bottom",
                container: $("body"),
                scope: that,
                onConfirming: function($el, val, attrs) {
                    var selectItemIndex = $el.parent().data("groupIndex");
                    return this.validateFieldChange(
                        selectItemIndex,
                        val,
                        attrs
                    );
                },
                onConfirmed: function($el, val) {
                    var selectItemIndex = $el.parent().data("groupIndex");
                    this.triggerRename(selectItemIndex, val);
                }
            });
        });
        return this;
    },
    validateFieldChange: function(index, val, attrs) {
        if (!RegexUtil.isValidGroupName(val)) {
            attrs.errormessage = MessageUtil.getFormattedMessage(4007);
            return false;
        }
        attrs.errormessage = MessageUtil.getFormattedMessage(4004);
        var rest = _.without(this._data, this._data[index]);
        return _.every(rest, function(label) {
            return label !== val;
        });
    },
    triggerRename: function(index, val) {
        this._data[index] = val;

        this.render();
    }
});
