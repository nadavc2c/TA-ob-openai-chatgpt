import BaseSubView from "app/views/subviews/BaseSubView";
import ReactDOM from "react-dom";
import React from "react";
import { Provider } from "react-redux";

export default BaseSubView.extend({
    initialize: function() {
        BaseSubView.prototype.initialize.apply(this, arguments);
        const store = this.getStore();
        this.unsubscribe = store.subscribe(this.onStoreChange.bind(this));
    },
    // Combine navigation with redux store flow.
    onStoreChange() {
        const store = this.getStore();
        const actions = this.getActions();
        const state = store.getState();
        if (state) {
            const navigation = state.get("navigation");
            if (navigation && navigation.view) {
                this.unsubscribe();
                store.dispatch(actions.getAction("SET_NAVIGATION", null));
                this.controller.navigate(navigation);
            }
        }
    },
    render() {
        const store = this.getStore();
        const Root = this.getRootComponent();
        const props = this.getProps();
        ReactDOM.render(
            <Provider store={ store }>
                <Root { ...props } />
            </Provider>,
            this.el
        );
        return this;
    },
    getStore() {
        throw Error("This method must be implemented in the child class");
    },
    getActions() {
        throw Error("This method must be implemented in the child class");
    },
    getRootComponent() {
        throw Error("This method must be implemented in the child class");
    },
    getProps() {
        return {
            appInfo: this.getAppInfo()
        };
    },
    remove() {
        this.unsubscribe();
        BaseSubView.prototype.remove.apply(this, arguments);
    }
});
