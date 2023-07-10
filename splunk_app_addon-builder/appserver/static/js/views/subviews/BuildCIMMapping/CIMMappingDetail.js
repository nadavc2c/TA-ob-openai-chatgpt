import Immutable from "immutable";
import BaseSubViewWithRedux from "app/views/subviews/BaseSubViewWithRedux.js";
import store from "app/redux/stores/cimMapping";
import actions from "app/redux/actions/cimMapping";
import Root from "./CIMMappingDetail/Master.jsx";

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
            appInfo: this.getAppInfo(),
            eventTypeInfo: Immutable.Map(this.options.eventTypeInfo),
            shouldUpdateFields: !!this.options.shouldUpdateFields
        };
    }
});
