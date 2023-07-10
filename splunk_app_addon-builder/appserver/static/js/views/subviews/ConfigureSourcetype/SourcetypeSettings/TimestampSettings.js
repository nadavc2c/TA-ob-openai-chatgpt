import _ from "lodash";
import BaseView from "app/components/BaseView";
import RadioButtonGroupControl
    from "app/components/controls/RadioButtonGroupControl";
import ControlGroupView from "app/components/ControlGroupView";
import { TextControl } from "swc-aob/index";
import SingleInputControl from "app/components/controls/SingleInputControl";
import HelpBlock from "app/components/controls/HelpBlock";
import * as HelpLinkUtil from "app/utils/HelpLinkUtil";
import CoreTimestampTemplate
    from "contrib/text!./Timestamp.html";
import TimestampTemplate from "contrib/text!./TimestampSettings.html";

//Get timezone list from splunk core template
let TZ_LIST;

const LABEL_WIDTH = 110;

export default BaseView.extend({
    template: TimestampTemplate,
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        if (!TZ_LIST) {
            TZ_LIST = (function(template) {
                var list = [];
                var regex = /<option value=\"([^\"]*)\">(.*?)<\/option>/g;
                var result = regex.exec(template);
                while (result) {
                    list.push({
                        value: result[1] || "auto",
                        label: result[2]
                    });
                    result = regex.exec(template);
                }
                return list;
            })(CoreTimestampTemplate);
        }
    },
    render: function() {
        this.$el.html(this.compiledTemplate({}));
        this.children.timeExtraction = new ControlGroupView({
            label: _.t("Extraction"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new RadioButtonGroupControl({
                    model: this.model,
                    modelAttribute: "timeExtraction",
                    items: [
                        {
                            value: "auto",
                            label: _.t("Auto")
                        },
                        {
                            value: "current",
                            label: _.t("Current Time")
                        },
                        {
                            value: "advanced",
                            label: _.t("Advanced...")
                        }
                    ]
                })
            ]
        });
        this.children.timezone = new ControlGroupView({
            label: _.t("Timezone"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new SingleInputControl({
                    model: this.model,
                    modelAttribute: "timezone",
                    autoCompleteFields: TZ_LIST,
                    filter: true
                })
            ]
        });
        this.children.timeFormat = new ControlGroupView({
            label: _.t("Timestamp Format"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new TextControl({
                    model: this.model,
                    modelAttribute: "timeFormat"
                }),
                new HelpBlock({
                    description: _.t(
                        "A string in strptime() format that helps Splunk recognize timestamps."
                    ),
                    url: HelpLinkUtil.makeHelpUrl("timeformat.preview", true)
                })
            ]
        });
        this.children.timePrefix = new ControlGroupView({
            label: _.t("Timestamp Prefix"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new TextControl({
                    model: this.model,
                    modelAttribute: "timePrefix"
                }),
                new HelpBlock({
                    description: _.t(
                        "Timestamp is always prefaced by a regex pattern eg: \\d+abc123\\d[2,4]."
                    )
                })
            ]
        });
        this.children.lookahead = new ControlGroupView({
            label: _.t("Lookahead"),
            labelWidth: LABEL_WIDTH,
            controls: [
                new TextControl({
                    model: this.model,
                    modelAttribute: "lookahead"
                }),
                new HelpBlock({
                    description: _.t(
                        "Timestamp never extends more than this number of characters into the event, or past the Regex if specified above."
                    )
                })
            ]
        });
        this.$(".form").append(this.children.timeExtraction.render().$el);
        this.$(".form-indent-section").append(
            this.children.timezone.render().$el
        );
        this.$(".form-indent-section").append(
            this.children.timeFormat.render().$el
        );
        this.$(".form-indent-section").append(
            this.children.timePrefix.render().$el
        );
        this.$(".form-indent-section").append(
            this.children.lookahead.render().$el
        );

        if (this.model.get("timeExtraction") === "advanced") {
            this.showIndentSection();
        }
        this.listenTo(
            this.model,
            "change:timeExtraction",
            this.onEventBreakChange
        );

        return this;
    },
    onEventBreakChange: function() {
        switch (this.model.get("timeExtraction")) {
            case "auto":
                this.hideIndentSection();
                break;
            case "current":
                this.hideIndentSection();
                break;
            case "advanced":
                this.showIndentSection();
                break;
        }
    },
    showIndentSection: function() {
        this.$(".form-indent-section").show();
    },
    hideIndentSection: function() {
        this.$(".form-indent-section").hide();
    }
});
