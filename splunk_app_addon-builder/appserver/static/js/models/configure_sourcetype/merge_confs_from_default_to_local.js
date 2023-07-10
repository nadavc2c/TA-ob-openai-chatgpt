import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Model.extend({
    url: getCustomURLPrefix() +
        "/app_edit_fieldextraction/merge_confs_from_default_to_local"
});
