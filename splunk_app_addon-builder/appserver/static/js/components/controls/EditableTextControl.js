import _ from "lodash";
import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import { TextControl } from "swc-aob/index";
import Template
    from "contrib/text!app/components/controls/EditableTextControl.html";
import { KeyboardUtil } from "swc-aob/index";

export default BaseView.extend({
    className: "control ta-editable-text-control",
    template: Template,
    initialize(...args) {
        BaseView.prototype.initialize.apply(this, args);
        this.textControlModel = new Backbone.Model();
        this.modelAttribute = this.options.modelAttribute || "val";
        this._editLinkText = this.options.editLinkText || _.t("Edit");
        this._inputPrefix = this.options.inputPrefix || "";
        this._placeholder = this.options.placeholder || "";
    },
    events: {
        "click a.ta-display-edit-link": "onEditClick",
        "click .ta-editable-input-prefix": "onPrefixClick",
        "click .icon-check": "onConfirmClick",
        "click .icon-x": "onCancelClick"
    },
    onPrefixClick(event) {
        event.preventDefault();
        this.$(".ta-editable-text-control-container input").focus();
    },
    onEditClick(event) {
        event.preventDefault();
        this.showEdit();
        this.trigger("enterEditing");
        if (this.children.textControl) {
            this.children.textControl.remove();
        }
        this.textControlModel.clear();
        this.textControlModel.set(
            this.modelAttribute,
            this.model.get(this.modelAttribute)
        );
        this.children.textControl = new TextControl({
            model: this.textControlModel,
            modelAttribute: this.modelAttribute,
            placeholder: this._placeholder,
            updateOnKeyUp: true
        });
        this.$(".ta-editable-text-control-container").html(
            this.children.textControl.render().$el
        );

        const onInputKeydown = this.onInputKeydown.bind(this);
        this.children.textControl.$input
            .off("keydown", onInputKeydown)
            .on("keydown", onInputKeydown);
        this.updateTextControlPadding();
        this.$(".ta-editable-text-control-container input").focus().select();
    },
    updateTextControlPadding() {
        let prefixWidth = this.$(".ta-editable-input-prefix").width();
        this.$(".ta-editable-text-control-container input")
            .css("padding-left", `${prefixWidth + 6}px`)
            .css("width", `calc(100% - ${prefixWidth + 14}px)`);
        return this;
    },
    onCancelClick(event) {
        event.preventDefault();
        let result = {};
        this.trigger("beforeCancel", result);
        if (result.hasOwnProperty("stop") && result.stop === true) {
            this.$(".ta-editable-text-control-container input").focus();
            return;
        }
        this.trigger("afterCancel");
        this.showDisplay();
        this.trigger("exitEditing", {});
    },
    onConfirmClick(event) {
        event.preventDefault();
        let value = this.textControlModel.get(this.modelAttribute);
        let result = {
            value
        };
        this.trigger("beforeConfirm", result);
        if (result.hasOwnProperty("stop") && result.stop === true) {
            this.$(".ta-editable-text-control-container input").focus();
            return;
        }
        this.trigger("afterConfirm");
        this.showDisplay();
        this.trigger("exitEditing", { value });
        this.model.set(this.modelAttribute, value);
    },
    render() {
        this.$el.html(
            this.compiledTemplate({
                editLinkText: this._editLinkText,
                inputPrefix: this._inputPrefix
            })
        );
        this.onAttrChange();
        this.showDisplay();
        this.listenTo(
            this.model,
            "change:" + this.modelAttribute,
            this.onAttrChange
        );
        return this;
    },
    onInputKeydown: function(event) {
        if (event.keyCode === KeyboardUtil.KEYS["ENTER"]) {
            event.preventDefault();
            event.stopPropagation();
            this.onConfirmClick(event);
        } else if (event.keyCode === KeyboardUtil.KEYS["ESCAPE"]) {
            event.preventDefault();
            event.stopPropagation();
            this.onCancelClick(event);
        }
    },
    onAttrChange() {
        this.$(".ta-display-input-value").text(
            this.model.get(this.modelAttribute)
        );
    },
    updatePrefix(prefix) {
        this.$(".ta-input-prefix").text(prefix);
        if (this.isEditing()) {
            this.updateTextControlPadding();
        }
        return this;
    },
    showDisplay() {
        this.$(".ta-display-text").show();
        this.$(".ta-editable-container").hide();
        return this;
    },
    showEdit() {
        this.$(".ta-display-text").hide();
        this.$(".ta-editable-container").show();
        return this;
    },
    isEditing() {
        return this.$(".ta-editable-container").is(":visible");
    }
});
