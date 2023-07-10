import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Model.extend({
    url: getCustomURLPrefix() + "/apps_manage/get_global_settings"
});
