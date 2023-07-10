import $ from "jquery";
import _ from "lodash";
import BaseView from "app/components/BaseView";
import RawEventCellTemplate from "contrib/text!./RawEventCell.html";

const REGEX_FIVE_LINES = /\n.*?\n.*?\n.*?\n.*?\n/m;

export default BaseView.extend({
    className: "raw-event",
    template: RawEventCellTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.state = "collapsed";
        this.isTextLong = +this.model.get("linecount") > 5;
    },
    events: {
        "click a.collapse": "onStateControlClick"
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        var model = this.model;
        var event = model.get("_raw");
        if (this.isTextLong && this.state === "collapsed") {
            var match = REGEX_FIVE_LINES.exec(event);
            if (match != null) {
                event = event.slice(0, match.index + match[0].length);
            }
            this.renderStateController();
        }
        this.renderEvent(event);
        return this;
    },
    renderEvent: function(event) {
        var model = this.model;
        var timestartpos = model.get("timestartpos");
        var timeendpos = model.get("timeendpos");
        var content = "";
        if (timestartpos && timeendpos) {
            content += _.escape(event.slice(0, timestartpos));
            content +=
                '<span class="time">' +
                _.escape(event.slice(timestartpos, timeendpos)) +
                "</span>";
            content += _.escape(event.slice(timeendpos));
        } else {
            content += _.escape(event);
        }
        this.$(".event-content").html(content);
    },
    renderStateController: function() {
        var aTag = $('<a class="collapse"></a>');
        if (this.state === "collapsed") {
            aTag.html(
                _.t("Show all ") + this.model.get("linecount") + _.t(" lines")
            );
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
            aTag.html(
                _.t("Show all ") + this.model.get("linecount") + _.t(" lines")
            );
        }
        var event = this.model.get("_raw");
        if (this.state === "collapsed") {
            var match = REGEX_FIVE_LINES.exec(event);
            event = event.slice(0, match.index + match[0].length);
        }
        this.renderEvent(event);
    }
});
