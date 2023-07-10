import _ from "lodash";
import { Control } from "swc-aob/index";
import { getColorGroupIndex } from "app/utils/ColorsUtil";
import { matchRegex } from "app/utils/RegexUtil";

function parseResult(result) {
    if (result.length <= 1) {
        return false;
    }
    result = result.slice(1);
    var indexes = _(result)
        .map(function(group, i) {
            if (group) {
                return {
                    refSpan: group.index,
                    colorGroupIndex: getColorGroupIndex(i),
                    groupIndex: i
                };
            } else {
                return null;
            }
        })
        .value();
    return indexes;
}

function isValidIndex(index) {
    if (!index) {
        return false;
    }
    var start = index.refSpan[0];
    var end = index.refSpan[1];
    if (start === end || start < 0 || end < 0) {
        return false;
    }
    return true;
}

function findNextValidIndex(indexes, i) {
    for (var j = i + 1; j < indexes.length; ++j) {
        if (isValidIndex(indexes[j])) {
            return j;
        }
    }
    return -1;
}

function findNestedIndexes(indexes, i) {
    var ret = [];
    var bound = indexes[i].refSpan[1];
    for (var j = i + 1; j < indexes.length; ++j) {
        if (!indexes[j] || indexes[j].refSpan[1] <= bound) {
            ret.push(indexes[j]);
        }
    }
    return ret;
}

function generateColorfulEvent(startPos, endPos, text, indexes) {
    var ret = "";
    var cursor = startPos;
    for (var i = 0, ilen = indexes.length; i < ilen; ++i) {
        var currentIndex = indexes[i];
        if (!isValidIndex(currentIndex)) {
            continue;
        }
        var start = currentIndex.refSpan[0];
        var end = currentIndex.refSpan[1];
        ret += _.escape(text.substring(cursor, start));
        var nextIndex = indexes[findNextValidIndex(indexes, i)];
        var tempText;
        if (nextIndex && nextIndex.refSpan[1] <= end) {
            var nestedIndexes = findNestedIndexes(indexes, i);
            tempText = generateColorfulEvent(start, end, text, nestedIndexes);
            i += nestedIndexes.length;
        } else {
            tempText = _.escape(text.substring(start, end));
        }
        ret +=
            "<span class='ta-group-item ta-color-group-" +
            currentIndex.colorGroupIndex +
            "'  data-group-index='" +
            currentIndex.groupIndex +
            "'>" +
            tempText +
            "</span>";
        cursor = end;
    }
    if (cursor < endPos) {
        ret += _.escape(text.substring(cursor, endPos));
    }
    return ret;
}

export default Control.extend({
    initialize: function(options) {
        Control.prototype.initialize.apply(this, arguments);
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
        if (options.regex != null) {
            this._regex = options.regex;
            this._noEffectList = [];
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
    events: {},
    renderEvents: function() {
        var that = this;
        var events = this._eventContents.slice(
            this._offset,
            this._offset + this._limit
        );
        events = _(events)
            .map(event => {
                var result = this.getMatchResult(event);
                return {
                    content: result
                        ? this.getColorfulEvent(event, result)
                        : _.escape(event),
                    icon: result ? "icon-check-circle" : "icon-x-circle"
                };
            })
            .value();
        this.$el.html(
            this.compiledTemplate({
                events: events
            })
        );
        _(this._noEffectList).each(function(groupIndex) {
            that._highlightField(groupIndex, false);
        });
    },
    getMatchResult: function(event) {
        return matchRegex(event, this._regex, true);
    },
    getColorfulEvent: function(event, result) {
        var indexes = parseResult(result);
        if (!indexes) {
            return _.escape(event);
        }
        return generateColorfulEvent(0, event.length, event, indexes);
    },
    highlightField: function(groupIndex, isHighlight) {
        if (isHighlight) {
            this._noEffectList = _.without(this._noEffectList, groupIndex);
        } else {
            this._noEffectList.push(groupIndex);
        }
        this._highlightField(groupIndex, isHighlight);
    },
    _highlightField: function(groupIndex, isHighlight) {
        if (isHighlight) {
            this.$("span[data-group-index=" + groupIndex + "]").removeClass(
                "no-effect"
            );
        } else {
            this.$("span[data-group-index=" + groupIndex + "]").addClass(
                "no-effect"
            );
        }
    },
    template: [
        "<table>",
        "<% _(events).each(function(event){ %>",
        "<tr>",
        "<td>",
        "<i class='icon <%- event.icon %>'></i>",
        "</td>",
        "<td>",
        "<span class='event-content'><%= event.content %></span>",
        "</td>",
        "</tr>",
        "<% }) %>",
        "</table>"
    ].join("")
});
