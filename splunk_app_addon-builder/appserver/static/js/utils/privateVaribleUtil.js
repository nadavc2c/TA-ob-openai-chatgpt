let privateVarMap = new WeakMap();

const internal = function(instance, init = {}) {
    if (!privateVarMap.has(instance)) {
        privateVarMap.set(instance, init);
    }
    return privateVarMap.get(instance);
};

export { internal };
