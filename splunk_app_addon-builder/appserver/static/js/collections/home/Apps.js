import Backbone from "backbone";
import App from "app/models/home/App";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Collection.extend({
    url: getCustomURLPrefix() + "/app_home/app_list",
    model: App
});
