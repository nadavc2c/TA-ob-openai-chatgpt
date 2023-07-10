import _ from "lodash";
import { createAction } from "redux-actions";
import { getResolvedActionName, getRejectedActionName } from "app/redux/utils";
import { STATUS, COLLECT_FOR_PARTYJS } from "app/redux/constant";

const getAsyncActionKeysFromInstance = actionsInstance => {
    return _.keys(_.pickBy(actionsInstance.ACTIONS, val => val.isAsync));
};

export default class Actions {
    ACTIONS = {};
    subActions = {};
    constructor(...args) {
        this.namespace = _.join(args, ".");
    }
    getSubActions(key) {
        if (!this.subActions[key]) {
            this.subActions[key] = new Actions(this.namespace, key);
        }
        return this.subActions[key];
    }
    _withNamespace(key) {
        const { namespace } = this;
        return namespace ? `${namespace}.${key}` : key;
    }
    _addActionDef(key, isAsync = false) {
        const name = this._withNamespace(key);
        this.ACTIONS[key] = {
            name,
            builder: createAction(name)
        };
        if (isAsync) {
            this.ACTIONS[key].isAsync = isAsync;
        }
    }
    addAction(key) {
        this._addActionDef(key);
    }
    addActions(keys) {
        keys = _.castArray(keys);
        keys = _.concat(keys, [ COLLECT_FOR_PARTYJS ]);
        _(keys).each(key => this.addAction(key));
    }
    getCollectorActionName(){
        const actionDef = this._getActionDef(COLLECT_FOR_PARTYJS);
        return actionDef.name;
    }
    addAsyncAction(key) {
        this._addActionDef(key, true);
        this._addActionDef(getResolvedActionName(key));
        this._addActionDef(getRejectedActionName(key));
    }
    addAsyncActions(keys) {
        keys = _.castArray(keys);
        _(keys).each(key => this.addAsyncAction(key));
    }
    _getActionDef(key) {
        const ownAction = this.ACTIONS[key];
        if (ownAction) {
            return ownAction;
        }
        let subAction = null;
        for (let subKey in this.subActions) {
            if (this.subActions.hasOwnProperty(subKey)) {
                subAction = this.subActions[subKey].ACTIONS[key];
                if (subAction) {
                    break;
                }
            }
        }
        return subAction;
    }
    _getActionBuilder(key) {
        const actionDef = this._getActionDef(key);
        return actionDef ? actionDef.builder : _.noop;
    }
    getActionName(key) {
        const actionDef = this._getActionDef(key);
        return actionDef ? actionDef.name : "";
    }
    getResolvedActionName(key) {
        const actionDef = this._getActionDef(getResolvedActionName(key));
        return actionDef ? actionDef.name : "";
    }
    getRejectedActionName(key) {
        const actionDef = this._getActionDef(getRejectedActionName(key));
        return actionDef ? actionDef.name : "";
    }
    getAsyncActionKeys() {
        const ownKeys = getAsyncActionKeysFromInstance(this);
        const subKeys = _.reduce(
            this.subActions,
            (result, actionsInstance) => {
                return _.concat(
                    result,
                    getAsyncActionKeysFromInstance(actionsInstance)
                );
            },
            []
        );
        return _.concat(ownKeys, subKeys);
    }
    getAction(key, payload) {
        return this._getActionBuilder(key)(payload);
    }
    getResolvedAction(key, payload) {
        return this._getActionBuilder(getResolvedActionName(key))(payload);
    }
    getRejectedAction(key, payload) {
        return this._getActionBuilder(getRejectedActionName(key))(payload);
    }
    getActionStatus(pendings, key) {
        return pendings.get(this.getActionName(key));
    }
    isActionResolved(pendings, key) {
        return this.getActionStatus(pendings, key) === STATUS.RESOLVED;
    }
    isActionRejected(pendings, key) {
        return this.getActionStatus(pendings, key) === STATUS.REJECTED;
    }
    isActionPending(pendings, key) {
        return this.getActionStatus(pendings, key) === STATUS.PENDING;
    }
}
