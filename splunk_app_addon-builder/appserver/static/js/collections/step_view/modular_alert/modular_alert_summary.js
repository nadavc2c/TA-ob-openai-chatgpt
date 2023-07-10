import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Collection.extend({
    url: getCustomURLPrefix() +
        "/app_edit_modularalert/get_modular_alerts_summary"
});
