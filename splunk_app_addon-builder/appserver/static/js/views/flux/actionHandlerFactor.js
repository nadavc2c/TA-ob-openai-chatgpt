import AppDispatcher from "app/views/flux/dispatcher/AppDispatcher";

/*
 {
  @eventName : String
  @functionName : String,
  @params : ArrayOfString
}
*/

let actionFac = function(arr) {
    let Actions = {};
    for (let action of arr) {
        Actions[action.functionName] = function(...args) {
            let passIn = {
                actionType: action.eventName,
                params: args
            };
            AppDispatcher.handleAction(passIn);
        };
    }

    return Actions;
};

export { actionFac };
