require([
    "app/routers/AppRouter",
    "app/controllers/AppController",
    "swc-aob/index"
], function(
    AppRouter,
    AppController,
    SwcIndex
) {
    const Router_utils = SwcIndex.RouterUtils;
    const SplunkController = SwcIndex.SplunkController;
    const SharedModels = SwcIndex.SharedModels;
    
    AppRouter = AppRouter["default"];
    AppController = AppController["default"];

    const router = new AppRouter({
        controller: AppController
    });

    /*
     * ------- HACK FOR SPLUNK DASHBOARD --------
     */

    delete window.__splunkjs_router_disabled__;
    SplunkController.router = router;
    SplunkController.collection = {};
    SplunkController.model.app = SharedModels.get("app");
    SplunkController.model.appLocal = SharedModels.get("appLocal");
    SplunkController.model.user = SharedModels.get("user");
    SplunkController.model.userPref = SharedModels.get("userPref");
    SplunkController.collection.times = SharedModels.get("times");
    SplunkController.model.serverInfo = SharedModels.get("serverInfo");
    /*
     * ------- HACK END --------
     */

    Router_utils.start_backbone_history();
});
