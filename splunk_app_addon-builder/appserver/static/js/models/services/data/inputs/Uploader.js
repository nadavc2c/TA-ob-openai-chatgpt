import _ from "lodash";
import { BaseInputModel } from "swc-aob/index";

export default BaseInputModel.extend({
    url: "data/inputs/monitor",
    urlRoot: "data/inputs/monitor",
    validation: {
        file: [
            {
                required: true,
                msg: _.t("File must be selected.")
            }
        ]
    }
});
