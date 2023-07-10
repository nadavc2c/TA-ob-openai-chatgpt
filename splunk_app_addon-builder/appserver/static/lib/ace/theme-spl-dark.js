ace.define("ace/theme/spl-dark",["require","exports","module","ace/lib/dom"], function(require, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-spl-dark";
exports.cssText =".ace-spl-dark .ace_gutter {\
    background: #333333;\
    color: #999999;\
}\
.ace-spl-dark {\
    background-color: #2b3033;\
    color: #CCCCCC;\
}\
.ace-spl-dark .ace_cursor {\
    color: #CCCCCC;\
}\
.ace-spl-dark .ace_invalid {\
    color: #FF6B66;\
}\
.ace-spl-dark .ace_comment {\
    color: #AAAAAA;\
}\
.ace-spl-dark .ace_command {\
    color: #789EFF;\
}\
.ace-spl-dark .ace_function {\
    color: #D97ED9;\
}\
.ace-spl-dark .ace_argument {\
    color: #95D640;\
}\
.ace-spl-dark .ace_modifier {\
    color: #F7A45B;\
}\
.ace-spl-dark .ace_marker-layer .ace_selection {\
    background: #555555;\
}\
.ace-spl-dark:not(.read-only) .ace_marker-layer .ace_bracket {\
    margin: -1px 0 0 -1px;\
    border: 1px solid #CCCCCC;\
}\
.ace-spl-dark .ace_marker-layer .ace_selected-word {\
    border: 1px solid #CCCCCC;\
}\
.ace-spl-dark.ace_editor {\
    border: 1px solid #000000;\
}\
.ace-spl-dark.ace_editor.ace_autocomplete .ace_rightAlignedText{\
    color:#999999;\
}\
.ace-spl-dark.ace_editor.ace_autocomplete {\
    background: #31373E;\
    color: #CCCCCC;\
}\
.ace-spl-dark.ace_editor.ace_autocomplete .ace_marker-layer .ace_active-line {\
    background: rgba(61, 170, 255, 0.22);\
}\
.ace-spl-dark.ace_editor.ace_autocomplete .ace_marker-layer .ace_line-hover {\
    background: #333333;\
}\
.ace-spl-dark.read-only .ace_cursor {\
    opacity: 0;\
}\
.ace-spl-dark.disabled .ace_content {\
    cursor: not-allowed;\
    opacity: 0.6;\
}\
.ace-spl-dark.disabled {\
    background-color: #333333;\
}\
";

var dom = require("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
