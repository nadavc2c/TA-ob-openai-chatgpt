import _ from "lodash";
import "bootstrap";
import BaseView from "app/components/BaseView";
import { getFormattedMessage } from "app/utils/MessageUtil";
import Template from "contrib/text!./TableContent.html";

function isValidMatch(m, cursor) {
    var isValid =
        m &&
        m.pair &&
        m.pair.pos &&
        m.key &&
        m.key.pos &&
        m.value &&
        m.value.pos;
    if (!isValid) {
        return false;
    }
    var start = m.pair.pos[0];
    var end = m.pair.pos[1];
    if (start >= end || start < 0 || end < 0 || start < cursor) {
        return false;
    }
    //TODO: validate more fields in match obj
    return true;
}

function findNextValidMatch(matches, i, cursor) {
    for (var j = i + 1; j < matches.length; ++j) {
        if (isValidMatch(matches[j], cursor)) {
            return j;
        }
    }
    return -1;
}

/**
@param matches should be ordered. For nested pair, the outer pair stay before the innner pair
In KV format, nested should only happens in key or value
do not handle the case which nested match across key and value
*/
function findNestedMatches(matches, i, lowerBound, higherBound) {
    var ret = [];
    var nestFound = true, j = i;
    while (nestFound) {
        var k = findNextValidMatch(matches, j, lowerBound);
        var pairPos = k > 0 ? matches[k].pair.pos : null;
        if (k > 0 && pairPos[0] >= lowerBound && pairPos[1] <= higherBound) {
            ret.push(matches[k]);
            j = k;
        } else {
            nestFound = false;
        }
    }
    return ret;
}

function wrapKey(key) {
    return '<span class="key">' + key + "</span>";
}

function wrapValue(value) {
    return '<span class="value">' + value + "</span>";
}

function wrapPair(match, pair) {
    if (match.warning) {
        var warning = match.warning;
        var id = _.uniqueId("icon-warning");
        var iconWarning =
            '<i class="icon icon-question-circle" data-id="' + id + '"></i>';
        this.warningIcons[id] = getFormattedMessage(
            warning.err_code,
            warning.err_args
        );
        return iconWarning + '<span class="pair">' + pair + "</span>";
    }
    return '<span class="pair">' + pair + "</span>";
}

/**
@param matches should be a ordered list. from the small index to large index.
handle the nested match recursively
*/
function composeEventContent(text, matches, startPos, endPos) {
    var ret = "";
    var cursor = startPos;
    for (var i = 0, iLen = matches.length; i < iLen; ++i) {
        var currentMatch = matches[i];
        if (!isValidMatch(currentMatch, cursor)) {
            continue;
        }
        var isKeyDuplicated = currentMatch.key.is_duplicated;
        var start = currentMatch.pair.pos[0];
        var end = currentMatch.pair.pos[1];

        ret += _.escape(text.substring(cursor, start));
        var renderedPair = "";
        // handle key part
        var keyStart = currentMatch.key.pos[0];
        var keyEnd = currentMatch.key.pos[1];
        renderedPair += _.escape(text.substring(start, keyStart));
        var nestedMatchInKey = findNestedMatches(matches, i, keyStart, keyEnd);
        var renderedKey = "";
        if (nestedMatchInKey.length > 0) {
            renderedKey = composeEventContent(
                text,
                nestedMatchInKey,
                keyStart,
                keyEnd
            );
        } else {
            renderedKey = _.escape(text.substring(keyStart, keyEnd));
        }
        if (isKeyDuplicated) {
            renderedPair += renderedKey;
        } else {
            renderedPair += wrapKey(renderedKey);
        }

        var valueStart = currentMatch.value.pos[0];
        var valueEnd = currentMatch.value.pos[1];
        // render the kv delimers
        renderedPair += _.escape(text.substring(keyEnd, valueStart));
        // render the value part
        var nestedMatchInValue = findNestedMatches(
            matches,
            i,
            valueStart,
            valueEnd
        );
        var renderedValue = "";
        if (nestedMatchInValue.length > 0) {
            renderedValue = composeEventContent(
                text,
                nestedMatchInValue,
                valueStart,
                valueEnd
            );
        } else {
            renderedValue = _.escape(text.substring(valueStart, valueEnd));
        }
        if (isKeyDuplicated) {
            renderedPair += renderedValue;
        } else {
            renderedPair += wrapValue(renderedValue);
        }
        // handle the tail
        renderedPair += _.escape(text.substring(valueEnd, end));
        // handle the pair
        ret += wrapPair.call(this, currentMatch, renderedPair);
        // update the cursor. if nested exists, the cursor will skip the nested ones
        cursor = end;
    }
    if (cursor < endPos) {
        ret += _.escape(text.substring(cursor, endPos));
    }
    return ret;
}

function getIconByRatio(ratio) {
    var icon;
    if (ratio >= 1) {
        icon = "icon-check-circle";
    } else if (ratio <= 0) {
        icon = "icon-x-circle";
    } else {
        icon = "icon-alert";
    }
    return icon;
}

export default BaseView.extend({
    tagName: "table",
    initialize: function(options) {
        BaseView.prototype.initialize.apply(this, arguments);
        options.silent = true;
        this.update(options);
    },

    render: function() {
        this.renderEvents();
        return this;
    },
    update: function(options) {
        if (options.eventContents != null) {
            this._eventContents = options.eventContents;
        }
        if (options.offset != null) {
            this._offset = options.offset;
        }
        if (options.limit != null) {
            this._limit = options.limit;
        }
        if (options.total != null) {
            this._total = options.total;
        }
        if (!options.silent) {
            return this.renderEvents();
        }
        return this;
    },
    setOffset: function(offset) {
        return this.update({
            offset: offset
        });
    },
    renderEvents: function() {
        this.clearWarningTooltips();
        var events = this._eventContents.slice(
            this._offset,
            this._offset + this._limit
        );
        var offset = this._offset;
        events = _(events)
            .map((event, index) => {
                return {
                    content: this._generateEventContent(event),
                    index: index + offset + 1,
                    icon: getIconByRatio(event.ratio)
                };
            })
            .value();
        this.$el.html(
            this.compiledTemplate({
                events: events
            })
        );
        this.addWarningTooltips();
    },
    clearWarningTooltips: function() {
        this.$(".icon-question-circle").tooltip("destroy");
        this.warningIcons = {};
    },
    addWarningTooltips: function() {
        var that = this;
        _.each(this.warningIcons, function(message, id) {
            that.$('.icon-question-circle[data-id="' + id + '"]').tooltip({
                placement: "top",
                trigger: "hover",
                animation: false,
                title: message,
                container: "body"
            });
        });
    },
    _generateEventContent: function(event) {
        var matches = event.matches;
        var rawEvent = event.event;
        if (!matches) {
            return _.escape(rawEvent);
        }
        return composeEventContent.call(
            this,
            rawEvent,
            matches,
            0,
            rawEvent.length
        );
    },
    template: Template
});
