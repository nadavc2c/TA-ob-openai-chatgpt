import _ from "lodash";
import Template from "contrib/text!./GroupDetail.html";
import { Control } from "swc-aob/index";
import ColorfulLabels from "./ColorfulLabels";
import EventTable from "./EventTable/Master";
import * as RegexUtil from "app/utils/RegexUtil";
import { getColorGroupIndex } from "app/utils/ColorsUtil";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { eventHandler } from "app/utils/CheckboxUtil";

function findNestedGroupInfo(groupInfo, i) {
    var ret = [];
    var bound = groupInfo[i].refSpan[1];
    for (var j = i + 1; j < groupInfo.length; ++j) {
        if (groupInfo[j].refSpan[1] <= bound) {
            ret.push(groupInfo[j]);
        }
    }
    return ret;
}

function generatePatternRecursive(startPos, endPos, regex, fields, groupInfo) {
    var ret = "";
    var cursor = startPos;
    for (var i = 0, ilen = groupInfo.length; i < ilen; ++i) {
        var currentIndex = groupInfo[i];
        var start = currentIndex.refSpan[0];
        var end = currentIndex.refSpan[1];
        ret += _.escape(regex.substring(cursor, start));
        var nextGroupInfo = groupInfo[i + 1];
        var tempText = _.escape(fields[currentIndex.groupIndex]);
        if (nextGroupInfo && nextGroupInfo.refSpan[1] <= end) {
            var nestedGroupInfo = findNestedGroupInfo(groupInfo, i);
            tempText +=
                " " +
                generatePatternRecursive(
                    start + 1,
                    end - 1,
                    regex,
                    fields,
                    nestedGroupInfo
                );
            i += nestedGroupInfo.length;
        }
        ret +=
            "<span class='ta-color-group-" +
            currentIndex.colorGroupIndex +
            "'  data-group-index='" +
            currentIndex.groupIndex +
            "'>${" +
            tempText +
            "}</span>";
        cursor = end;
    }
    if (cursor < endPos) {
        ret += _.escape(regex.substring(cursor, endPos));
    }
    return ret;
}

function getGroupInfo(regex) {
    var source = regex.replace("\\\\", "__").split(""); // Remove escaped back slash.
    var ret = [];
    var stack = [];
    var c = source.shift();
    var lc = null;
    var i = 0;
    while (c) {
        if (lc !== "\\") {
            if (c === "(") {
                stack.push(i);
            } else if (c === ")") {
                ret.push([stack.pop(), i + 1]);
            }
        }
        lc = c;
        c = source.shift();
        i++;
    }
    if (stack.length) {
        throw new Error("Quotes mismatch.");
    }
    var unMatchGroups = [];
    var index = regex.indexOf("(?:");
    while (index > -1) {
        unMatchGroups.push(index);
        index = regex.indexOf("(?:", index + 1);
    }
    ret = _.chain(ret)
        .filter(function(group) {
            return unMatchGroups.indexOf(group[0]) < 0;
        })
        .sort(function(a, b) {
            if (a[0] !== b[0]) {
                return a[0] - b[0];
            } else {
                return b[1] - a[1];
            }
        })
        .map(function(group, i) {
            return {
                refSpan: group,
                colorGroupIndex: getColorGroupIndex(i),
                groupIndex: i
            };
        })
        .value();
    return ret;
}

function generatePattern(pRegex) {
    var fields = RegexUtil.getFields(pRegex);
    var regex = RegexUtil.escapeRegex(pRegex);
    var groupInfo = getGroupInfo(regex);
    return generatePatternRecursive(0, regex.length, regex, fields, groupInfo);
}

export default Control.extend({
    template: Template,

    initialize: function(options) {
        Control.prototype.initialize.apply(this, arguments);
        this._model = options.model;
    },

    render: function() {
        this.$el.html(this.compiledTemplate(this.getTemplateParas()));
        var model = this._model;
        this._colorfulLabels = new ColorfulLabels({
            labels: RegexUtil.getFields(model.get("regex"))
        });
        this._colorfulLabels.on("highlight", this._highlightField.bind(this));
        this._colorfulLabels.on("rename", this._renameField.bind(this));
        this._colorfulLabels.on("delete", this._deleteField.bind(this));
        this.$(".fields-container .fields").append(
            this._colorfulLabels.render().$el
        );
        this._eventTable = new EventTable({
            eventContents: model.get("events"),
            regex: model.get("regex"),
            limit: 20
        });
        this.$(".events-container .event-table").append(
            this._eventTable.render().$el
        );
        this._model.set("matchedEvents", this._eventTable.getMatchedEvents());
        return this;
    },

    events: {
        "click label.checkbox a.btn": eventHandler,
        "change label.ckb-show-regex a.btn": "onRegexShowCkbChange",
        "click .btn-apply": "onApplyClicked"
    },
    onRegexShowCkbChange: function(e, data) {
        var display = data.checked ? "block" : "none";
        this.$(".regex-input-container").css("display", display);
    },
    onApplyClicked: function() {
        var $textarea = this.$(".regex-input");
        var regex = $textarea.val();
        this.removeErrorMsg();
        if (!RegexUtil.isValidRegex(regex)) {
            this.addErrorMsg(getFormattedMessage(4002));
            return;
        } else if (RegexUtil.hasTooMuchGroups(regex)) {
            this.addErrorMsg(getFormattedMessage(4010));
            return;
        } else if (RegexUtil.hasInvalidGroupName(regex)) {
            this.addErrorMsg(getFormattedMessage(4008));
            return;
        } else if (RegexUtil.hasDuplicatedGroupName(regex)) {
            this.addErrorMsg(getFormattedMessage(4003));
            return;
        }
        this._model.set("regex", regex);
        this._model.set("regexChanged", true);
        this._colorfulLabels.setLabels(RegexUtil.getFields(regex));
        this._eventTable.update({
            regex: regex
        });
        this._model.set("matchedEvents", this._eventTable.getMatchedEvents());
        this.$(".regex-extraction-pattern").html(generatePattern(regex));
    },
    addErrorMsg: function(msg) {
        this.$(".ta-regex-error-msg").text(msg);
        this.$(".regex-input").addClass("error");
    },
    removeErrorMsg: function() {
        this.$(".ta-regex-error-msg").text("");
        this.$(".regex-input").removeClass("error");
    },
    getTemplateParas: function() {
        var regex = this._model.get("regex");
        var paras = {
            expression: generatePattern(regex),
            regex: regex
        };
        return paras;
    },
    _highlightField: function(data) {
        this._eventTable.highlightField(data.groupIndex, data.isHighlighted);
    },
    _renameField: function(data) {
        var regex = RegexUtil.renameGroup(
            this._model.get("regex"),
            data.oldValue,
            data.value
        );
        this._model.set("regex", regex);
        this._model.set("regexChanged", true);
        this.$(".regex-extraction-pattern").html(generatePattern(regex));
        this.$(".regex-input").val(regex);
    },
    _deleteField: function(data) {
        var regex = RegexUtil.deleteGroup(this._model.get("regex"), data.value);
        this._model.set("regex", regex);
        this._model.set("regexChanged", true);
        this._colorfulLabels.setLabels(RegexUtil.getFields(regex));
        this._eventTable.update({
            regex: regex
        });
        this.$(".regex-extraction-pattern").html(generatePattern(regex));
        this.$(".regex-input").val(regex);
    }
});
