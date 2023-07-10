import $ from "jquery";
import _ from "lodash";
import "bootstrap";
import EditInputTemplate from "contrib/text!./EditablePopover.html";

const ATTRIBUTE_CANDIDATES = [
    "name",
    "value",
    "type",
    "title",
    "unit",
    "errormessage",
    "config"
];

let GLOBAL_LISTENER = false;

let popoverList = [];

function _hideAll(except) {
    _.each(_.difference(popoverList, [except]), function(dom) {
        $(dom).popover("hide").data("popoverVisible", false);
    });
}

function addGlobalListener() {
    document.addEventListener("click", function() {
        _hideAll();
    });
}

function getTemplate(type) {
    let template;
    switch (type) {
        case "input":
            template = EditInputTemplate;
            break;
        default:
            template = EditInputTemplate;
    }
    return template;
}

function getAttributesFromDOM(dom, attrs) {
    let $el = $(dom);
    let ret = {};
    attrs = attrs || ATTRIBUTE_CANDIDATES;
    _.each(attrs, function(attr) {
        let val = $el.data(attr);
        if (val != null) {
            ret[attr] = val;
        }
    });
    return ret;
}

function generateTitle(name, unit) {
    let title = "";
    title += "Enter new value of ";
    title += name;
    if (unit) {
        title += " in ";
        title += unit;
        title += "(s).";
    } else {
        title += ".";
    }
    return title;
}

function insertErrorMessage(message) {
    let $content = $(".popover-edit .popover-content");
    if (!$content.find(".error-message").length) {
        // let oHeight = $content.height();

        let $error = $("<p class='error-message'>" + message + "</p>");
        $error.insertBefore($content[0].firstChild);

        // adjust popover's position
        // let dHeight = $content.height() - oHeight;
        // let $popover = $(".popover-edit");
        // let oTop = parseFloat($popover.css("top"));
        // $popover.css("top", (oTop - dHeight) + "px");
    }
}

function onConfirmHandler($el, args, attrs) {
    let val = $(".popover-edit .input-edit").val();
    let confirmed = true;
    if (_.isFunction(args.onConfirming)) {
        confirmed = args.onConfirming.call(args.scope, $el, val, attrs);
    }
    if (confirmed) {
        $el.popover("hide").data("popoverVisible", false);
        if (_.isFunction(args.onConfirmed)) {
            args.onConfirmed.call(args.scope, $el, val);
        }
    } else {
        if (attrs.errormessage) {
            insertErrorMessage(attrs.errormessage);
        }
        $(".popover-edit .input-edit").addClass("shake").focus();
        window.setTimeout(function() {
            $(".popover-edit .input-edit").removeClass("shake");
        }, 500);
    }
}

function onCancelHandler($el, args) {
    $el.popover("hide").data("popoverVisible", false);
    if (_.isFunction(args.onCanceled)) {
        args.onCanceled.call(args.scope, $el);
    }
}

function showPopover($el, event, args, attrs) {
    if ($el.data("popoverVisible")) {
        _hideAll($el[0]);
    } else {
        _hideAll($el[0]);
        $el.popover("show");
        $(".popover-edit .popover-content .error-message").remove();
        $(".popover-edit").off("click").on("click", function(e) {
            e.stopPropagation();
        });
        $(".popover-edit .btn.icon-check").off("click").on("click", function() {
            onConfirmHandler($el, args, attrs);
        });
        $(".popover-edit .btn.icon-close").off("click").on("click", function() {
            onCancelHandler($el, args);
        });
        $(".popover-edit .input-edit")
            .off("keydown")
            .on("keydown", function(e) {
                if (e.keyCode === 13) {
                    //Enter is pressed
                    onConfirmHandler($el, args, attrs);
                    e.preventDefault();
                } else if (e.keyCode === 27) {
                    onCancelHandler($el, args);
                    e.preventDefault();
                }
            });
        $el.data("popoverVisible", true);
    }
    event.stopPropagation();
}

const addPopover = function($el, args) {
    if (!GLOBAL_LISTENER) {
        GLOBAL_LISTENER = true;
        addGlobalListener();
    }
    $el.each(function() {
        popoverList = _.union(popoverList, [this]);
        var attrs = getAttributesFromDOM(this);
        if (!attrs.title) {
            attrs.title = generateTitle(attrs.name, attrs.unit);
        }
        var options = $.extend(true, {}, args, {
            trigger: "manual",
            title: attrs.title,
            template: _.template(getTemplate(attrs.type))({
                config: attrs.config || {}
            })
        });
        $(this)
            .data("popoverVisible", false)
            .popover(options)
            .on("shown.bs.popover", function() {
                $(".popover-edit .input-edit")
                    .val(attrs.value)
                    .focus()
                    .select();
            })
            .on("click", function(e) {
                showPopover($(this), e, args, attrs);
            });
    });
};

const removePopover = function($el) {
    $el.each(function() {
        popoverList = _.difference(popoverList, [this]);
    });
    $el.off("click").popover("destroy");
};

const removeAll = function() {
    _.each(popoverList, function(el) {
        $(el)
            .popover("hide")
            .data("popoverVisible", false)
            .off("click")
            .popover("destroy");
    });
    popoverList = [];
};

const hideAll = function() {
    _hideAll();
};

export { addPopover, removePopover, removeAll, hideAll };
