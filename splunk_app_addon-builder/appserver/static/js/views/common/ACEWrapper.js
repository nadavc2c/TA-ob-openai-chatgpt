import BaseView from "app/components/BaseView";
import ace from "ace-editor";

ace.require("ace/ext/language_tools");

export default BaseView.extend({
    className: "ta-ace-wrapper",
    initialize() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.mode = this.options.mode;
    },
    setValue(value) {
        if (!this.editor) {
            return this;
        }
        this.editor.setValue(value);
        this.editor.selection.clearSelection();
        return this;
    },
    getValue() {
        if (!this.editor) {
            return "";
        }
        return this.editor.getValue();
    },
    addCommand(command) {
        this.editor.commands.addCommand(command);
        return this;
    },
    resize() {
        if (!this.editor) {
            return this;
        }
        this.editor.resize();
        return this;
    },
    setOptions(options) {
        if (this.editor) {
            this.editor.setOptions(options);
        }
        return this;
    }
});
