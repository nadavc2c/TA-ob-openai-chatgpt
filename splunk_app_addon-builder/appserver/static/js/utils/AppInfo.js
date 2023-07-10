import { SplunkMvcUtils } from "swc-aob/index";

const getPageInfo = SplunkMvcUtils.getPageInfo;

const _getURLPrefixFromPageInfo = function(pageInfo) {
    let url_prefix = "/" + pageInfo.locale;
    if (pageInfo.root !== undefined) {
        url_prefix = "/" + pageInfo.root + url_prefix;
    }
    return url_prefix;
};

const getLocale = function() {
    return getPageInfo().locale;
};

const getURLPrefix = function() {
    let pageInfo = getPageInfo();
    return _getURLPrefixFromPageInfo(pageInfo);
};
const getAppURLPrefix = function() {
    let pageInfo = getPageInfo();
    return _getURLPrefixFromPageInfo(pageInfo) + "/app/" + pageInfo.app;
};

const getCurrentApp = function() {
    return getPageInfo().app;
};

const getCustomURLPrefix = function() {
    let pageInfo = getPageInfo();
    return _getURLPrefixFromPageInfo(pageInfo) + "/custom/" + pageInfo.app;
};

export {
    getLocale,
    getURLPrefix,
    getAppURLPrefix,
    getCurrentApp,
    getCustomURLPrefix
};
