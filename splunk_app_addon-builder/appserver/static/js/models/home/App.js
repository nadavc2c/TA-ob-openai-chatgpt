import Backbone from "backbone";

export default Backbone.Model.extend({
    defaults: {
        version: "1.0.0",
        name: "TA",
        last_modified: "2016/01/01",
        author: "",
        icon: "",
        visible: true
    },
    initialize: function() {
        // console.log("app initialized");
    }
});
