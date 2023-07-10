import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import { SplunkDUtils } from "swc-aob/index";

export default Backbone.Model.extend({
    url: "search/jobs",
    initialize: function(options) {
        Backbone.Model.prototype.initialize.apply(this, arguments);
        options = options || {};
        this._interval = options.interval || 200;
        this._intervalID = null;
        this._requestList = [];
        this.set("eventCount", 0);
    },
    /**
     * @param {String} sid - Search job id
     * @return {jQuery.Deferred} deferred
     */
    startSearch: function(sid, limit) {
        this.set("sid", sid);
        var deferred = $.Deferred();
        this.clearRequests();
        this._intervalID = window.setInterval(
            _.bind(function() {
                var url =
                    SplunkDUtils.fullpath(this.url + "/" + sid) +
                    "?output_mode=json";
                var request = $.getJSON(url);
                this._requestList.push(request);
                request.done(
                    _.bind(function(respond) {
                        if (respond.entry[0].content.isDone) {
                            this.clearRequests();
                            // Splunk only allow user to get at most 1000 events by this REST.
                            var eventCount =
                                respond.entry[0].content.eventCount;
                            this.set("eventCount", eventCount);
                            this.getEvents(0, limit, deferred);
                        }
                    }, this)
                );
            }, this),
            this._interval
        );
        return deferred;
    },
    clearRequests: function() {
        if (this._intervalID) {
            window.clearInterval(this._intervalID);
        }
        _.each(this._requestList, function(request) {
            if (request.state() === "pending") {
                request.abort();
            }
        });
        this._requestList = [];
    },
    getEvents: function(offset, limit, deferred) {
        var sid = this.get("sid");
        offset = offset || 0;
        limit = limit == null ? 30 : limit;
        deferred = deferred || $.Deferred();
        var url =
            SplunkDUtils.fullpath(this.url + "/" + sid + "/events") +
            "?output_mode=json&offset=" +
            offset +
            "&count=" +
            limit;
        var request = $.getJSON(url);
        this._requestList.push(request);
        request.done(function(respond) {
            deferred.resolve(respond);
        });
        return deferred;
    }
});
