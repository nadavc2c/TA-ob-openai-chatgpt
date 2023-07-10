import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Model.extend({
    url: getCustomURLPrefix() + "/app_home/app_delete"
});
