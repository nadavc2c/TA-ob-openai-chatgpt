import $ from "jquery";

const isChecked = function($el) {
    return !!$el.attr("checked");
};

const check = function($el, silent) {
    if ($el.hasClass("disabled")) {
        return;
    }
    if (isChecked($el)) {
        return;
    }
    $el.attr("checked", "checked");
    $el.find("i.icon-check").removeAttr("style");
    if (!silent) {
        $el.trigger("change", {
            checked: true
        });
    }
};

const uncheck = function($el, silent) {
    if ($el.hasClass("disabled")) {
        return;
    }
    if (!isChecked($el)) {
        return;
    }
    $el.removeAttr("checked");
    $el.find("i.icon-check").attr("style", "display:none;");
    if (!silent) {
        $el.trigger("change", {
            checked: false
        });
    }
};

const eventHandler = function(e) {
    e.preventDefault();
    e.stopPropagation();
    var $el = $(e.currentTarget);
    if (isChecked($el)) {
        uncheck($el);
    } else {
        check($el);
    }
};

export { isChecked, check, uncheck, eventHandler };
