define(["swc-aob/index"], function(SwcIndex) {
    // This shim is only needed for backwards compatibility. It makes numeral a
    // global on the window object to support the language files in:
    // web/search_mrsparkle/exposed/js/contrib/numeral/lang
    // These language files are injected into i18n.js in the
    // `write_numeral_translation` function of
    // /Users/dstreit/splunk/source/main/python-site/splunk/appserver/mrsparkle/lib/i18n.py
    return SwcIndex.numeral;
});
