import ACEWrapper from "app/views/common/ACEWrapper";
import ace from "ace-editor";
import _ from "lodash";

export default ACEWrapper.extend({
    className: "ta-ace-wrapper ta-code-editor-view",
    initialize() {
        ACEWrapper.prototype.initialize.apply(this, arguments);
        this.mode = this.mode || "python";
        this.onChange = this.options.onChange;
        if (!_.isFunction(this.onChange)) {
            this.onChange = _.noop;
        }
    },
    render() {
        this.$el.html(`<div class="ta-code-editor-wrapper"></div>`);
        let editor = (this.editor = ace.edit(
            this.$(".ta-code-editor-wrapper")[0]
        ));
        editor.$blockScrolling = Infinity;
        editor.setTheme("ace/theme/monokai");
        editor.getSession().setMode(`ace/mode/${this.mode}`);
        editor.getSession().setUseWrapMode(true);
        editor.getSession().setUseWorker(false);
        editor.getSession().on("change", e => {
            this.onChange(e);
        });
        return this;
    },
    onCtrlEnter(callback) {
        this.addCommand({
            name: "testCode",
            bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
            exec: editor => {
                callback(editor);
            }
        });
        return this;
    },
    onCtrlS(callback) {
        this.addCommand({
            name: "testCode",
            bindKey: { win: "Ctrl-S", mac: "Command-S" },
            exec: editor => {
                callback(editor);
            }
        });
        return this;
    },
    setCompleter(completions) {
        let completer = {
            getCompletions: function(editor, session, pos, prefix, callback) {
                callback(
                    null,
                    completions.map(item => {
                        return {
                            meta: "ta-builder-code-snippet",
                            caption: item.label,
                            snippet: item.value
                        };
                    })
                );
            }
        };
        this.editor.setOptions({
            enableBasicAutocompletion: true
        });
        this.editor.completers = [completer];
        this.addCommand({
            name: "tabuilderAutocomplete",
            bindKey: { win: "Ctrl-O", mac: "Command-O" },
            exec: editor => {
                editor.execCommand("startAutocomplete");
            }
        });
        return this;
    }
});
