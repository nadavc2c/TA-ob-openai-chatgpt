import { Model } from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

const urlPrefix = getCustomURLPrefix();
const exportlinkPrefix = urlPrefix + "/app_migrate/export_app";
const downloadlinkPrefix = urlPrefix + "/app_migrate/download_exported_app";

export default Model.extend({
    url() {
        return exportlinkPrefix + "?app=" + this.get("app");
    },
    getDownloadLink() {
        return downloadlinkPrefix + "?app=" + this.get("app");
    }
});
