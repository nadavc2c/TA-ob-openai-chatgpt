import _ from "lodash";
import { actionFac } from "app/views/flux/actionHandlerFactor";
import { storeFac } from "app/views/flux/storeFactory";
import { controlledViewFac } from "app/views/flux/dataProviderFactory.jsx";
import * as uuid from "uuid";

let wrapperFactory = function(storeAction) {
    let actionFunctionList = _.map(storeAction.ACTION_MAP, funcName => {
        return {
            eventName: uuid.v1(),
            functionName: funcName,
            func: storeAction[funcName].bind(storeAction)
        };
    });
    let Actions = actionFac(actionFunctionList);
    storeFac(storeAction.emitter, actionFunctionList);

    let Wrapper = controlledViewFac(storeAction);
    return {
        Actions,
        Wrapper
    };
};

export { wrapperFactory };
