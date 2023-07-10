import _ from "lodash";
import Backbone from "backbone";
import JSCookie from "JScookie";
import { updateCookie } from "app/utils/CookieUtil";
import { getCustomURLPrefix } from "app/utils/AppInfo";

/**
    this model is used to store the context of current creating/editing app
    {
      app_name: project-name,
      built: yes/no, if this ta is built by tabuilder
    }
*/
export default Backbone.Model.extend({
    url: getCustomURLPrefix() + "/apps_manage/current_app",

    StepInfo: {
        name_project: 1,
        configure_data_collection: 2,
        configure_sourcetype: 3,
        field_extract: 4,
        cim_mapping: 5,
        validate: 6,
        summary: 7
    },

    initialize: function() {
        this.fetch();
    },

    save: function(attrs, options) {
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
        Backbone.Model.prototype.save.apply(this, arguments);
    },

    /*
        Get the data from cookie, do not use ajax
        */
    fetch: function() {
        var project = JSCookie.get("ta_builder_current_ta_name");
        if (project) {
            this.set("app_name", project);
        }
        var name = JSCookie.get("ta_builder_current_ta_display_name");
        if (name) {
            this.set("app_display_name", name);
        }
        var built = JSCookie.get("built_by_tabuilder");
        if (built) {
            this.set("built", built);
        } else {
            this.set("built", "no");
        }
        return this;
    },

    getAppName: function() {
        var name = this.get("app_name") || "";
        return name;
    },

    getAppDisplayName: function() {
        var name = this.get("app_display_name") || "";
        return name;
    },

    isBuiltByTabuilder: function() {
        return this.get("built", "yes") === "yes";
    }
});
