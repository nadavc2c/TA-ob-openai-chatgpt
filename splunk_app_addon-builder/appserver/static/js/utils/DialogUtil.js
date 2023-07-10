import Dialog from "app/components/modal/Dialog";
import Alert from "app/components/modal/AlertDialog";

const showDialog = function(options) {
    var dialogClass;
    options = options || {};
    switch (options.type) {
        case "alert":
            dialogClass = Alert;
            break;
        default:
            dialogClass = Dialog;
    }
    var dialog = new dialogClass(options);
    dialog.showModal(options);
};

export { showDialog };
