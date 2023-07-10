import _ from "lodash";
import ACEWrapper from "app/views/common/ACEWrapper";
import Template from "contrib/text!app/views/common/OutputArea.html";
import ace from "ace-editor";

export default ACEWrapper.extend({
    template: Template,
    className: "ta-ace-wrapper ta-output-area-view",
    initialize() {
        ACEWrapper.prototype.initialize.apply(this, arguments);
        this.mode = this.mode || "text";
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        let editor = (this.editor = ace.edit(
            this.$(".ta-output-area-wrapper")[0]
        ));
        editor.$blockScrolling = Infinity;
        editor.setOption("readOnly", true);
        editor.setOption("showLineNumbers", false);
        editor.setOption("showPrintMargin", false);
        editor.setOption("showGutter", false);
        editor.setTheme("ace/theme/github");
        editor.getSession().setMode(`ace/mode/${this.mode}`);
        // editor.getSession().setUseWrapMode(true);
        editor.getSession().setUseWorker(false);

        return this;
    },
    setMode(mode) {
        this.mode = mode;
        this.editor.getSession().setMode(`ace/mode/${this.mode}`);
        return this;
    },
    setNormalMessage(msg) {
        this.$(".ta-output-status").html(
            `<span class='ta-code-status'>${_.escape(msg)}</span>`
        );
        this.$(".ta-output-area-wrapper")
            .removeClass("ta-status-success")
            .removeClass("ta-status-error");
        return this;
    },
    setSuccessMessage(msg) {
        this.$(".ta-output-status").html(
            `<span class='ta-code-status ta-code-status-success'><i class=icon-check-circle></i>${_.escape(msg)}</span>`
        );
        this.$(".ta-output-area-wrapper")
            .addClass("ta-status-success")
            .removeClass("ta-status-error");

        return this;
    },
    setErrorMessage(msg) {
        this.$(".ta-output-status").html(
            `<span class='ta-code-status ta-code-status-error'><i class=icon-x-circle></i>${_.escape(msg)}</span>`
        );
        this.$(".ta-output-area-wrapper")
            .addClass("ta-status-error")
            .removeClass("ta-status-success");

        return this;
    },
    setValueWithMarker(value, classAndHL) {
        if (!this.editor) {
            return this;
        }
        this.editor.setValue(value);
        this.editor.selection.clearSelection();
        let lines = value.split("\n");
        let Range = ace.require("ace/range").Range;
        _.each(classAndHL, (hl, markClass) => {
            _.each(hl, lineno => {
                this.editor.session.addMarker(
                    new Range(lineno, 0, lineno, lines[lineno].length),
                    markClass,
                    "text",
                    false
                );
            });
        });
        return this;
    },
    addMarker(markClass, hl, lines, Range) {
        if (!this.editor) {
            return this;
        }
        _.each(hl, lineno => {
            this.editor.session.addMarker(
                new Range(lineno, 0, lineno, lines[lineno].length),
                markClass,
                "text",
                false
            );
        });
        return this;
    },
    cleanMarker() {
        if (!this.editor) {
            return this;
        }
        let markers = this.editor.session.getMarkers(false);
        _.each(markers, (v, markerId) => {
            this.editor.session.removeMarker(markerId);
        });
        return this;
    }
});
