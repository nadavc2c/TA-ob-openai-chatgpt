import { getFormattedMessage } from "app/utils/MessageUtil";
import Homepage
    from "app/views/subviews/Home/components/homePageComponents.jsx";
import ReactDOM from "react-dom";
import WarningView from "app/views/common/WarningView";
import Apps from "app/collections/home/Apps";
import BaseSubView from "app/views/subviews/BaseSubView";
import React from "react";
import Collector from "app/profiles/partyjsCollector";

// define a test content view
var ContentView = BaseSubView.extend({
    className: "ta-sub-view ta-home-page",
    initialize: function() {
        // BaseSubView.prototype.initialize.apply(this, arguments);
        this._apps = new Apps();
    },
    render: function() {
        this.$el.empty();

        this._apps.fetch({
            success: () => {
            var errCode = null;
            var results = this._apps.toJSON();
            for (var i = 0; i < results.length; i++) {
                if (results[i].err_code) {
                    errCode = results[i].err_code;
                    break;
                }
            }
            if (errCode) {
                var warning = new WarningView({
                    content: getFormattedMessage(errCode)
                });
                this.$(".homeContainer").append(warning.render().$el);
            } else {
                let collectedData = results
                    .filter(app => app.create_by_builder)
                    .map(app => {
                        return {
                            author: app.author,
                            id: app.id,
                            last_modified: app.last_modified,
                            name: app.name,
                            version: app.version,
                            visible: app.visible
                        };
                    });
                Collector.collect("track_addon_builder_summary", collectedData);
                ReactDOM.render(<Homepage data={ results } />, this.$el[0]);
            }
        }
        });
        return this;
    }
});

export default ContentView;
