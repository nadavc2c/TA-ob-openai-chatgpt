import Dialog from "app/components/modal/Dialog";
export default Dialog.extend({
    initialize: function() {
        Dialog.prototype.initialize.apply(this, arguments);
    },
    parseOptions: function(options) {
        this._btnYesText = options.btnYesText || this._btnYesText || "OK";
        this._className = options.className || "alert-modal";
        return Dialog.prototype.parseOptions.call(this, options);
    },
    render: function() {
        Dialog.prototype.render.apply(this, arguments);
        this._$dialog.addClass(this._className);
        this.$(".ta-btn-no").hide();
    },
    // overwrite some empty functions. Since we have no buttons here.
    onNoClick: function(e) {
        e.preventDefault();
        this._$dialog.modal("hide");
    },
    disableNoBtn: function() {
        return this;
    },
    enableNoBtn: function() {
        return this;
    }
});
