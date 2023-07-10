import _ from "lodash";
import Backbone from "backbone";
import BaseView from "app/components/BaseView";
import * as MessageUtil from "app/utils/MessageUtil";
import EditableTable from "app/components/tables/editable_table";
import AccordionGroupView from "app/components/AccordionGroupView";
import EventBreakSettingsView from "./EventBreakSettings";
import TimestampSettingsView from "./TimestampSettings";

export default BaseView.extend({
    className: "tbStep-detailed-settings",
    initialize: function() {
        BaseView.prototype.initialize.apply(this, arguments);
        this.settings = this.options.settings || new Backbone.Collection();
        this.reloadSettings();
    },
    reloadSettings() {
        this.model.set({
            eventBreak: "_",
            regex: "",
            timeExtraction: "_",
            timezone: "auto",
            timePrefix: "",
            timeFormat: "",
            lookahead: "128"
        }, {
            silent: true
        });
        this.parseSettings();
    },
    parseSettings: function() {
        var model = this.model;
        var settings = this.settings;
        settings.remove(
            settings.filter(function(setting) {
                var k = setting.get("name") == null
                    ? ""
                    : setting.get("name") + "";
                var v = setting.get("value") == null
                    ? ""
                    : setting.get("value") + "";
                return !k.length || !v.length;
            })
        );
        var item, value;
        item = settings.where({
            name: "SHOULD_LINEMERGE"
        });
        if (item.length) {
            var should;
            value = item[0].get("value");
            try {
                should = JSON.parse(value.toString().toLowerCase());
            } catch (e) {
                should = !!value;
            }
            if (should) {
                item = settings.where({
                    name: "BREAK_ONLY_BEFORE"
                });
                if (item.length) {
                    model.set("eventBreak", "regex");
                    model.set("regex", item[0].get("value"));
                } else {
                    model.set("eventBreak", "auto");
                    model.set("regex", "");
                }
            } else {
                model.set("eventBreak", "everyline");
                model.set("regex", "");
            }
        } else {
            settings.add({
                name: "SHOULD_LINEMERGE",
                value: "1"
            });
            model.set("eventBreak", "auto");
            model.set("regex", "");
        }
        item = settings.where({
            name: "DATETIME_CONFIG"
        });
        if (item.length) {
            value = item[0].get("value");
            if (value && value === "CURRENT") {
                model.set("timeExtraction", "current");
            } else {
                model.set("timeExtraction", "auto");
            }
        } else {
            var totalFind = 0;
            _.each(
                [
                    {
                        collectionName: "TZ",
                        modelName: "timezone"
                    },
                    {
                        collectionName: "TIME_FORMAT",
                        modelName: "timeFormat"
                    },
                    {
                        collectionName: "TIME_PREFIX",
                        modelName: "timePrefix"
                    },
                    {
                        collectionName: "MAX_TIMESTAMP_LOOKAHEAD",
                        modelName: "lookahead"
                    }
                ],
                function(element) {
                    item = settings.where({
                        name: element.collectionName
                    });
                    if (item.length) {
                        model.set(element.modelName, item[0].get("value"));
                    }
                    totalFind += item.length;
                }
            );
            if (totalFind) {
                model.set("timeExtraction", "advanced");
            } else {
                model.set("timeExtraction", "auto");
            }
        }
    },
    render: function() {
        this.children.groupEventBreak = new AccordionGroupView({
            title: _.t("Event Breaks"),
            contentView: new EventBreakSettingsView({
                model: this.model
            })
        });
        this.children.groupTimestamp = new AccordionGroupView({
            title: _.t("Timestamp"),
            contentView: new TimestampSettingsView({
                model: this.model
            })
        });
        this.children.groupAdvanced = new AccordionGroupView({
            title: _.t("Advanced"),
            contentView: new EditableTable({
                collection: this.settings,
                columnNames: new Backbone.Collection([
                    {
                        name: "name",
                        label: _.t("Name")
                    },
                    {
                        name: "value",
                        label: _.t("Value")
                    }
                ])
            })
        });

        this.$el.append(this.children.groupEventBreak.render().$el);
        this.$el.append(this.children.groupTimestamp.render().$el);
        this.$el.append(this.children.groupAdvanced.render().$el);
        this.listenTo(this.model, "change:eventBreak", this.onEventBreakChange);
        this.listenTo(this.model, "change:regex", this.handleEventBreakRegex);
        this.listenTo(
            this.model,
            "change:timeExtraction",
            this.onTimeExtractionChange
        );
        this.listenTo(
            this.model,
            "change:timezone",
            this.handleTimeExtractionAdvanced
        );
        this.listenTo(
            this.model,
            "change:timeFormat",
            this.handleTimeExtractionAdvanced
        );
        this.listenTo(
            this.model,
            "change:timePrefix",
            this.handleTimeExtractionAdvanced
        );
        this.listenTo(
            this.model,
            "change:lookahead",
            this.handleTimeExtractionAdvanced
        );
        return this;
    },
    onEventBreakChange: function() {
        switch (this.model.get("eventBreak")) {
            case "auto":
                this.handleEventBreakAuto();
                break;
            case "everyline":
                this.handleEventBreakEveryLine();
                break;
            case "regex":
                this.handleEventBreakRegex();
                break;
        }
    },
    onTimeExtractionChange: function() {
        switch (this.model.get("timeExtraction")) {
            case "auto":
                this.handleTimeExtractionAuto();
                break;
            case "current":
                this.handleTimeExtractionCurrent();
                break;
            case "advanced":
                this.handleTimeExtractionAdvanced();
                break;
        }
    },
    _addOrSetSetting: function(name, value) {
        var settings = this.settings;
        var item = settings.where({
            name: name
        });
        if (item.length) {
            item[0].set("value", value);
        } else {
            settings.add(
                new Backbone.Model({
                    name: name,
                    value: value
                })
            );
        }
    },
    _removeSettings: function(names) {
        var settings = this.settings;
        if (!_.isArray(names)) {
            names = [names];
        }
        _.each(names, function(name) {
            var item = settings.where({
                name: name
            });
            if (item.length) {
                settings.remove(item[0]);
            }
        });
    },
    handleEventBreakAuto: function() {
        this._addOrSetSetting("SHOULD_LINEMERGE", "1");
        this._removeSettings("BREAK_ONLY_BEFORE");
    },
    handleEventBreakEveryLine: function() {
        this._addOrSetSetting("SHOULD_LINEMERGE", "0");
        this._removeSettings("BREAK_ONLY_BEFORE");
    },
    handleEventBreakRegex: function() {
        this._addOrSetSetting("SHOULD_LINEMERGE", "1");
        var regex = this.model.get("regex");
        if (regex.length) {
            this._addOrSetSetting("BREAK_ONLY_BEFORE", regex);
        } else {
            this._removeSettings("BREAK_ONLY_BEFORE");
        }
    },
    handleTimeExtractionAuto: function() {
        this._removeSettings([
            "DATETIME_CONFIG",
            "TZ",
            "TIME_FORMAT",
            "TIME_PREFIX",
            "MAX_TIMESTAMP_LOOKAHEAD"
        ]);
    },
    handleTimeExtractionCurrent: function() {
        this._addOrSetSetting("DATETIME_CONFIG", "CURRENT");
        this._removeSettings([
            "TZ",
            "TIME_FORMAT",
            "TIME_PREFIX",
            "MAX_TIMESTAMP_LOOKAHEAD"
        ]);
    },
    handleTimeExtractionAdvanced: function() {
        this._removeSettings("DATETIME_CONFIG");
        let model = this.model;
        let item = model.get("timezone");
        if (item !== "auto") {
            this._addOrSetSetting("TZ", item);
        } else {
            this._removeSettings("TZ");
        }
        item = model.get("timeFormat");
        if (item.length) {
            this._addOrSetSetting("TIME_FORMAT", item);
        } else {
            this._removeSettings("TIME_FORMAT");
        }
        item = model.get("timePrefix");
        if (item.length) {
            this._addOrSetSetting("TIME_PREFIX", item);
        } else {
            this._removeSettings("TIME_PREFIX");
        }
        item = model.get("lookahead");
        if (item !== "128") {
            this._addOrSetSetting("MAX_TIMESTAMP_LOOKAHEAD", item);
        } else {
            this._removeSettings("MAX_TIMESTAMP_LOOKAHEAD");
        }
    },

    validateSettings: function() {
        var settingNames = {};
        var settings = this.settings;
        for (var i = 0, length = settings.length; i < length; i++) {
            var setting = settings.at(i);
            var k = setting.get("name") == null ? "" : setting.get("name") + "";
            var v = setting.get("value") == null
                ? ""
                : setting.get("value") + "";
            if (!k.length) {
                return MessageUtil.getFormattedMessage(8007);
            }
            if (!v.length) {
                return MessageUtil.getFormattedMessage(8008);
            }
            if (settingNames[k]) {
                return MessageUtil.getFormattedMessage(8006, {
                    prop: k
                });
            } else {
                settingNames[k] = true;
            }
        }
        return null;
    },

    getSettings: function() {
        var stanza = {};
        this.settings.each(function(model) {
            stanza[model.get("name")] = model.get("value");
        });
        return stanza;
    }
});
