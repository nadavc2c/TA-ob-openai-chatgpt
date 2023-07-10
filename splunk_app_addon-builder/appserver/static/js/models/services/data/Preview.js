import _ from "lodash";
import { PreviewModel } from "swc-aob/index";

export default PreviewModel.extend({
    initialize: function() {
        PreviewModel.prototype.initialize.apply(this, arguments);
    },
    preview: function(inputFile, sid, props) {
        var attrs = {
            "input.path": inputFile
        };

        //use existing job in case of file upload, or hunk preview.
        if (sid) {
            attrs["job.id"] = sid;
        }

        if (this.isFileJson(inputFile)) {
            attrs["props.sourcetype"] = "_json";
        }

        // preview with explicit/preset props and override with any passed props
        _.each(props, function(value, key) {
            // ignore undefined or null prop value
            if (value == null) return;

            attrs["props." + key] = value;
        });

        // Preview model does not support update. So clear model including
        // id property, so subsequent save translate to a create (POST)
        this.clear();

        return this.save(
            {},
            {
                data: attrs
            }
        );
    },
    isFileJson: function(name) {
        name = name || "";
        //return true if name ends in ".json" or is just "json"
        var ext = name.substring(name.lastIndexOf(".") + 1);
        if (ext.toLowerCase() === "json") {
            return true;
        }
        return false;
    }
});
