import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Model.extend({
    url() {
        return (
            getCustomURLPrefix() +
            "/app_validation/get_validation_progress?app_name=" +
            this.get("app_name") +
            "&validation_id=" +
            this.get("validation_id")
        );
    }
});
