import Root from "./Home/Master.jsx";
import BaseSubViewWithRedux from "app/views/subviews/BaseSubViewWithRedux.js";
import store from "app/redux/stores/fieldExtraction";
import actions from "app/redux/actions/fieldExtraction";

export default BaseSubViewWithRedux.extend({
    initialize: function() {
        BaseSubViewWithRedux.prototype.initialize.apply(this, arguments);
    },
    getStore() {
        return store;
    },
    getActions() {
        return actions;
    },
    getRootComponent() {
        return Root;
    }
});
