import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

const baseUrl = getCustomURLPrefix() + "/app_edit_datainputs/code_check_pid";
export default Backbone.Model.extend({
    url: baseUrl,
    psCheck(options) {
        this.url = baseUrl + "?test_id=" + this.get("test_id");
        return this.fetch(options);
    }
});
