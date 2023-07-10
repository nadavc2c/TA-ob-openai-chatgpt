import Backbone from "backbone";
import { getCustomURLPrefix } from "app/utils/AppInfo";

const url_prefix = getCustomURLPrefix();
export default Backbone.Model.extend({
    kill_all: function(inputName, options) {
        this.url = url_prefix + "/app_edit_datainputs/code_kill_all";
        this.save(
            {
                name: inputName
            },
            options
        );
    },
    kill_pid: function(test_id, options) {
        this.url = url_prefix + "/app_edit_datainputs/code_kill_pid";
        this.save(
            {
                test_id: test_id
            },
            options
        );
    }
});
