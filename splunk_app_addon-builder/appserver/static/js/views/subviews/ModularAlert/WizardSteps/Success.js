import _ from "lodash";
import Backbone from "backbone";
import * as MessageUtil from "app/utils/MessageUtil";
import SuccessTemplate
    from "contrib/text!app/views/subviews/ModularAlert/WizardSteps/Success.html";

export default Backbone.View.extend({
    className: "success_view",
    initialize: function(options) {
        Backbone.View.prototype.initialize.apply(this, arguments);
        this.model = options.model;
        this.collection = options.collection;
        this.controller = options.controller;
    },
    render: function() {
        this.$el.html(
            _.template(SuccessTemplate)({
                resultTitle: MessageUtil.getFormattedMessage(12000),
                lineText: MessageUtil.getFormattedMessage(12003)
            })
        );
        this.controller.showNavBar();
        var obj = {
            "Alert Name": this.model.get("short_name"),
            "Alert Type": this.model.get("active_response") ? "ARF" : "Normal"
        };

        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                this.$(".meta_data").append(
                    _.template(
                        '<div><div class="name"><%- key %>: </div><div class="value"> <%- value %></div></div>'
                    )({
                        key: key,
                        value: obj[key]
                    })
                );
            }
        }

        this.$(".options").append(
            _.template(
                '<a class="leftLink"><div class="left_option_logo ta-logo-modular-alert"></div><div class="left_option_text"><%- text %></div></a>'
            )({
                text: MessageUtil.getFormattedMessage(12004)
            })
        );

        this.$(".options").append(
            _.template(
                '<a class="rightLink"><div class="right_option_logo ta-logo-download"></div><div class="right_option_text"><%- text %></div></a>'
            )({
                text: MessageUtil.getFormattedMessage(12005)
            })
        );

        var that = this;
        this.$(".options .leftLink").click(function() {
            that.collection.fetch(); // update the models
            that.controller.navigate({
                view: "modular-alert",
                action: "add",
                params: {
                    collection: that.collection
                }
            });
        });

        this.$(".options .rightLink").click(function(e) {
            e.preventDefault();
            that.controller.navigate({
                view: "validation",
                refreshNav: true
            });
        });

        return this;
    }
});
