import _ from "lodash";
import Backbone from "backbone";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { updateCookie } from "app/utils/CookieUtil";
import { getCustomURLPrefix } from "app/utils/AppInfo";
import { splunkUtils } from "swc-aob/index";

const RESERVED_FRIENDLY_NAME_CHARS = /[<>\:\"\/\\\|\?\*]/;
const PROJECT_NAME_REGEX = /^[\-_A-Za-z0-9]*$/;
export default Backbone.Model.extend({
    url: getCustomURLPrefix() + "/app_create/create",
    defaults: {
        friendlyName: "",
        previousProjectName: "",
        projectName: "",
        projectNamePrefix: "TA-",
        projectVersion: "1.0.0",
        projectAuthor: "",
        projectDescription: "",
        largeIcon: "",
        smallIcon: "",
        themeColor: "#65A637",
        visible: 0,
        isSetupEnabled: false
    },

    isSetupEnabled: function() {
        return this.get("isSetupEnabled", false);
    },

    validate: function() {
        var msg = this.validateName();
        if (msg) {
            return msg;
        }
        msg = this.validateIcon();
        if (msg) {
            return msg;
        }
    },
    validateProjectName: function(name) {
        var msg;
        name = name == null ? this.get("projectName") : name;
        if (!name.length) {
            msg = getFormattedMessage(2021);
        } else if (!PROJECT_NAME_REGEX.test(name)) {
            msg = getFormattedMessage(2020);
        } else if (name.length > 80) {
            msg = getFormattedMessage(2017);
        }
        if (msg) {
            return msg;
        }
    },
    validateFriendlyName: function() {
        var msg;
        let name;
        name = this.get("friendlyName");
        if (!name.length) {
            msg = getFormattedMessage(2000);
        } else if (RESERVED_FRIENDLY_NAME_CHARS.test(name)) {
            msg = getFormattedMessage(2015);
        } else if (name.length > 80) {
            msg = getFormattedMessage(2017);
        }
        if (msg) {
            return msg;
        }
    },
    validateName: function() {
        var msg = this.validateProjectName();
        if (!msg) {
            msg = this.validateFriendlyName();
        }
        if (msg) {
            return msg;
        }
    },
    validateIcon: function() {
        if (
            this.get("visible") &&
            !(this.get("largeIcon") && this.get("smallIcon"))
        ) {
            return getFormattedMessage(2016);
        }
    },
    save: function(attrs, options = {}) {
        // if (!this.get('projectName')) {
        //     this.set('projectName', this.get('friendlyName').replace(/\s/g, '_'));
        // }
        var success = options.success;
        if (!_.isFunction(success)) {
            success = _.noop;
        }
        options.success = function(response) {
            if (response.get("cookies")) {
                updateCookie(response.get("cookies"));
            }
            success.apply(null, arguments);
        };
        options.headers = {
            'X-Splunk-Form-Key': splunkUtils.getFormKey()
        };
        return Backbone.Model.prototype.save.apply(this, [attrs, options]);
    }
});
