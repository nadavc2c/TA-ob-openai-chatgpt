ace.define("ace/theme/spl-black-white",["require","exports","module","ace/lib/dom"], function(require, exports, module) {

exports.isDark = false;
exports.cssClass = "ace-spl-black-white";
exports.cssText =".ace-spl-black-white .ace_gutter {\
    background: #F5F5F5;\
    color: #999999;\
}\
.ace-spl-black-white {\
    background-color: #FFFFFF;\
    color: #333333;\
}\
.ace-spl-black-white .ace_cursor {\
    color: #333333;\
}\
.ace-spl-black-white .ace_invalid {\
    background-color: rgba(255, 0, 0, 0.1);\
    color: #D90700;\
}\
.ace-spl-black-white .ace_marker-layer .ace_selection {\
    background: #B5D5FF;\
}\
.ace-spl-black-white:not(.read-only) .ace_marker-layer .ace_bracket {\
    margin: -1px 0 0 -1px;\
    border: 1px solid #333333;\
}\
.ace-spl-black-white:not(.read-only) .ace_gutter-active-line {\
    background-color : #dcdcdc;\
}\
.ace-spl-black-white .ace_marker-layer .ace_selected-word {\
    background: rgb(250, 250, 255);\
    border: 1px solid rgb(200, 200, 250);\
}\
.ace-spl-black-white.ace_editor.ace_autocomplete {\
    background-color: #FFFFFF;\
    color: black;\
}\
.ace-spl-black-white.ace_editor.ace_autocomplete .ace_marker-layer .ace_active-line {\
    background: rgba(61, 170, 255, 0.12);\
}\
.ace-spl-black-white.ace_editor.ace_autocomplete .ace_marker-layer .ace_line-hover {\
    background: #F5F5F5;\
}\
.ace-spl-black-white.read-only .ace_cursor {\
    opacity: 0;\
}\
.ace-spl-black-white.disabled .ace_content {\
    cursor: not-allowed;\
    opacity: 0.6;\
}\
.ace-spl-black-white.disabled {\
    background-color: #f5f5f5;\
}";

var dom = require("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});