import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

export default Backbone.Collection.extend({
    url: getCustomURLPrefix() + "/app_validation/validators"
});
