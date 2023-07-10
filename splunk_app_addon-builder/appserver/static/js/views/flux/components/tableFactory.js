import { wrapperFactory } from "app/views/flux/wrapperFactory";
import tabMemory from "app/views/flux/components/Memory";
import tableStoreAction from "app/views/flux/components/tableStoreAction";

let tableFac = function() {
    const storeAction = new tableStoreAction(new tabMemory());
    let { Actions: tableActions, Wrapper: TableDataProvider } = wrapperFactory(
        storeAction
    ); // connector
    return {
        TableDataProvider: TableDataProvider,
        Props: {
            actions: tableActions,
            getData: storeAction.getProps
        }
    };
};

export { tableFac };
