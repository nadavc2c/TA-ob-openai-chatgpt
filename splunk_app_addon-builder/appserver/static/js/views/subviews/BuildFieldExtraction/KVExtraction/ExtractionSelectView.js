import _ from "lodash";
import Template from "contrib/text!./ExtractionSelectView.html";
import SingleInputControl from "app/components/controls/SingleInputControl";
import RadioButtonGroupControl
    from "app/components/controls/RadioButtonGroupControl";
import RadioButtonGroupWithInput
    from "app/components/controls/RadioButtonGroupWithInput";
import GetKVTemplates from "app/models/build_field_extraction/get_kv_templates";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";

function getRegexTemplateName(idx) {
    return _.t("Regex Template") + (+idx + 1);
}

function findRegexTemplateIndex(templates, regex) {
    for (var i = 0; i < templates.length; ++i) {
        if (templates[i].regex === regex) {
            return i;
        }
    }
    return -1;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|\-[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export default BaseSubViewComponent.extend({
    className: "extraction-select",
    template: Template,
    initialize: function() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this._data = this.options.data;
        this._keepRegex = false;
        this.model.set(
            "pair-delimiter",
            this._data.delim_pair == null ? "," : this._data.delim_pair
        );
        this.model.set(
            "kv-delimiter",
            this._data.delim_kv == null ? "=" : this._data.delim_kv
        );
        this.listenTo(this.model, "change:method", this.onMethodChange);
        this.listenTo(this.model, "change:pair-delimiter", this.onDelimChange);
        this.listenTo(this.model, "change:kv-delimiter", this.onDelimChange);
        this.listenTo(
            this.model,
            "change:regex-delimiter",
            this.onRegexDelimChange
        );
        this._initialized = false;
    },
    events: {
        "click .btn-edit": "onEditClick",
        "click .btn-apply": "onApplyClick"
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        this.$(".kv-delimiter .delimiter").text(this.model.get("kv-delimiter"));
        this.children.pairDelimBtnGroup = new RadioButtonGroupWithInput({
            model: this.model,
            modelAttribute: "pair-delimiter",
            items: [
                {
                    value: ",",
                    label: "Comma"
                },
                {
                    value: " ",
                    label: "Space"
                },
                {
                    value: "\\t",
                    label: "Tab"
                },
                {
                    value: "|",
                    label: "Pipe"
                }
            ]
        });
        this.children.kvDelimBtnGroup = new RadioButtonGroupWithInput({
            model: this.model,
            modelAttribute: "kv-delimiter",
            items: [
                {
                    value: "=",
                    label: "Equal"
                },
                {
                    value: ":",
                    label: "Colon"
                },
                {
                    value: ";",
                    label: "Semicolon"
                }
            ]
        });
        this.children.selectMethod = new SingleInputControl({
            className: "selector-control",
            model: this.model,
            modelAttribute: "method",
            placeholder: _.t("Select a method"),
            disableSearch: true,
            autoCompleteFields: [
                {
                    value: "auto",
                    label: _.t("Auto")
                },
                {
                    value: "delim",
                    label: _.t("Delimiters")
                },
                {
                    value: "regex",
                    label: _.t("Regex")
                }
            ]
        });
        this.$(".pair-delimiter-btn-group").append(
            this.children.pairDelimBtnGroup.render().$el
        );
        this.$(".kv-delimiter-btn-group").append(
            this.children.kvDelimBtnGroup.render().$el
        );
        this.$(".extraction-select-container").append(
            this.children.selectMethod.render().$el
        );
        this.hideAllOption();
        this.renderRegexDelimBtnGroup();
        return this;
    },
    renderRegexDelimBtnGroup: function() {
        var templates = new GetKVTemplates();
        var xhr = templates.fetch({
            type: "POST",
            data: {
                app_name: this.controller.getAppName()
            }
        });
        var that = this;
        this.children.selectMethod.disable();
        xhr.done(function(response) {
            that._templates = response.data;
            var items = _.map(response.data, function(item, index) {
                return {
                    value: index,
                    label: getRegexTemplateName(index)
                };
            });
            items.push({
                value: "custom",
                label: _.t("Customised Regular Expression")
            });
            that.children.regexDelimBtnGroup = new RadioButtonGroupControl({
                model: that.model,
                modelAttribute: "regex-delimiter",
                items: items
            });
            that
                .$(".regex-delimiter-btn-group")
                .append(that.children.regexDelimBtnGroup.render().$el);
            that.children.selectMethod.enable();
            that.initializeMethodSelect();
        });
    },
    initializeMethodSelect: function() {
        if (
            this._data.hasOwnProperty("delim_pair") &&
            this._data.hasOwnProperty("delim_kv") &&
            this._data.delim_pair &&
            this._data.delim_kv
        ) {
            this.model.set("method", "delim");
            this.model.set("pair-delimiter", this._data.delim_pair);
            this.model.set("kv-delimiter", this._data.delim_kv);
        } else if (this._data.hasOwnProperty("regex") && this._data.regex) {
            this.model.set("method", "regex");
            var regex = this._data.regex;
            var index = findRegexTemplateIndex(this._templates, regex);
            if (index === -1) {
                this.model.set("regex-delimiter", "custom");
                this.$(".regex-container textarea").val(regex);
            } else {
                this.model.set("regex-delimiter", index);
            }
        } else {
            this.model.set("method", "auto");
        }
        if (this.model.get("regex-delimiter") == null) {
            if (this._templates.length) {
                this.model.set("regex-delimiter", 0);
            } else {
                this.model.set("regex-delimiter", "custom");
            }
        }
        this._initialized = true;
    },
    onMethodChange: function() {
        this.hideAllOption();
        var method = this.model.get("method");
        if (method === "delim") {
            this.showDelimOption();
        } else if (method === "regex") {
            this.showRegexOption();
        } else if (method === "auto") {
            if (!this._initialized) {
                return;
            }
            this.trigger("delimiterChange", null, null);
        }
    },
    onDelimChange: function() {
        var delim = this.model.get("kv-delimiter");
        if (delim.length > 1) {
            delim = "[" + escapeRegExp(delim) + "]" + _.t("(regex)");
        }
        this.$(".kv-delimiter .delimiter").text(delim);
        if (!this._initialized) {
            return;
        }
        this.trigger(
            "delimiterChange",
            this.model.get("pair-delimiter"),
            this.model.get("kv-delimiter")
        );
    },
    onRegexDelimChange: function() {
        this.$(".sub-optional-container").hide();
        var delim = this.model.get("regex-delimiter");
        if (delim === "custom") {
            this.showRegexCustomOption();
        } else {
            this.showRegexTemplateOption(delim);
        }
    },
    onEditClick: function() {
        this._keepRegex = true;
        this.model.set("regex-delimiter", "custom");
    },
    onApplyClick: function() {
        if (!this._initialized) {
            return;
        }
        var val = this.$(".regex-container textarea").val();
        if (val == null || val === "") {
            return;
        }
        this.trigger("regexChange", val);
    },
    showRegexOption: function() {
        this.$(".regex-container").show();
        this.onApplyClick();
    },
    showDelimOption: function() {
        this.$(".delimiter-container").show();
        this.onDelimChange();
    },
    showRegexTemplateOption: function(index) {
        var regex = this._templates[index].regex;
        this.$(".regex-template").text(regex);
        this.$(".regex-container textarea").val(regex);
        this.$(".btn-apply").click();
        this.$(".regex-template-container").show();
    },
    showRegexCustomOption: function() {
        this.$(".regex-custom-container").show();
        if (!this._keepRegex) {
            this.$(".regex-container textarea").val("");
        } else {
            this._keepRegex = false;
        }
        this.$(".regex-container textarea").focus();
    },
    hideAllOption: function() {
        this.$(".optional-container").hide();
    }
});
