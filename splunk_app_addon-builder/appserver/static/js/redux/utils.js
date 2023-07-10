import _ from "lodash";
import Immutable from "immutable";
import { STATUS, METHOD_NAMES, CONTENT_TYPE, COLLECT_FOR_PARTYJS, TRACK_ERROR } from "app/redux/constant";
import { getCustomURLPrefix } from "app/utils/AppInfo";
import { splunkUtils } from "swc-aob/index";
import { ajax } from "rxjs/observable/dom/ajax";
import { Observable } from "rxjs/Rx";

const getFormKey = splunkUtils.getFormKey;

// Observable operators
import "rxjs/add/observable/of";
import "rxjs/add/observable/throw";
import "rxjs/add/operator/catch";
import "rxjs/add/operator/debounceTime";
import "rxjs/add/operator/distinctUntilChanged";
import "rxjs/add/operator/do";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/map";
import "rxjs/add/operator/switchMap";
import "rxjs/add/operator/mapTo";
import {
    getMessageFromObject,
    getFormattedMessage
} from "app/utils/MessageUtil";
import { handleActions } from "redux-actions";
import Collector from "app/profiles/partyjsCollector";
const collect = Collector.collect;

const url_prefix = getCustomURLPrefix();
const getResolvedActionName = actionName => {
    return `${actionName}_${STATUS.RESOLVED}`;
};

const getRejectedActionName = actionName => {
    return `${actionName}_${STATUS.REJECTED}`;
};

const getAjaxParams = (config, payload) => {
    let params = _.cloneDeep(config);
    params.url = url_prefix + params.url;
    params.responseType = "json";
    params.headers = {
        "Content-Type": params.contentType || CONTENT_TYPE.JSON
    };
    if (config.method === METHOD_NAMES.GET) {
        if (_.isPlainObject(payload) && _.size(payload) !== 0) {
            let url = params.url;
            url += "?";
            _.each(payload, (value, key) => {
                url += `${key}=${value}&`;
            });
            // Remove the last '&' character.
            params.url = url.slice(0, url.length - 1);
        }
    } else {
        params.body = payload;
        params.headers["X-Splunk-Form-Key"] = getFormKey();
    }
    return params;
};

const getAsynchronizedDataStreamTemplate = ({ actions, actionKey, config }) => {
    return action$ => {
        return action$
            .ofType(actions.getActionName(actionKey))
            .switchMap(({ payload }) => {
                let errorPayload = {};
                return ajax(getAjaxParams(config, payload))
                    .catch(error => Observable.of(error))
                    .map(res => res.response || res)
                    .map(res => {
                        if (res.hasOwnProperty("data")) {
                            return _.isFunction(config.normalizer)
                                ? config.normalizer(res.data, payload)
                                : res.data;
                        } else {
                            if (res.err_code) {
                                errorPayload = {
                                    message: getMessageFromObject(res),
                                    err_code: res.err_code,
                                    err_args: res.err_args
                                };
                                throw Error(getMessageFromObject(res));
                            } else {
                                errorPayload = {
                                    message: getFormattedMessage(config.serverErrorCode),
                                    err_code: res.err_code,
                                };
                                throw Error(
                                    getFormattedMessage(config.serverErrorCode)
                                );
                            }
                        }
                    })
                    .flatMap(data => {
                        if(config.collectType){
                            return Observable.concat(
                                Observable.of(actions.getResolvedAction(actionKey, data)),
                                Observable.of(actions.getAction(COLLECT_FOR_PARTYJS, {
                                    data: payload,
                                    type: config.collectType
                                }))
                            );
                        }
                        else{
                            return Observable.of(actions.getResolvedAction(actionKey, data));
                        }
                    })
                    .catch(error =>
                        Observable.concat(
                            Observable.of(
                                actions.getRejectedAction(actionKey, error.message)
                            ),
                            Observable.of(actions.getAction(COLLECT_FOR_PARTYJS, {
                                data: errorPayload,
                                type: TRACK_ERROR
                            }))
                        )
                    );
            });
    };
};
const generatePartyJSEpic = (actionName, type) =>{
    return action$ =>
        action$
            .ofType(actionName)
            .switchMap(
                ({ payload }) => {
                    if(payload.type === TRACK_ERROR){
                        collect(
                            payload.type,
                            payload.data
                        );
                    }
                    else{
                        collect(payload.type, {
                            type: type,
                            data: payload.data
                        });
                    }
                    return Observable.of({}).takeWhile(()=>false);
                }
            );
};

const generateEpics = (actionKeyToConfig, actions) => {
    return _.reduce(
        actionKeyToConfig,
        (result, config, actionKey) => {
            result.push(
                getAsynchronizedDataStreamTemplate({
                    actions,
                    actionKey,
                    config
                })
            );
            return result;
        },
        []
    );
};

const generateRedirectEpic = (srcActionName, desActionName, mapper, redirectCondition) => {
    const epic = (action$, store) =>{
        let isRedireactable = true;
        return action$.ofType(srcActionName).switchMap(({ payload }) => {

            if (_.isFunction(redirectCondition)) {
                isRedireactable = !!redirectCondition(payload, store);
            }

            let redirectedActionName = desActionName;
            if (_.isFunction(desActionName)) {
                redirectedActionName = desActionName(payload);
            }

            let redirectedPayload = payload;
            if (_.isFunction(mapper)) {
                redirectedPayload = mapper(payload, store);
            }

            return Observable.of({
                type: redirectedActionName,
                payload: redirectedPayload
            });
        }).takeWhile(function () { return isRedireactable; });
    };
    return epic;
};

const generateNavigationReducers = actions => {
    return handleActions(
        {
            [actions.getActionName("SET_NAVIGATION")]: (state, action) =>
                action.payload
        },
        null
    );
};

const generatePendingsReducers = actions => {
    const actionKeys = actions.getAsyncActionKeys();
    let initialState = Immutable.Map();
    const mapActionToReducers = _.reduce(
        actionKeys,
        (result, actionKey) => {
            const actionName = actions.getActionName(actionKey);
            result[actionName] = state => {
                return state.set(actionName, STATUS.PENDING);
            };
            result[actions.getResolvedActionName(actionKey)] = state => {
                return state.set(actionName, STATUS.RESOLVED);
            };
            result[actions.getRejectedActionName(actionKey)] = state => {
                return state.set(actionName, STATUS.REJECTED);
            };
            return result;
        },
        {}
    );
    mapActionToReducers[actions.getActionName("CLEAR_EPIC_STATUS")] = (
        state,
        { payload }
    ) => {
        if (!payload) {
            return initialState;
        } else {
            const actionNames = _.map(_.castArray(payload), actionKey => {
                return actions.getActionName(actionKey);
            });
            return state.filterNot((value, key) => {
                return _.includes(actionNames, key);
            });
        }
    };
    return handleActions(mapActionToReducers, initialState);
};

export {
    getResolvedActionName,
    getRejectedActionName,
    generateEpics,
    generateRedirectEpic,
    generateNavigationReducers,
    generatePendingsReducers,
    generatePartyJSEpic
};
