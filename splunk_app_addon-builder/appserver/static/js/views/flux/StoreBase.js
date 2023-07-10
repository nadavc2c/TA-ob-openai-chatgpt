import { EventEmitter } from "events";
class storeBase extends EventEmitter {
    constructor() {
        super();
        this.components = {};
    }

    emitChange(value) {
        this.emit("change", value);
    }

    addChangeListener(callback) {
        this.on("change", callback);
    }

    // Remove change listener
    removeChangeListener(callback) {
        this.removeListener("change", callback);
    }
}

export default storeBase;
