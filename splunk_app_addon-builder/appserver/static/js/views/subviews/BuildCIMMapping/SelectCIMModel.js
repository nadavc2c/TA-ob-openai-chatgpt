import BaseSubViewWithRedux from "app/views/subviews/BaseSubViewWithRedux.js";
import store from "app/redux/stores/cimMapping";
import actions from "app/redux/actions/cimMapping";
import Root from "./SelectCIMModel/Master.jsx";

export default BaseSubViewWithRedux.extend({
    showNavBar: false,
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
    },
    getProps() {
        return {
            eventTypeInfo: this.options.eventTypeInfo
        };
    }
});
