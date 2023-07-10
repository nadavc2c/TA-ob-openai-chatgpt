import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Model.extend({
    url: getCustomURLPrefix() + "/apps_manage/user_allow",

    is_allowed: function() {
        return !this.get("err_code");
    }
});
