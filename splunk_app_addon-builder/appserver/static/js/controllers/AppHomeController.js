import _ from "lodash";
import BaseController from "app/controllers/BaseController";
import WarningView from "app/views/common/WarningView";
import { getAppURLPrefix } from "app/utils/AppInfo";

import HomeSubView from "app/views/subviews/Home/Master";

import AoBConfigurationView from "app/views/subviews/AoBConfiguration/Master";

import { getMessageFromModel } from "app/utils/MessageUtil";

const URL_PREFIX = getAppURLPrefix() + "/tab_home";

const BUILT_IN_VIEWS = {
    __default: "main",

    // view-method mapping
    "not-allowed": "_showWarning",
    main: "_showHome",
    settings: "_showGlobalSettings"
};

const BUILT_IN_NAV_ITEMS = [
    {
        value: "main",
        label: _.t("Home")
    },
    {
        value: "settings",
        label: _.t("Configuration")
    }
];

export default class AppHomeController extends BaseController {
    constructor(...params) {
        super(...params);
    }
    getUrlPrefix() {
        return URL_PREFIX;
    }
    getPageName() {
        return "tab_home.html";
    }
    _getNavItems() {
        return BUILT_IN_NAV_ITEMS;
    }
    _getViews() {
        return BUILT_IN_VIEWS;
    }
    _showWarning() {
        const privilege = this.models.privilege;
        this._renderView(WarningView, {
            content: getMessageFromModel(privilege)
        });
    }
    _showHome() {
        this._renderView(HomeSubView);
    }
    _showGlobalSettings() {
        this._renderView(AoBConfigurationView);
    }
}
