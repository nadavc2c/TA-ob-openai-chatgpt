window.__splunkjs_router_disabled__ = true;

require([
    "app/routers/AppRouter",
    "app/controllers/AppHomeController",
    "swc-aob/index"
], function(AppRouter, AppHomeController, SwcIndex) {

    const Router_utils = SwcIndex.RouterUtils;

    AppRouter = AppRouter["default"];
    AppHomeController = AppHomeController["default"];

    new AppRouter({
        controller: AppHomeController
    });

    Router_utils.start_backbone_history();
});
