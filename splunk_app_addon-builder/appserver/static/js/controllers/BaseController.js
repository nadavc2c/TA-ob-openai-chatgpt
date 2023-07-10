import Backbone from "backbone";
import $ from "jquery";
import _ from "lodash";
import { SplunkHeaderView } from "swc-aob/index";
import UsrPrivilege from "app/models/common/user_privilege";
import CurrentTA from "app/models/flow_wizard/current_ta";
import { removeAll } from "app/utils/EditablePopoverUtil";
import NavView from "app/views/NavView";
import Collector from "app/profiles/partyjsCollector";

export default class BaseController {
    constructor({ router }) {
        this._router = router;
        this._container = $("#addonContainer");
        this.models = {
            currentTA: new CurrentTA(),
            privilege: new UsrPrivilege(),
            navigation: new Backbone.Model()
        };
        this.deferreds = {};

        this._renderSplunkHeader();
        this._renderNavBar();
    }
    getUrlPrefix() {
        throw new Error("This method must be implemented in sub classes.");
    }
    getPageName() {
        throw new Error("This method must be implemented in sub classes.");
    }
    _getNavItems() {
        throw new Error("This method must be implemented in sub classes.");
    }
    _getViews() {
        throw new Error("This method must be implemented in sub classes.");
    }
    bootstrap(locale, app, page, { view, action }) {
        if (!this._bootstraped) {
            this.deferreds.privilege = this.models.privilege.fetch();
            this.models.navigation.on("change", this._onNavChange.bind(this));
            this._bootstraped = true;
        }
        this.deferreds.privilege.done(() => {
            const replace = true;
            if (!this.models.privilege.is_allowed()) {
                this.navigate({
                    view: "not-allowed",
                    action: "",
                    replace
                });
            } else {
                this.navigate({
                    view,
                    action,
                    replace
                });
                let items = this._getNavItems();
                this._navBar.setItems(items);
            }
        });
    }
    navigate({
        view = "main",
        action = "",
        replace = false,
        refreshNav = false,
        params
    }) {
        removeAll();
        let views = this._getViews();
        let viewToShow = view;
        if (!(viewToShow in views) || viewToShow === "__default") {
            viewToShow = views.__default;
        }
        this.models.navigation.set(
            {
                view: viewToShow,
                action: action
            },
            {
                silent: true
            }
        );

        if (refreshNav) {
            this._navBar.onAttrChange();
        }

        let urlPrefix = this.getUrlPrefix();
        let url = action
            ? `${urlPrefix}?view=${viewToShow}&action=${action}`
            : `${urlPrefix}?view=${viewToShow}`;
        this._router.navigate(url, {
            replace
        });

        let collectedData = {
            view: viewToShow,
            page: this.getPageName()
        };
        if (_.isFunction(this.getAppName)) {
            collectedData.app_name = this.getAppName();
        }
        let fallback = this[views[viewToShow]](action, params);
        if (fallback) {
            this._router.navigate(`${urlPrefix}?view=${viewToShow}`, {
                replace: true
            });
        } else {
            collectedData.action = action;
        }
        Collector.collect("track_step_view", collectedData);
    }
    showNavBar() {
        this._navBar.render().show();
        if (this._currentViewInstance) {
            this._currentViewInstance.$el.removeClass(
                "ta-sub-view-without-nav"
            );
        }
    }
    hideNavBar() {
        this._navBar.hide();
        if (this._currentViewInstance) {
            this._currentViewInstance.$el.addClass("ta-sub-view-without-nav");
        }
    }
    _renderSplunkHeader() {
        let headerView = new SplunkHeaderView({
            id: "splunkheader",
            section: "dashboards",
            el: $("#splunk-header"),
            acceleratedAppNav: false,
            appbar: false
        });
        headerView.render();
    }
    _renderNavBar() {
        this._navBar = new NavView({
            model: this.models.navigation,
            modelAttribute: "view",
            controller: this
        });
        this._navBar.render().$el.insertAfter("#splunk-header");
    }
    _onNavChange() {
        this.navigate(this.models.navigation.toJSON());
    }
    _renderView(viewClass, options = {}) {
        if (this._currentViewInstance) {
            this._currentViewInstance.remove();
        }
        this._currentViewInstance = new viewClass(
            _.extend(options, {
                controller: this
            })
        );
        this._container.html(this._currentViewInstance.render().$el);
        if (this._currentViewInstance.isShowNavBar()) {
            this.showNavBar();
        } else {
            this.hideNavBar();
        }
    }
}
