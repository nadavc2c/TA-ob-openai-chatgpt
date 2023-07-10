import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import "bootstrap";
import Template from "contrib/text!./Master.html";
import BaseExtractionView from "../BaseExtractionView";
import SetRegex from "app/models/build_field_extraction/set_regex";
import * as HelpLinkUtil from "app/utils/HelpLinkUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import * as EditablePopoverUtil from "app/utils/EditablePopoverUtil";
import * as DialogUtil from "app/utils/DialogUtil";
import * as RegexUtil from "app/utils/RegexUtil";
import * as CheckboxUtil from "app/utils/CheckboxUtil";
import GroupDetailView from "./GroupDetail";

function getMatchedEvents(collection) {
    var matched = [];
    collection.each(function(model) {
        if (!model.get("enable")) {
            return;
        }
        if (model.get("matchedEvents")) {
            matched = matched.concat(model.get("matchedEvents"));
            return;
        }
        var regex = model.get("regex");
        _(model.get("events")).each(function(event) {
            if (RegexUtil.matchRegex(event, RegexUtil.escapeRegex(regex))) {
                matched.push(event);
            }
        });
    });
    return matched.length;
}

export default BaseExtractionView.extend({
    template: Template,

    initialize: function(options) {
        BaseExtractionView.prototype.initialize.apply(this, arguments);
        this._data = new Backbone.Collection(options.data);
        this._sourcetype = options.sourcetype;
    },
    render: function() {
        this._total = -1;
        this.$el.html(
            this.compiledTemplate({
                sourcetype: this._sourcetype,
                numberOfGroups: this.getGroupNumber(),
                numberOfEvents: this.getTotal(),
                getDescription: this.getDescription.bind(this),
                helplink: HelpLinkUtil.getHelpLinkObj(
                    "step_fieldextraction_regex"
                )
            })
        );
        this.renderSaveCancel();
        this.renderCheckboxes();
        this.$("li[data-index]:first-child").click();
        return this;
    },
    renderCheckboxes: function() {
        this.$("label.checkbox a.btn").tooltip({
            trigger: "hover",
            container: "body"
        });
        var that = this;
        var shouldAllChecked = false;
        this.$("label.group-checkbox a.btn").each(function(idx) {
            if (that._data.at(idx).get("enable")) {
                CheckboxUtil.check($(this), true);
                shouldAllChecked = true;
            } else {
                CheckboxUtil.uncheck($(this), true);
            }
        });
        var allCkb = this.$("label.all-checkbox a.btn");
        if (shouldAllChecked) {
            CheckboxUtil.check(allCkb, true);
        } else {
            CheckboxUtil.uncheck(allCkb, true);
        }
    },
    events: {
        "click label.checkbox a.btn": CheckboxUtil.eventHandler,
        "change label.all-checkbox a.btn": "onAllCheckboxChange",
        "change label.group-checkbox a.btn": "onGroupCheckboxChange",
        "click li[data-index]": "onGroupClick"
    },
    onAllCheckboxChange: function(e, data) {
        var funcName = data.checked ? "check" : "uncheck";
        this.$("label.group-checkbox a.btn").each(function() {
            CheckboxUtil[funcName]($(this));
        });
    },
    onGroupCheckboxChange: function(e, data) {
        var idx = $(e.currentTarget).closest("li").data("index");
        var model = this._data.at(idx);
        model.set("enable", !!data.checked);
        model.set("enableChanged", true);
        if (
            data.checked &&
            !CheckboxUtil.isChecked(this.$("label.all-checkbox a.btn"))
        ) {
            CheckboxUtil.check(this.$("label.all-checkbox a.btn"), true);
        }
        var isAllUnchecked = true;
        this.$("label.group-checkbox a.btn").each(function() {
            if (CheckboxUtil.isChecked($(this))) {
                isAllUnchecked = false;
            }
            return isAllUnchecked;
        });
        if (
            isAllUnchecked &&
            CheckboxUtil.isChecked(this.$("label.all-checkbox a.btn"))
        ) {
            CheckboxUtil.uncheck(this.$("label.all-checkbox a.btn"), true);
        }
    },
    onGroupClick: function(e) {
        var $target = $(e.currentTarget);
        if ($("li.active") === $target) {
            return;
        }
        EditablePopoverUtil.hideAll();
        this.$("li.active").removeClass("active");
        $target.addClass("active");
        var idx = $target.data("index");
        var groupModel = this._data.at(idx);
        var groupDetailView = new GroupDetailView({
            model: groupModel
        });
        var detailViewContainer = this.$(
            ".regex-extraction-group-detail-container"
        );
        detailViewContainer.css("display", "block");
        if ($.trim(detailViewContainer.html()) !== "") {
            detailViewContainer.empty();
        }
        this.clearError();
        try {
            detailViewContainer.append(groupDetailView.render().$el);
        } catch (exp) {
            detailViewContainer.empty();
            this.showFormattedError(4015);
        }
    },
    getGroupNumber: function() {
        return this._data.length;
    },
    getDescription: function(index) {
        var total = this.getTotal();
        var length, ratio;
        if (total <= 0) {
            length = 0;
            ratio = 0;
        } else {
            length = this._data.at(index).get("events").length;
            ratio = Math.round(length / total * 1000) / 10;
        }
        return length + " " + _.t("events") + ", " + ratio + "%";
    },
    getTotal: function() {
        if (this._total > 0) {
            return this._total;
        }
        var total = 0;
        this._data.each(function(group) {
            total += group.get("events").length;
        });
        if (total > 0) {
            this._total = total;
        }
        return this._total;
    },
    onSaveClick: function() {
        var changedGroupNum = 0;
        var disabledGroupNum = 0;
        var data = {
            regexes: this._data.map(function(model) {
                if (model.get("regexChanged") || model.get("enableChanged")) {
                    changedGroupNum++;
                }
                var enable = model.get("enable");
                if (!enable) {
                    disabledGroupNum++;
                }
                return {
                    data: model.get("regex"),
                    enable: enable
                };
            })
        };
        var total = this.getTotal();
        //disable buttons first because getMatchedEvents could cost some time.
        this.clearError();
        this.disableFunctionalButtons();
        var matchedEventNum = getMatchedEvents(this._data, data);

        var warningContent = MessageUtil.getFormattedMessage(7, this._sourcetype);

        var summaryContent = MessageUtil.getFormattedMessage(12, {
            groupNum: this._data.length,
            changedGroupNum: changedGroupNum,
            disabledGroupNum: disabledGroupNum,
            eventNum: total,
            eventCoverage: Math.floor(matchedEventNum / total * 100)
        });

        var content =
            warningContent +
            "<br><br><b>Blow is the summary of this parsing:</b><br>" +
            summaryContent;

        DialogUtil.showDialog({
            el: $("#parse-confirm-modal"),
            title: "Summary",
            content: content,
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Continue"),
            yesCallback: () => {
                this.clearError();
                var set = new SetRegex();
                var xhr = set.fetch({
                    type: "POST",
                    data: {
                        app_name: this.controller.getAppName(),
                        sourcetype: this._sourcetype,
                        key_values: JSON.stringify(data)
                    }
                });
                if (xhr) {
                    xhr
                        .always(() => {
                            this.enableFunctionalButtons();
                        })
                        .done(response => {
                            if (response.error) {
                                this.showError(_.escape(response.error));
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
                return true;
            },
            noCallback: () => {
                this.enableFunctionalButtons();
                return true;
            }
        });
    }
});
