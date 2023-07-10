import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import EventCellTemplate from "contrib/text!./EventCell.html";

const REGEX_FIVE_LINES = /\n.+?\n.+?\n.+?\n.+?\n/m;

function getLineCount(text) {
    var count = 0;
    for (var i = 0; i < text.length; ++i) {
        if (text[i] === "\n") {
            count++;
        }
    }
    return count;
}

export default BaseView.extend({
    template: EventCellTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.state = "collapsed";
        this.linecount = getLineCount(this.options.content);
        this.isTextLong = +this.linecount > 5;
    },
    events: {
        "click a.collapse": "onStateControlClick"
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        var event = this.options.content;
        if (this.isTextLong && this.state === "collapsed") {
            var match = REGEX_FIVE_LINES.exec(event);
            event = event.slice(0, match.index + match[0].length);
            this.renderStateController();
        }
        this.renderEvent(event);
        return this;
    },
    renderEvent: function(event) {
        this.$(".event-content").text(event);
    },
    renderStateController: function() {
        var aTag = $('<a class="collapse"></a>');
        if (this.state === "collapsed") {
            aTag.html(_.t("Show all ") + this.linecount + _.t(" lines"));
        } else if (this.state === "expanded") {
            aTag.html(_.t("Collapse"));
        }
        this.$(".controller-group").append(aTag);
    },
    onStateControlClick: function() {
        var aTag = this.$(".controller-group a.collapse");
        if (this.state === "collapsed") {
            this.state = "expanded";
            aTag.html(_.t("Collapse"));
        } else if (this.state === "expanded") {
            this.state = "collapsed";
            aTag.html(_.t("Show all ") + this.linecount + _.t(" lines"));
        }
        var event = this.options.content;
        if (this.state === "collapsed") {
            var match = REGEX_FIVE_LINES.exec(event);
            event = event.slice(0, match.index + match[0].length);
        }
        this.renderEvent(event);
    }
});
