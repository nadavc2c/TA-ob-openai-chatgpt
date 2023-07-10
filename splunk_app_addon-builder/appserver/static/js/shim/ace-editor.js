define(
    ["swc-aob/index", "script-loader!lib/ace/ace", "script-loader!lib/ace/ext-language_tools"],
    function(SwcIndex) {
        const splunkUtil = SwcIndex.splunkUtils
        var basePath = splunkUtil.make_url(
            "static/app/splunk_app_addon-builder/lib/ace"
        );
        window.ace.config.set("basePath", basePath);
        return window.ace;
    }
);
