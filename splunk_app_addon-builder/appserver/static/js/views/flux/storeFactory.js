import AppDispatcher from "./dispatcher/AppDispatcher";
/*
{
@eventName: String
@functionName : function
}

Note: it's just a shorthand for stand-alone register, waitFor is not support there
*/

let storeFac = function(tableStore, arr) {
    let dataUpdateFunc = {};
    for (let action of arr) {
        dataUpdateFunc[action.eventName] = action.func;
    }
    AppDispatcher.register(function(payload) {
        let action = payload.action;
        let func = dataUpdateFunc[action.actionType];
        if (func) {
            tableStore.emitChange(func.apply(this, action.params));
        }
    });
};

export { storeFac };
