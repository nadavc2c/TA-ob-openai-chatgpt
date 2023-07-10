import $ from "jquery";
import _ from "lodash";
import { Control } from "swc-aob/index";
import { getColorGroupIndex } from "app/utils/ColorsUtil";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { isValidGroupName } from "app/utils/RegexUtil";
import { showDialog } from "app/utils/DialogUtil";
import * as EditablePopoverUtil from "app/utils/EditablePopoverUtil";

export default Control.extend({
    initialize: function(options) {
        Control.prototype.initialize.apply(this, arguments);
        this._labels = options.labels;
        this._labelsInactive = {};
    },
    setLabels: function(labels) {
        this._labels = labels;
        this._labelsInactive = {};
        return this.render();
    },
    render: function() {
        var that = this;
        var $el = this.$el;
        $el.empty();
        _(this._labels).each(function(label, index) {
            var groupIndex = getColorGroupIndex(index);
            var $label = $(
                "<span class='ta-colorful-label ta-group-item ta-color-group-" +
                    groupIndex +
                    "' data-group-index='" +
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
                    "data-title='Enter New Field Name:' ></i><i class='icon-action icon-trash'></i></span>"
            );
            $el.append($label);
            if (that._labelsInactive[label]) {
                $label.addClass("inactive");
            }
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
        if (!isValidGroupName(val)) {
            attrs.errormessage = getFormattedMessage(4007);
            return false;
        }
        attrs.errormessage = getFormattedMessage(4004);
        var rest = _.without(this._labels, this._labels[index]);
        return _.every(rest, function(label) {
            return label !== val;
        });
    },
    triggerRename: function(index, val) {
        var oldValue = this._labels[index];
        this._labels[index] = val;
        if (this._labelsInactive.hasOwnProperty(oldValue)) {
            var tmp = this._labelsInactive[oldValue];
            delete this._labelsInactive[oldValue];
            this._labelsInactive[val] = tmp;
        }
        this.render();
        this.trigger("rename", {
            groupIndex: index,
            oldValue: oldValue,
            value: val
        });
    },
    events: {
        "click .ta-colorful-label": "onLabelClick",
        "click .icon-pencil": "onEditClick",
        "click .icon-trash": "onDeleteClick"
        // "mouseenter .icon-pencil": function(event) {
        //     $(event.currentTarget).tooltip("show");
        // },
        // "mouseleave .icon-pencil": function(event) {
        //     $(event.currentTarget).tooltip("hide");
        // }
    },
    onLabelClick: function(event) {
        var $target = $(event.currentTarget);
        $target.toggleClass("inactive");
        var inactive = $target.hasClass("inactive");
        var groupIndex = $target.data("groupIndex");
        this._labelsInactive[this._labels[groupIndex]] = inactive;
        this.trigger("highlight", {
            groupIndex: groupIndex,
            isHighlighted: !inactive
        });
    },
    onDeleteClick: function(event) {
        event.stopPropagation();
        var $target = $(event.currentTarget).parent();
        var index = $target.data("groupIndex");
        var value = this._labels[index];
        var that = this;
        showDialog({
            el: $("#delete-confirm-modal"),
            title: _.t("Deleting a Field"),
            content: getFormattedMessage(11, value),
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Delete"),
            yesCallback: function() {
                EditablePopoverUtil.hideAll();
                that.trigger("delete", {
                    groupIndex: index,
                    value: value
                });
                return true;
            }
        });
    }
});
