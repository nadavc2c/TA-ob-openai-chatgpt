import _ from "lodash";
import JSCookie from "JScookie";

const TAB_COOKIES = [
    "ta_builder_current_ta_name",
    "ta_builder_wizard",
    "built_by_tabuilder",
    "ta_builder_current_ta_display_name"
];

const updateCookie = function(cookies) {
    _.each(cookies, (value, key) => {
        if (_.includes(TAB_COOKIES, key)) {
            if (value.expires === 0) {
                JSCookie.remove(key);
            } else {
                JSCookie.set(key, value.value, {
                    expires: new Date(value.expires),
                    path: value.path
                });
            }
        }
    });
};

export { updateCookie };
