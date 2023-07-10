import { combineReducers } from "redux-immutable";
import { createStore, applyMiddleware } from "redux";
import { createEpicMiddleware } from "redux-observable";
import Immutable from "immutable";
import { composeWithDevTools } from "redux-devtools-extension/developmentOnly";
import epic from "app/redux/epics/sourcetype";
import reducers from "app/redux/reducers/sourcetype";

const epicMiddleware = createEpicMiddleware(epic);
const initialState = Immutable.Map();
const store = createStore(
    combineReducers(reducers),
    initialState,
    composeWithDevTools(applyMiddleware(epicMiddleware))
);
export default store;
