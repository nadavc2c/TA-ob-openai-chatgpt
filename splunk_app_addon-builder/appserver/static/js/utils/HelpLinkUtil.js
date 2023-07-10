import _ from "lodash";
import { splunkUtils } from "swc-aob/index";
import HelpLinkDict from "app/profiles/HelpLinkDict";

const make_url = splunkUtils.make_url;
const APP_NAME = "splunk_app_addon-builder";
const APP_VERSION = "<!-- version -->";
const APP_PREFIX = encodeURIComponent("[" + APP_NAME + ":" + APP_VERSION + "]");

const makeHelpUrl = function(key, noPrefix) {
    let url = make_url("help") + "?location=";
    if (!noPrefix) {
        url += APP_PREFIX;
    }
    url += key;
    return url;
};
const getDescription = function(key) {
    if (HelpLinkDict[key] && HelpLinkDict[key].description != null) {
        return _.t(HelpLinkDict[key].description);
    } else {
        return "";
    }
};
const getHelpUrl = function(key) {
    if (HelpLinkDict[key] && HelpLinkDict[key].key != null) {
        return makeHelpUrl(HelpLinkDict[key].key);
    } else {
        return "";
    }
};
const getHelpLinkObj = function(key) {
    return {
        description: getDescription(key),
        url: getHelpUrl(key)
    };
};
export { makeHelpUrl, getDescription, getHelpUrl, getHelpLinkObj, APP_VERSION };
