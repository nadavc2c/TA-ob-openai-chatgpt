import _ from "lodash";
import { BaseRouter } from "swc-aob/index";

function parseQueryString(queryString) {
    // parse query string into a JSON object
    let params = {};
    if (!_.isString(queryString)) {
        return params;
    }
    queryString = queryString.substring(queryString.indexOf("?") + 1);
    let queryParts = decodeURI(queryString).split(/&/g);
    for (let value of queryParts) {
        let parts = value.split("=");
        if (parts.length >= 1) {
            let val;
            if (parts.length === 2) {
                val = parts[1];
            }
            params[parts[0]] = val;
        }
    }
    return params;
}
// const URL_PREFIX = AppInfo.getAppURLPrefix();
export default BaseRouter.extend({
    initialize({ controller }) {
        BaseRouter.prototype.initialize.apply(this);
        this.controller = new controller({
            router: this
        });
    },
    routes: {
        ":locale/app/:app/:page(/)": "_route",
        "*root/:locale/app/:app/:page(/)": "_routeRooted"
    },
    _route(locale, app, page, queryString) {
        BaseRouter.prototype.page.apply(this, arguments);
        this.deferreds.pageViewRendered.done(() => {
            let params = parseQueryString(queryString);
            this.controller.bootstrap(locale, app, page, params);
        });
    },
    _routeRooted(root, locale, app, page, queryString) {
        this.model.application.set(
            {
                root: root
            },
            { silent: true }
        );
        this._route(locale, app, page, queryString);
    }
});
