import $ from "jquery";
import _ from "lodash";
import Backbone from "backbone";
import Sortable from "Sortable";
import { CheckboxGroup } from "swc-aob/index";
import * as AppInfo from "app/utils/AppInfo";
import * as NameConvertUtil from "app/utils/NameConvertUtil";
import * as MessageUtil from "app/utils/MessageUtil";
import * as HelpLinkUtil from "app/utils/HelpLinkUtil";
import ParameterGlobalTemplate
    from "contrib/text!app/views/subviews/ModularAlert/WizardSteps/ParameterGlobalSetting.html";
import TextTemplate
    from "contrib/text!app/templates/playground/control/text_template.html";
import PasswordTemplate
    from "contrib/text!app/templates/playground/control/password_template.html";
import DropdownTemplate
    from "contrib/text!app/templates/playground/control/dropdown_template.html";
import RadioButtonTemplate
    from "contrib/text!app/templates/playground/control/radiobutton_template.html";
import CheckboxTemplate
    from "contrib/text!app/templates/playground/control/checkbox_template.html";
import RadioOptionTemplate
    from "contrib/text!app/templates/playground/control/radio_option_template.html";
import TextPropertyTemplate
    from "contrib/text!app/templates/playground/property/text_property.html";
import PasswordPropertyTemplate
    from "contrib/text!app/templates/playground/property/password_property.html";
import RadioButtonPropertyTemplate
    from "contrib/text!app/templates/playground/property/radiobutton_property.html";
import CheckboxPropertyTemplate
    from "contrib/text!app/templates/playground/property/checkbox_property.html";
import DropdownPropertyTemplate
    from "contrib/text!app/templates/playground/property/dropdown_property.html";
import RadioOptionValueTemplate
    from "contrib/text!app/templates/playground/property/radio_option_value.html";
import DropdownOptionValueTemplate
    from "contrib/text!app/templates/playground/property/dropdown_option_value.html";
import PropertyEditorContentTemplate
    from "contrib/text!app/templates/playground/property/property_editor_content.html";

export default Backbone.View.extend({
    className: "ta-step-view ta-parameter-global-setting",
    initialize: function(options) {
        Backbone.View.prototype.initialize.apply(this, arguments);
        this.controller = options.controller;
        //Metadata model
        this.model = options.model;
        this.stepModel = options.stepModel;
        // global settings model
        this.globalSettings = options.globalSettings;

        this.globalModel = new Backbone.Model();
        this.componentModel = Backbone.Model.extend({
            defaults: {
                format_type: "",
                type: "",
                required: 0,
                name: "",
                label: "",
                default_value: "",
                help_string: ""
            }
        });
        this.componentCollection = Backbone.Collection.extend({
            model: this.componentModel
        });
        this.basicCollection = new this.componentCollection();
        this.globalCollection = new this.componentCollection();
        this.templateMap = {
            text: TextTemplate,
            password: PasswordTemplate,
            radio: RadioButtonTemplate,
            checkbox: CheckboxTemplate,
            dropdownlist: DropdownTemplate
        };
        this.iconUrlPrefix =
            AppInfo.getURLPrefix() +
            "/static/app/" +
            AppInfo.getCurrentApp() +
            "/img/icon/playground/";
        this.defaultIcon =
            AppInfo.getURLPrefix() +
            "/static/app/" +
            AppInfo.getCurrentApp() +
            "/img/alerticon.png";
    },

    render: function() {
        var that = this;
        this.$el.html(
            _.template(ParameterGlobalTemplate)({
                text_icon: this.iconUrlPrefix + "text.png",
                password_icon: this.iconUrlPrefix + "password.png",
                dropdown_icon: this.iconUrlPrefix + "dropdown.png",
                radio_icon: this.iconUrlPrefix + "radio.png",
                checkbox_icon: this.iconUrlPrefix + "checkbox.png",
                alert_name: this.model.get("short_name"),
                alert_logo: this.model.get("largeIcon")
                    ? "data:image/png;base64," + this.model.get("largeIcon")
                    : this.defaultIcon,
                drag_icon: this.iconUrlPrefix + "icon_drag.png",
                is_builtin: this.controller.isBuiltIn(),
                helpUrl: HelpLinkUtil.makeHelpUrl("step_alert")
            })
        );

        this.$(".ta-playground-property-editor-body").append(
            PropertyEditorContentTemplate
        );

        this.globalSettingComponent = new CheckboxGroup({
            model: this.globalModel,
            modelAttribute: "component",
            items: [
                {
                    value: "proxy_settings",
                    label: "Proxy settings"
                },
                {
                    value: "credential_settings",
                    label: "Global account settings"
                },
                {
                    value: "log_settings",
                    label: "Logging settings"
                }
            ]
        });

        //item click function
        function item_click(e) {
            // get property editor id
            var propertyEditorId;
            if (e.data && e.data.propertyEditorId) {
                propertyEditorId = e.data.propertyEditorId;
            } else {
                return;
            }
            // get the model if exist
            var propertyModel;
            if (e.data && e.data.model) {
                propertyModel = e.data.model;
            } else {
                console.log("item_click: model parameter is missing.");
                return;
            }
            var possible_values_keys = [];
            var possible_values_values = [];
            if (propertyModel.get("possible_values")) {
                possible_values_keys = Object.keys(
                    propertyModel.get("possible_values")
                );
                possible_values_values = Object.values(
                    propertyModel.get("possible_values")
                );
            }
            // set item border style
            if (that.currentComponent) {
                that.currentComponent.css("border", "solid 1px transparent");
            }
            that.currentComponent = $(e.target).closest(
                ".ta-playground-component-item"
            );
            that.currentComponent.css(
                "border",
                "solid 1px rgba(25, 138, 186, 0.5)"
            );
            // reorder the options for radio group and dropdown
            if (propertyModel.get("format_type") === "radio") {
                that.currentComponent
                    .find(".ta-playground-component-content")
                    .empty();
                for (var kk in propertyModel.get("possible_values")) {
                    if (
                        propertyModel.get("possible_values").hasOwnProperty(kk)
                    ) {
                        that.currentComponent
                            .find(".ta-playground-component-content")
                            .append(
                                _.template(RadioOptionTemplate)({
                                    name: propertyModel.get("name"),
                                    option_label: kk,
                                    option_value: propertyModel.get(
                                        "possible_values"
                                    )[kk],
                                    checked: propertyModel.get(
                                        "possible_values"
                                    )[kk] === propertyModel.get("default_value")
                                        ? "checked"
                                        : ""
                                })
                            );
                    }
                }
            } else if (propertyModel.get("format_type") === "dropdownlist") {
                that.currentComponent.find("select").empty();
                for (let key in propertyModel.get("possible_values")) {
                    if (
                        propertyModel.get("possible_values").hasOwnProperty(key)
                    ) {
                        that.currentComponent.find("select").append(
                            _.template(
                                '<option value="<%- option_value %>" <%- selected %>><%- option_label %></option>'
                            )({
                                option_label: key,
                                option_value: propertyModel.get(
                                    "possible_values"
                                )[key],
                                selected: propertyModel.get("possible_values")[
                                    key
                                ] === propertyModel.get("default_value")
                                    ? "selected"
                                    : ""
                            })
                        );
                    }
                }
            }

            function check_duplication(attribute, value) {
                if (attribute === "option_label") {
                    var keys = Object.keys(
                        propertyModel.get("possible_values")
                    );
                    return _.indexOf(keys, value);
                } else if (attribute === "option_value") {
                    var values = Object.values(
                        propertyModel.get("possible_values")
                    );
                    return _.indexOf(values, value);
                }
            }

            function radio_blur(target) {
                var element = target.closest(".radio_option_value");
                var display_value = $(element).find(
                    "input[name=option_label]"
                )[0].value,
                    internal_value = $(element).find(
                        "input[name=option_value]"
                    )[0].value,
                    index = _.filter(element.parent().children(), a => {
                        return a.className === "radio_option_value";
                    }).indexOf(element[0]);
                var possible_values = _.clone(
                    propertyModel.get("possible_values")
                );
                if (target.hasClass("checked")) {
                    if (!target.val()) {
                        that.displayErrorMessage(
                            element,
                            MessageUtil.getFormattedMessage(
                                10100,
                                that.fieldMap[target.prop("name")]
                            )
                        );
                    } else if (
                        target.prop("name") === "option_value" &&
                        !target.val().match(/^[\w]+$/)
                    ) {
                        that.displayErrorMessage(
                            element,
                            MessageUtil.getFormattedMessage(
                                10102,
                                "Internal Value"
                            )
                        );
                        return;
                    } else {
                        if (target.val() === that.current_field_value) {
                            return;
                        }
                        // check duplication
                        if (target.val() !== that.current_field_value) {
                            if (
                                check_duplication(
                                    target.prop("name"),
                                    target.val()
                                ) > -1
                            ) {
                                that.displayErrorMessage(
                                    element,
                                    MessageUtil.getFormattedMessage(
                                        10104,
                                        that.fieldMap[target.prop("name")]
                                    )
                                );
                                return;
                            }
                        }
                        if (target.prop("name") === "option_label") {
                            delete possible_values[that.current_field_value];
                            possible_values_keys[
                                possible_values_keys.indexOf(
                                    that.current_field_value
                                )
                            ] = display_value;
                        } else if (target.prop("name") === "option_value") {
                            possible_values_values[
                                possible_values_values.indexOf(
                                    that.current_field_value
                                )
                            ] = internal_value;
                        }
                        possible_values[display_value] = internal_value;
                        propertyModel.set("possible_values", possible_values);
                        if (
                            $(element).find(
                                "input[name=option_default_value]"
                            )[0].checked
                        ) {
                            propertyModel.set("default_value", internal_value);
                        }
                    }
                } else {
                    var all_focused = true;
                    _.each(element.find("input[type=text]"), function(input) {
                        if (!$(input).hasClass("focused")) {
                            all_focused = false;
                        }
                    });
                    if (all_focused) {
                        if (!display_value) {
                            that.removeErrorMessage(element);
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10100,
                                    "Display Value"
                                )
                            );
                            return;
                        } else if (!internal_value) {
                            that.removeErrorMessage(element);
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10100,
                                    "Internal Value"
                                )
                            );
                            return;
                        } else if (!internal_value.match(/^[\w]+$/)) {
                            that.removeErrorMessage(element);
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10102,
                                    "Internal Value"
                                )
                            );
                            return;
                        } else {
                            // check duplication
                            if (
                                check_duplication(
                                    "option_label",
                                    display_value
                                ) > -1
                            ) {
                                that.removeErrorMessage(element);
                                that.displayErrorMessage(
                                    element,
                                    MessageUtil.getFormattedMessage(
                                        10104,
                                        that.fieldMap.option_label
                                    )
                                );
                                return;
                            }
                            if (
                                check_duplication(
                                    "option_value",
                                    internal_value
                                ) > -1
                            ) {
                                that.removeErrorMessage(element);
                                that.displayErrorMessage(
                                    element,
                                    MessageUtil.getFormattedMessage(
                                        10104,
                                        that.fieldMap.option_value
                                    )
                                );
                                return;
                            }
                            element
                                .find("input[type=text]")
                                .addClass("checked");

                            possible_values[display_value] = internal_value;
                            propertyModel.set(
                                "possible_values",
                                possible_values
                            );
                            if (
                                $(element).find(
                                    "input[name=option_default_value]"
                                )[0].checked
                            ) {
                                propertyModel.set(
                                    "default_value",
                                    internal_value
                                );
                            }
                            // update keys and values array
                            possible_values_keys.push(display_value);
                            possible_values_values.push(internal_value);
                        }
                    } else {
                        return;
                    }
                }
                // update radio control
                if (
                    !$(e.target)
                        .closest(".ta-playground-component-item")
                        .find(".option_input input")[index]
                ) {
                    $(e.target)
                        .closest(".ta-playground-component-item")
                        .find(".ta-playground-component-content")
                        .append(
                            _.template(RadioOptionTemplate)({
                                name: propertyModel.get("name"),
                                option_label: display_value,
                                option_value: internal_value,
                                checked: ""
                            })
                        );
                } else {
                    $(
                        $(e.target)
                            .closest(".ta-playground-component-item")
                            .find(".option_input input")[index]
                    ).val(internal_value);
                    $(
                        $(e.target)
                            .closest(".ta-playground-component-item")
                            .find(".option_label")[index]
                    ).html(display_value);
                }
            }

            function dropdown_blur(target) {
                var element = target.closest(".dropdown_option_value");
                var display_value = $(element).find(
                    "input[name=option_label]"
                )[0].value,
                    internal_value = $(element).find(
                        "input[name=option_value]"
                    )[0].value,
                    index = _.filter(element.parent().children(), a => {
                        return a.className === "dropdown_option_value";
                    }).indexOf(element[0]);
                var possible_values = _.clone(
                    propertyModel.get("possible_values")
                );
                if (target.hasClass("checked")) {
                    if (!target.val()) {
                        that.displayErrorMessage(
                            element,
                            MessageUtil.getFormattedMessage(
                                10100,
                                that.fieldMap[target.prop("name")]
                            )
                        );
                    } else if (
                        target.prop("name") === "option_value" &&
                        !target.val().match(/^[\w]+$/)
                    ) {
                        that.displayErrorMessage(
                            element,
                            MessageUtil.getFormattedMessage(
                                10102,
                                "Internal Value"
                            )
                        );
                        return;
                    } else {
                        if (target.val() === that.current_field_value) {
                            return;
                        }
                        // check duplication
                        if (target.val() !== that.current_field_value) {
                            if (
                                check_duplication(
                                    target.prop("name"),
                                    target.val()
                                ) > -1
                            ) {
                                that.displayErrorMessage(
                                    element,
                                    MessageUtil.getFormattedMessage(
                                        10104,
                                        that.fieldMap[target.prop("name")]
                                    )
                                );
                                return;
                            }
                        }
                        if (target.prop("name") === "option_label") {
                            delete possible_values[that.current_field_value];
                            possible_values_keys[
                                possible_values_keys.indexOf(
                                    that.current_field_value
                                )
                            ] = display_value;
                        } else if (target.prop("name") === "option_value") {
                            possible_values_values[
                                possible_values_values.indexOf(
                                    that.current_field_value
                                )
                            ] = internal_value;
                        }
                        possible_values[display_value] = internal_value;
                        propertyModel.set("possible_values", possible_values);
                        if (
                            $(element).find(
                                "input[name=option_default_value]"
                            )[0].checked
                        ) {
                            propertyModel.set("default_value", internal_value);
                        }
                    }
                } else {
                    var all_focused = true;
                    _.each(element.find("input[type=text]"), function(input) {
                        if (!$(input).hasClass("focused")) {
                            all_focused = false;
                        }
                    });
                    if (all_focused) {
                        if (!display_value) {
                            that.removeErrorMessage(element);
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10100,
                                    "Display Value"
                                )
                            );
                            return;
                        } else if (!internal_value) {
                            that.removeErrorMessage(element);
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10100,
                                    "Internal Value"
                                )
                            );
                            return;
                        } else if (!internal_value.match(/^[\w]+$/)) {
                            that.removeErrorMessage(element);
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10102,
                                    "Internal Value"
                                )
                            );
                            return;
                        } else {
                            // check duplication
                            if (
                                check_duplication(
                                    "option_label",
                                    display_value
                                ) > -1
                            ) {
                                that.removeErrorMessage(element);
                                that.displayErrorMessage(
                                    element,
                                    MessageUtil.getFormattedMessage(
                                        10104,
                                        that.fieldMap.option_label
                                    )
                                );
                                return;
                            }
                            if (
                                check_duplication(
                                    "option_value",
                                    internal_value
                                ) > -1
                            ) {
                                that.removeErrorMessage(element);
                                that.displayErrorMessage(
                                    element,
                                    MessageUtil.getFormattedMessage(
                                        10104,
                                        that.fieldMap.option_value
                                    )
                                );
                                return;
                            }
                            element
                                .find("input[type=text]")
                                .addClass("checked");

                            possible_values[display_value] = internal_value;
                            propertyModel.set(
                                "possible_values",
                                possible_values
                            );
                            // update keys and values array
                            possible_values_keys.push(display_value);
                            possible_values_values.push(internal_value);
                            if (
                                $(element).find(
                                    "input[name=option_default_value]"
                                )[0].checked
                            ) {
                                propertyModel.set(
                                    "default_value",
                                    internal_value
                                );
                            }
                        }
                    } else {
                        return;
                    }
                }
                // update radio control
                if (
                    !$(e.target)
                        .closest(".ta-playground-component-item")
                        .find("option")[index]
                ) {
                    $(e.target)
                        .closest(".ta-playground-component-item")
                        .find("select")
                        .append(
                            _.template(
                                '<option value="<%- option_value %>"><%- option_label %></option>'
                            )({
                                option_label: display_value,
                                option_value: internal_value
                            })
                        );
                } else {
                    $(
                        $(e.target)
                            .closest(".ta-playground-component-item")
                            .find("option")[index]
                    ).val(internal_value);
                    $(
                        $(e.target)
                            .closest(".ta-playground-component-item")
                            .find("option")[index]
                    ).html(display_value);
                }
            }

            function delete_radio_option(e) {
                e.preventDefault();
                var element = $(e.target).closest(".radio_option_value"),
                    index = _.filter(element.parent().children(), a => {
                        return a.className === "radio_option_value";
                    }).indexOf(element[0]),
                    display_value = possible_values_keys[index],
                    internal_value = possible_values_values[index];
                // prevent deleting the last option
                if (
                    _.filter(element.parent().children(), a => {
                        return a.className === "radio_option_value";
                    }).length === 1
                ) {
                    that.removeErrorMessage(element);
                    that.displayErrorMessage(
                        element,
                        MessageUtil.getFormattedMessage(10108)
                    );
                    window.setTimeout(function() {
                        that.removeErrorMessage(element);
                    }, 3000);
                    return;
                }
                // remove error message if any
                that.removeErrorMessage($(element));
                $(e.target).closest(".radio_option_value").remove();
                $(e.data.radio_target.closest(".ta-playground-component-item"))
                    .find("input[value=" + internal_value + "]")
                    .parent()
                    .parent()
                    .remove();
                // update the model
                var possible_values = _.clone(
                    propertyModel.get("possible_values")
                );
                delete possible_values[display_value];
                propertyModel.set("possible_values", possible_values);
                if (possible_values_keys.indexOf(display_value) > -1) {
                    possible_values_keys.splice(
                        possible_values_keys.indexOf(display_value),
                        1
                    );
                    possible_values_values.splice(
                        possible_values_values.indexOf(internal_value),
                        1
                    );
                }
            }

            function delete_dropdown_option(e) {
                e.preventDefault();
                var element = $(e.target).closest(".dropdown_option_value"),
                    index = _.filter(element.parent().children(), a => {
                        return a.className === "dropdown_option_value";
                    }).indexOf(element[0]),
                    display_value = possible_values_keys[index],
                    internal_value = possible_values_values[index];
                // prevent deleting the last option
                if (
                    _.filter(element.parent().children(), a => {
                        return a.className === "dropdown_option_value";
                    }).length === 1
                ) {
                    that.removeErrorMessage(element);
                    that.displayErrorMessage(
                        element,
                        MessageUtil.getFormattedMessage(10108)
                    );
                    window.setTimeout(function() {
                        that.removeErrorMessage(element);
                    }, 3000);
                    return;
                }
                // remove error message if any
                that.removeErrorMessage($(element));
                $(e.target).closest(".dropdown_option_value").remove();
                $(
                    $(e.data.dropdown_target)
                        .closest(".ta-playground-component-item")
                        .find("option[value=" + internal_value + "]")
                ).remove();
                // update the model
                var possible_values = _.clone(
                    propertyModel.get("possible_values")
                );
                delete possible_values[display_value];
                propertyModel.set("possible_values", possible_values);
                if (possible_values_keys.indexOf(display_value) > -1) {
                    possible_values_keys.splice(
                        possible_values_keys.indexOf(display_value),
                        1
                    );
                    possible_values_values.splice(
                        possible_values_values.indexOf(internal_value),
                        1
                    );
                }
            }

            that.$("#" + propertyEditorId).empty();
            if (propertyModel.get("format_type") === "text") {
                that.$("#" + propertyEditorId).append(
                    _.template(TextPropertyTemplate)({
                        label: propertyModel.get("label")
                            ? propertyModel.get("label")
                            : "",
                        name: propertyModel.get("name")
                            ? propertyModel.get("name")
                            : "",
                        default_value: propertyModel.get("default_value")
                            ? propertyModel.get("default_value")
                            : "",
                        required: propertyModel.get("required")
                            ? propertyModel.get("required")
                            : false,
                        help_string: propertyModel.get("help_string")
                            ? propertyModel.get("help_string")
                            : ""
                    })
                );
            } else if (propertyModel.get("format_type") === "password") {
                that.$("#" + propertyEditorId).append(
                    _.template(PasswordPropertyTemplate)({
                        label: propertyModel.get("label")
                            ? propertyModel.get("label")
                            : "",
                        name: propertyModel.get("name")
                            ? propertyModel.get("name")
                            : "",
                        default_value: propertyModel.get("default_value")
                            ? propertyModel.get("default_value")
                            : "",
                        required: propertyModel.get("required")
                            ? propertyModel.get("required")
                            : false,
                        help_string: propertyModel.get("help_string")
                            ? propertyModel.get("help_string")
                            : ""
                    })
                );
            } else if (propertyModel.get("format_type") === "radio") {
                that.$("#" + propertyEditorId).append(
                    _.template(RadioButtonPropertyTemplate)({
                        label: propertyModel.get("label")
                            ? propertyModel.get("label")
                            : "",
                        name: propertyModel.get("name")
                            ? propertyModel.get("name")
                            : "",
                        default_value: propertyModel.get("default_value")
                            ? propertyModel.get("default_value")
                            : "",
                        required: propertyModel.get("required")
                            ? propertyModel.get("required")
                            : false,
                        help_string: propertyModel.get("help_string")
                            ? propertyModel.get("help_string")
                            : "",
                        iconx: that.iconUrlPrefix + "iconx.png"
                    })
                );
                if (propertyModel.get("possible_values")) {
                    that
                        .$("#" + propertyEditorId + " .radio_option_values")
                        .empty();
                    for (var key in propertyModel.get("possible_values")) {
                        if (
                            propertyModel
                                .get("possible_values")
                                .hasOwnProperty(key)
                        ) {
                            that
                                .$(
                                    "#" +
                                        propertyEditorId +
                                        " .radio_option_values"
                                )
                                .append(
                                    _.template(RadioOptionValueTemplate)({
                                        option_label: key,
                                        option_value: propertyModel.get(
                                            "possible_values"
                                        )[key],
                                        checked: propertyModel.get(
                                            "possible_values"
                                        )[key] ===
                                            propertyModel.get("default_value")
                                            ? "checked"
                                            : "",
                                        iconx: that.iconUrlPrefix + "iconx.png"
                                    })
                                );
                        }
                    }
                }
                // add new option value for radio
                that
                    .$("#" + propertyEditorId + " #add_new_option")
                    .click(function() {
                        if (
                            _.filter(
                                $(".radio_option_values").children(),
                                a => {
                                    return a.className === "radio_option_value";
                                }
                            ).length !==
                            Object.keys(propertyModel.get("possible_values"))
                                .length
                        ) {
                            return;
                        }
                        var template = $(
                            _.template(RadioOptionValueTemplate)({
                                option_label: "",
                                option_value: "",
                                checked: "",
                                iconx: that.iconUrlPrefix + "iconx.png"
                            })
                        );
                        that
                            .$("#" + propertyEditorId + " .radio_option_values")
                            .append(template);
                        that
                            .$(
                                "#" +
                                    propertyEditorId +
                                    " .radio_option_value a"
                            )
                            .click(
                                { radio_target: e.target },
                                delete_radio_option
                            );
                        // new option default value change
                        that
                            .$(
                                "#" +
                                    propertyEditorId +
                                    " .radio_option_value input[type=radio]"
                            )
                            .change(function() {
                                var default_value;
                                if (
                                    $(this)
                                        .closest(".radio_option_value")
                                        .next().length &&
                                    $(this)
                                        .closest(".radio_option_value")
                                        .next()[0].className === "error_message"
                                ) {
                                    return;
                                } else {
                                    default_value = $(this)
                                        .closest(".radio_option_value")
                                        .find("input[name=option_value]")
                                        .val();
                                    $(e.target)
                                        .closest(
                                            ".ta-playground-component-item"
                                        )
                                        .find(
                                            "input[value=" + default_value + "]"
                                        )
                                        .prop("checked", true);
                                    propertyModel.set(
                                        "default_value",
                                        default_value
                                    );
                                }
                            });
                        template
                            .find("input[type=text]")
                            .focus(function() {
                                $(this).addClass("focused");
                                // remove corresponding error message
                                var element = $(this).closest(
                                    ".radio_option_value"
                                );
                                var field = that.fieldMap[$(this).prop("name")];
                                var next = element.next()[0];
                                while (
                                    next &&
                                    next.className === "error_message"
                                ) {
                                    if (next.innerText.indexOf(field) > -1) {
                                        $(next).remove();
                                    }
                                    next = $(next).next()[0];
                                }
                                var index = _.filter(
                                    element.parent().children(),
                                    a => {
                                        return (
                                            a.className === "radio_option_value"
                                        );
                                    }
                                ).indexOf(element[0]);
                                if (index >= possible_values_keys.length) {
                                    return;
                                } else if (
                                    $(this).prop("name") === "option_label"
                                ) {
                                    that.current_field_value =
                                        possible_values_keys[index];
                                } else if (
                                    $(this).prop("name") === "option_value"
                                ) {
                                    that.current_field_value =
                                        possible_values_values[index];
                                }
                            })
                            .blur(function() {
                                radio_blur($(this));
                            });
                    });
                // remove option value
                that
                    .$("#" + propertyEditorId + " .radio_option_value a")
                    .click({ radio_target: e.target }, delete_radio_option);
                // option value change
                that
                    .$(
                        "#" +
                            propertyEditorId +
                            " .radio_option_value input[type=text]"
                    )
                    .focus(function() {
                        $(this).addClass("focused");
                        // remove corresponding error message
                        var element = $(this).closest(".radio_option_value");
                        var field = that.fieldMap[$(this).prop("name")];
                        var next = element.next()[0];
                        while (next && next.className === "error_message") {
                            if (next.innerText.indexOf(field) > -1) {
                                $(next).remove();
                            }
                            next = $(next).next()[0];
                        }
                        var index = _.filter(element.parent().children(), a => {
                            return a.className === "radio_option_value";
                        }).indexOf(element[0]);
                        if ($(this).prop("name") === "option_label") {
                            that.current_field_value =
                                possible_values_keys[index];
                        } else if ($(this).prop("name") === "option_value") {
                            that.current_field_value =
                                possible_values_values[index];
                        }
                    })
                    .blur(function() {
                        var element = $(this).closest(".radio_option_value"),
                            value = $(this).val();
                        if (!value) {
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10100,
                                    that.fieldMap[$(this).prop("name")]
                                )
                            );
                        } else if (
                            $(this).prop("name") === "option_value" &&
                            !value.match(/^[\w]+$/)
                        ) {
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10102,
                                    "Internal Value"
                                )
                            );
                            return;
                        } else {
                            if (value === that.current_field_value) {
                                return;
                            }
                            // check duplication
                            if (value !== that.current_field_value) {
                                if (
                                    check_duplication(
                                        $(this).prop("name"),
                                        value
                                    ) > -1
                                ) {
                                    that.displayErrorMessage(
                                        element,
                                        MessageUtil.getFormattedMessage(
                                            10104,
                                            that.fieldMap[$(this).prop("name")]
                                        )
                                    );
                                    return;
                                }
                            }
                            // update radio control
                            var display_value = $(element).find(
                                "input[name=option_label]"
                            )[0].value,
                                internal_value = $(element).find(
                                    "input[name=option_value]"
                                )[0].value,
                                index = _.filter(
                                    element.parent().children(),
                                    a => {
                                        return (
                                            a.className === "radio_option_value"
                                        );
                                    }
                                ).indexOf(element[0]);
                            if (
                                !$(e.target)
                                    .closest(".ta-playground-component-item")
                                    .find(".option_input input")[index]
                            ) {
                                $(e.target)
                                    .closest(".ta-playground-component-item")
                                    .find(".ta-playground-component-content")
                                    .append(
                                        _.template(RadioOptionTemplate)({
                                            option_label: display_value,
                                            option_value: _.escape(
                                                internal_value
                                            ),
                                            checked: ""
                                        })
                                    );
                            } else {
                                $(
                                    $(e.target)
                                        .closest(
                                            ".ta-playground-component-item"
                                        )
                                        .find(".option_input input")[index]
                                ).val(internal_value);
                                $(
                                    $(e.target)
                                        .closest(
                                            ".ta-playground-component-item"
                                        )
                                        .find(".option_label")[index]
                                ).text(display_value);
                            }
                            var possible_values = _.clone(
                                propertyModel.get("possible_values")
                            );
                            if ($(this).prop("name") === "option_label") {
                                delete possible_values[
                                    that.current_field_value
                                ];
                                possible_values_keys[
                                    possible_values_keys.indexOf(
                                        that.current_field_value
                                    )
                                ] = display_value;
                            } else if (
                                $(this).prop("name") === "option_value"
                            ) {
                                possible_values_values[
                                    possible_values_values.indexOf(
                                        that.current_field_value
                                    )
                                ] = internal_value;
                            }
                            possible_values[display_value] = internal_value;
                            propertyModel.set(
                                "possible_values",
                                possible_values
                            );
                            if (
                                $(element).find(
                                    "input[name=option_default_value]"
                                )[0].checked
                            ) {
                                propertyModel.set(
                                    "default_value",
                                    internal_value
                                );
                            }
                        }
                    });
                // option default value change
                that
                    .$(
                        "#" +
                            propertyEditorId +
                            " .radio_option_value input[type=radio]"
                    )
                    .change(function() {
                        var default_value;
                        if (
                            $(this).closest(".radio_option_value").next()
                                .length &&
                            $(this).closest(".radio_option_value").next()[0]
                                .className === "error_message"
                        ) {
                            return;
                        } else {
                            default_value = $(this)
                                .closest(".radio_option_value")
                                .find("input[name=option_value]")
                                .val();
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find("input[value=" + default_value + "]")
                                .prop("checked", true);
                            propertyModel.set("default_value", default_value);
                        }
                    });
            } else if (propertyModel.get("format_type") === "checkbox") {
                that.$("#" + propertyEditorId).append(
                    _.template(CheckboxPropertyTemplate)({
                        label: propertyModel.get("label")
                            ? propertyModel.get("label")
                            : "",
                        name: propertyModel.get("name")
                            ? propertyModel.get("name")
                            : "",
                        default_value: propertyModel.get("default_value")
                            ? propertyModel.get("default_value")
                            : "",
                        required: propertyModel.get("required")
                            ? propertyModel.get("required")
                            : false,
                        help_string: propertyModel.get("help_string")
                            ? propertyModel.get("help_string")
                            : ""
                    })
                );
            } else if (propertyModel.get("format_type") === "dropdownlist") {
                that.$("#" + propertyEditorId).append(
                    _.template(DropdownPropertyTemplate)({
                        label: propertyModel.get("label")
                            ? propertyModel.get("label")
                            : "",
                        name: propertyModel.get("name")
                            ? propertyModel.get("name")
                            : "",
                        default_value: propertyModel.get("default_value")
                            ? propertyModel.get("default_value")
                            : "",
                        required: propertyModel.get("required")
                            ? propertyModel.get("required")
                            : false,
                        help_string: propertyModel.get("help_string")
                            ? propertyModel.get("help_string")
                            : "",
                        iconx: that.iconUrlPrefix + "iconx.png"
                    })
                );

                if (propertyModel.get("possible_values")) {
                    that
                        .$("#" + propertyEditorId + " .dropdown_option_values")
                        .empty();
                    for (var k in propertyModel.get("possible_values")) {
                        if (
                            propertyModel
                                .get("possible_values")
                                .hasOwnProperty(k)
                        ) {
                            that
                                .$(
                                    "#" +
                                        propertyEditorId +
                                        " .dropdown_option_values"
                                )
                                .append(
                                    _.template(DropdownOptionValueTemplate)({
                                        option_label: _.escape(k),
                                        option_value: propertyModel.get(
                                            "possible_values"
                                        )[k],
                                        checked: propertyModel.get(
                                            "possible_values"
                                        )[k] ===
                                            propertyModel.get("default_value")
                                            ? "checked"
                                            : "",
                                        iconx: that.iconUrlPrefix + "iconx.png"
                                    })
                                );
                        }
                    }
                }
                // add new option event
                that
                    .$("#" + propertyEditorId + " #add_new_option")
                    .click(function() {
                        if (
                            _.filter(
                                $(".dropdown_option_values").children(),
                                a => {
                                    return (
                                        a.className === "dropdown_option_value"
                                    );
                                }
                            ).length !==
                            Object.keys(propertyModel.get("possible_values"))
                                .length
                        ) {
                            return;
                        }
                        var template = $(
                            _.template(DropdownOptionValueTemplate)({
                                option_label: "",
                                option_value: "",
                                checked: "",
                                iconx: that.iconUrlPrefix + "iconx.png"
                            })
                        );
                        that
                            .$(
                                "#" +
                                    propertyEditorId +
                                    " .dropdown_option_values"
                            )
                            .append(template);
                        that
                            .$(
                                "#" +
                                    propertyEditorId +
                                    " .dropdown_option_value a"
                            )
                            .click(
                                { dropdown_target: e.target },
                                delete_dropdown_option
                            );
                        that
                            .$(
                                "#" +
                                    propertyEditorId +
                                    " .dropdown_option_value input[type=radio]"
                            )
                            .change(function() {
                                var default_value;
                                if (
                                    $(this)
                                        .closest(".dropdown_option_value")
                                        .next().length &&
                                    $(this)
                                        .closest(".dropdown_option_value")
                                        .next()[0].className === "error_message"
                                ) {
                                    return;
                                } else {
                                    default_value = $(this)
                                        .closest(".dropdown_option_value")
                                        .find("input[name=option_value]")
                                        .val();
                                    $(e.target)
                                        .closest(
                                            ".ta-playground-component-item"
                                        )
                                        .find("select")
                                        .val(default_value);
                                    propertyModel.set(
                                        "default_value",
                                        default_value
                                    );
                                }
                            });
                        template
                            .find("input[type=text]")
                            .focus(function() {
                                $(this).addClass("focused");
                                // remove corresponding error message
                                var element = $(this).closest(
                                    ".dropdown_option_value"
                                );
                                var field = that.fieldMap[$(this).prop("name")];
                                var next = element.next()[0];
                                while (
                                    next &&
                                    next.className === "error_message"
                                ) {
                                    if (next.innerText.indexOf(field) > -1) {
                                        $(next).remove();
                                    }
                                    next = $(next).next()[0];
                                }
                                var index = _.filter(
                                    element.parent().children(),
                                    a => {
                                        return (
                                            a.className ===
                                            "dropdown_option_value"
                                        );
                                    }
                                ).indexOf(element[0]);
                                if (index >= possible_values_keys.length) {
                                    return;
                                } else if (
                                    $(this).prop("name") === "option_label"
                                ) {
                                    that.current_field_value =
                                        possible_values_keys[index];
                                } else if (
                                    $(this).prop("name") === "option_value"
                                ) {
                                    that.current_field_value =
                                        possible_values_values[index];
                                }
                            })
                            .blur(function() {
                                dropdown_blur($(this));
                            });
                    });

                // remove option value
                that
                    .$("#" + propertyEditorId + " .dropdown_option_value a")
                    .click(
                        {
                            dropdown_target: e.target
                        },
                        delete_dropdown_option
                    );

                that
                    .$(
                        "#" +
                            propertyEditorId +
                            " .dropdown_option_value input[type=text]"
                    )
                    .focus(function() {
                        $(this).addClass("focused");
                        // remove corresponding error message
                        var element = $(this).closest(".dropdown_option_value");
                        var field = that.fieldMap[$(this).prop("name")];
                        var next = element.next()[0];
                        while (next && next.className === "error_message") {
                            if (next.innerText.indexOf(field) > -1) {
                                $(next).remove();
                            }
                            next = $(next).next()[0];
                        }
                        var index = _.filter(element.parent().children(), a => {
                            return a.className === "dropdown_option_value";
                        }).indexOf(element[0]);
                        if (index >= possible_values_keys.length) {
                            return;
                        } else if ($(this).prop("name") === "option_label") {
                            that.current_field_value =
                                possible_values_keys[index];
                        } else if ($(this).prop("name") === "option_value") {
                            that.current_field_value =
                                possible_values_values[index];
                        }
                    })
                    .blur(function() {
                        var element = $(this).closest(".dropdown_option_value"),
                            value = $(this).val();
                        if (!value) {
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10100,
                                    that.fieldMap[$(this).prop("name")]
                                )
                            );
                        } else if (
                            $(this).prop("name") === "option_value" &&
                            !value.match(/^[\w]+$/)
                        ) {
                            that.displayErrorMessage(
                                element,
                                MessageUtil.getFormattedMessage(
                                    10102,
                                    "Internal Value"
                                )
                            );
                            return;
                        } else {
                            if (value === that.current_field_value) {
                                return;
                            }
                            // check duplication
                            if (value !== that.current_field_value) {
                                if (
                                    check_duplication(
                                        $(this).prop("name"),
                                        value
                                    ) > -1
                                ) {
                                    that.displayErrorMessage(
                                        element,
                                        MessageUtil.getFormattedMessage(
                                            10104,
                                            that.fieldMap[$(this).prop("name")]
                                        )
                                    );
                                    return;
                                }
                            }
                            var display_value = $(element).find(
                                "input[name=option_label]"
                            )[0].value,
                                internal_value = $(element).find(
                                    "input[name=option_value]"
                                )[0].value,
                                index = _.filter(
                                    element.parent().children(),
                                    a => {
                                        return (
                                            a.className ===
                                            "dropdown_option_value"
                                        );
                                    }
                                ).indexOf(element[0]);
                            if (
                                !$(e.target)
                                    .closest(".ta-playground-component-item")
                                    .find("option")[index]
                            ) {
                                $(e.target)
                                    .closest(".ta-playground-component-item")
                                    .find("select")
                                    .append(
                                        _.template(
                                            '<option value="<%- option_value %>"><%- option_label %></option>'
                                        )({
                                            option_label: _.escape(
                                                display_value
                                            ),
                                            option_value: internal_value
                                        })
                                    );
                            } else {
                                $(
                                    $(e.target)
                                        .closest(
                                            ".ta-playground-component-item"
                                        )
                                        .find("option")[index]
                                ).val(internal_value);
                                $(
                                    $(e.target)
                                        .closest(
                                            ".ta-playground-component-item"
                                        )
                                        .find("option")[index]
                                ).text(display_value);
                            }

                            var possible_values = _.clone(
                                propertyModel.get("possible_values")
                            );
                            if ($(this).prop("name") === "option_label") {
                                delete possible_values[
                                    that.current_field_value
                                ];
                                possible_values_keys[
                                    possible_values_keys.indexOf(
                                        that.current_field_value
                                    )
                                ] = display_value;
                            } else if (
                                $(this).prop("name") === "option_value"
                            ) {
                                possible_values_values[
                                    possible_values_values.indexOf(
                                        that.current_field_value
                                    )
                                ] = internal_value;
                            }
                            possible_values[display_value] = internal_value;
                            propertyModel.set(
                                "possible_values",
                                possible_values
                            );
                            if (
                                $(element).find(
                                    "input[name=option_default_value]"
                                )[0].checked
                            ) {
                                propertyModel.set(
                                    "default_value",
                                    internal_value
                                );
                            }
                        }
                    });
                // option default value change
                that
                    .$(
                        "#" +
                            propertyEditorId +
                            " .dropdown_option_value input[type=radio]"
                    )
                    .change(function() {
                        var default_value;
                        if (
                            $(this).closest(".dropdown_option_value").next()
                                .length &&
                            $(this).closest(".dropdown_option_value").next()[0]
                                .className === "error_message"
                        ) {
                            return;
                        } else {
                            default_value = $(this)
                                .closest(".dropdown_option_value")
                                .find("input[name=option_value]")
                                .val();
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find("select")
                                .val(default_value);
                            propertyModel.set("default_value", default_value);
                        }
                    });
            }

            // laba property change event
            that
                .$("#" + propertyEditorId + " input[name=label]")
                .keyup(function() {
                    var labelValue = $(this).val().trim();
                    var $contents = $(e.target)
                        .closest(".ta-playground-component-item")
                        .find(".ta-playground-component-label")
                        .contents();
                    $contents[$contents.length - 1].nodeValue = labelValue;
                    if (
                        labelValue &&
                        !propertyModel.get("is_internal_name_touched")
                    ) {
                        var vName = NameConvertUtil.convertNameToInternalName(
                            labelValue
                        );
                        // this is messy! we need to re-render the control according to model values
                        that
                            .$("#" + propertyEditorId + " input[name=name]")
                            .val(vName);
                    }
                });

            // label property blur event
            that
                .$("#" + propertyEditorId + " input[name=label]")
                .blur(function() {
                    var labelValue = $(this).val().trim();
                    if (labelValue) {
                        var $contents = $(e.target)
                            .closest(".ta-playground-component-item")
                            .find(".ta-playground-component-label")
                            .contents();
                        $contents[$contents.length - 1].nodeValue = labelValue;
                        propertyModel.set("label", labelValue);
                        if (!propertyModel.get("is_internal_name_touched")) {
                            var vName = NameConvertUtil.convertNameToInternalName(
                                labelValue
                            );
                            propertyModel.set("name", vName);
                        }
                    } else {
                        that.displayErrorMessage(
                            $(this),
                            MessageUtil.getFormattedMessage(
                                10100,
                                "Display Name"
                            )
                        );
                    }
                })
                .focus(function() {
                    that.removeErrorMessage($(this));
                });
            // internal name property blur event
            that
                .$("#" + propertyEditorId + " input[name=name]")
                .blur(function() {
                    var internal_name_value = $(this).val().trim();
                    if (internal_name_value) {
                        if (!/^[a-zA-Z]\w*$/.test(internal_name_value)) {
                            that.displayErrorMessage(
                                $(this),
                                MessageUtil.getFormattedMessage(
                                    10105,
                                    "Internal Name"
                                )
                            );
                            return;
                        }
                        // check if the internal name is duplicate
                        var checkCollection;
                        if (propertyEditorId === "parameter_property_editor") {
                            checkCollection = that.basicCollection;
                            // check the upper case letter for parameters of bug CIM-405
                            if (!internal_name_value.match(/^[a-z0-9_]+$/)) {
                                that.displayErrorMessage(
                                    $(this),
                                    MessageUtil.getFormattedMessage(
                                        10107,
                                        "Internal Name"
                                    )
                                );
                            }
                        } else {
                            checkCollection = that.globalCollection;
                        }
                        if (
                            _.some(checkCollection.models, function(model) {
                                return (
                                    propertyModel !== model &&
                                    model.get("name") === internal_name_value
                                );
                            })
                        ) {
                            that.displayErrorMessage(
                                $(this),
                                MessageUtil.getFormattedMessage(
                                    10104,
                                    "Internal Name"
                                )
                            );
                            return;
                        }
                        // change the target item
                        if (
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find("input").length
                        ) {
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find("input")
                                .prop("name", internal_name_value);
                        } else if (
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find("select").length
                        ) {
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find("select")
                                .prop("name", internal_name_value);
                        }
                        propertyModel.set("name", internal_name_value);
                        if (!propertyModel.get("is_internal_name_touched")) {
                            propertyModel.set(
                                "is_internal_name_touched",
                                internal_name_value !==
                                    NameConvertUtil.convertNameToInternalName(
                                        propertyModel.get("label")
                                    )
                            );
                        }
                    } else {
                        that.displayErrorMessage(
                            $(this),
                            MessageUtil.getFormattedMessage(
                                10100,
                                "Internal Name"
                            )
                        );
                    }
                })
                .focus(function() {
                    that.removeErrorMessage($(this));
                });
            // default value property blur event
            that
                .$("#" + propertyEditorId + " input[name=default_value]")
                .blur(function() {
                    $(e.target)
                        .closest(".ta-playground-component-item")
                        .find("input")
                        .val($(this).val().trim());
                    propertyModel.set("default_value", $(this).val().trim());
                });
            // help string property blur event
            that
                .$("#" + propertyEditorId + " textarea[name=help_string]")
                .blur(function() {
                    if (
                        $(this).val().trim() &&
                        $(this).val().trim().length > 200
                    ) {
                        that.displayErrorMessage(
                            $(this),
                            MessageUtil.getFormattedMessage(
                                10101,
                                "Help text",
                                200
                            )
                        );
                    } else {
                        if (
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find(".help_string").length
                        ) {
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find(".help_string")
                                .text($(this).val().trim());
                        } else {
                            $(e.target)
                                .closest(".ta-playground-component-item")
                                .find(".ta-playground-component-content")
                                .after(
                                    '<div class="help_string">' +
                                        _.escape($(this).val().trim()) +
                                        "</div>"
                                );
                        }
                        propertyModel.set("help_string", $(this).val().trim());
                    }
                })
                .focus(function() {
                    that.removeErrorMessage($(this));
                });
            // mandatory field click event
            that
                .$("#" + propertyEditorId + " input[name=required]")
                .click(function() {
                    if ($(this).is(":checked")) {
                        $(e.target)
                            .closest(".ta-playground-component-item")
                            .find(".required")
                            .css("visibility", "visible");
                        propertyModel.set("required", true);
                    } else {
                        $(e.target)
                            .closest(".ta-playground-component-item")
                            .find(".required")
                            .css("visibility", "hidden");
                        propertyModel.set("required", false);
                    }
                });
        }

        this.item_click = item_click;

        function render_global_settings() {
            that.stepModel.trigger("enableNext");
            that.stepModel.trigger("hideSpin");

            var components = [];
            if (that.globalSettings.get("customized_settings")) {
                // reset custom global collection
                that.globalCollection.reset();
                _.each(that.globalSettings.get("customized_settings"), function(
                    parameter
                ) {
                    var html = $(
                        '<div class="ta-playground-component-item"></div>'
                    );
                    html.append(
                        _.template(that.templateMap[parameter.format_type])({
                            label: parameter.label,
                            internal_name: "", // do not display internal name
                            name: parameter.name,
                            default_value: parameter.default_value,
                            required: parameter.required,
                            help_string: parameter.help_string,
                            possible_values: parameter.possible_values
                        })
                    );
                    html.append(
                        _.template(
                            '<a href="#"><img class="js-remove" src=<%- iconx %>></img></a>'
                        )({
                            iconx: that.iconUrlPrefix + "iconx.png"
                        })
                    );
                    var model = new Backbone.Model(parameter);
                    model.set(
                        "is_internal_name_touched",
                        parameter.name !==
                            NameConvertUtil.convertNameToInternalName(
                                parameter.label
                            )
                    );
                    that.globalCollection.add(model);
                    html.click(
                        {
                            model: model,
                            propertyEditorId: "global_property_editor"
                        },
                        item_click
                    );
                    //Mouse hover
                    html
                        .mouseenter(function() {
                            html.css(
                                "border",
                                "solid 1px rgba(25, 138, 186, 0.5)"
                            );
                        })
                        .mouseleave(function() {
                            if (!that.currentComponent) {
                                html.css("border", "solid 1px transparent");
                            } else if (
                                that.currentComponent &&
                                html[0] !== that.currentComponent[0]
                            ) {
                                html.css("border", "solid 1px transparent");
                            }
                        });
                    that.$el.find("#global_editor_body_content").append(html);
                });
            }
            if (that.globalSettings.get("proxy_settings")) {
                components.push("proxy_settings");
            }
            if (that.globalSettings.get("log_settings")) {
                components.push("log_settings");
            }
            if (that.globalSettings.get("credential_settings")) {
                components.push("credential_settings");
            }
            that.globalModel.set("component", components);
        }
        // load global settings
        this.stepModel.trigger("disableNext");
        this.stepModel.trigger("showSpin", _.t("Please wait..."));

        if (this.globalSettings.isFetched) {
            render_global_settings();
        } else {
            this.globalSettings.fetch().done(function() {
                render_global_settings();
                that.globalSettings.isFetched = true;
            });
        }

        this.globalSettingComponent
            .render()
            .appendTo(this.$(".ta-playground-component-parameters-body"));

        //edit model interface
        if (this.model.get("parameters")) {
            this.basicCollection.reset();
            _.each(
                this.model.get("parameters"),
                function(parameter) {
                    var html = $(
                        '<div class="ta-playground-component-item"></div>'
                    );
                    html.append(
                        _.template(this.templateMap[parameter.format_type])({
                            label: parameter.label,
                            internal_name: "",
                            name: parameter.name,
                            default_value: parameter.default_value,
                            required: parameter.required,
                            help_string: parameter.help_string,
                            possible_values: parameter.possible_values
                        })
                    );
                    html.append(
                        _.template(
                            '<a href="#"><img class="js-remove" src=<%- iconx %>></img></a>'
                        )({
                            iconx: this.iconUrlPrefix + "iconx.png"
                        })
                    );
                    var model = new Backbone.Model(parameter);
                    model.set(
                        "is_internal_name_touched",
                        parameter.name !==
                            NameConvertUtil.convertNameToInternalName(
                                parameter.label
                            )
                    );
                    this.basicCollection.add(model);
                    html.click(
                        {
                            model: model,
                            propertyEditorId: "parameter_property_editor"
                        },
                        item_click
                    );
                    //Mouse hover
                    html.css("border", "solid 1px transparent");
                    html
                        .mouseenter(function() {
                            html.css(
                                "border",
                                "solid 1px rgba(25, 138, 186, 0.5)"
                            );
                        })
                        .mouseleave(function() {
                            if (!that.currentComponent) {
                                html.css("border", "solid 1px transparent");
                            } else if (
                                that.currentComponent &&
                                html[0] !== that.currentComponent[0]
                            ) {
                                html.css("border", "solid 1px transparent");
                            }
                        });
                    this.$("#editor_body_content").append(html);
                }.bind(this)
            );
        }

        //create sortable
        Sortable.create(this.$el.find("#common_library_body")[0], {
            group: {
                name: "drag_library",
                pull: "clone",
                put: false
            },
            sort: false,
            handle: ".ta-playground-component-item",
            animation: 150
        });
        Sortable.create(this.$el.find("#editor_body_content")[0], {
            group: {
                name: "drag_editor",
                put: ["drag_library", "drag_editor"]
            },
            handle: ".ta-playground-component-item",
            animation: 150,
            filter: ".js-remove",
            onFilter: function(evt) {
                var item = evt.item, ctrl = evt.target;

                if (Sortable.utils.is(ctrl, ".js-remove")) {
                    // Click on remove button
                    item.parentNode.removeChild(item); // remove sortable item
                }

                that.basicCollection.remove(
                    that.basicCollection.at(evt.oldIndex)
                );
                //clear the left content if needed
                that
                    .$(
                        ".ta-playground-editor-body-content .ta-playground-component-item"
                    )
                    .css("border", "1px solid transparent");
                that.$(".ta-playground-property-editor-body").empty();
            },
            onSort: function(evt) {
                if (
                    evt.from.className.indexOf(
                        "ta-playground-editor-body-content"
                    ) > -1
                ) {
                    var temp = that.basicCollection.at(evt.oldIndex);
                    that.basicCollection.remove(temp);
                    that.basicCollection.add(temp, { at: evt.newIndex });
                }
            },
            onAdd: function(evt) {
                var name = $.trim(
                    $(evt.item).find(".ta-playground-component-name").text()
                ).toLowerCase();
                $(evt.item).empty();
                var modelAttribute = _.clone(
                    that.controlMap[name].modelAttribute
                );
                modelAttribute.internal_name = "";
                var propertyModel = new that.componentModel(
                    that.controlMap[name].modelAttribute
                );
                // change the name if duplicate
                _.each(that.basicCollection.models, function(model) {
                    if (model.get("name") === propertyModel.get("name")) {
                        var label =
                            model.get("label") +
                            "_" +
                            parseInt(new Date() - 0).toString();
                        var name = NameConvertUtil.convertNameToInternalName(
                            label
                        );
                        propertyModel.set("label", label);
                        propertyModel.set("name", name);
                        modelAttribute.label = label;
                        modelAttribute.name = name;
                    }
                });
                that.basicCollection.add(propertyModel, { at: evt.newIndex });
                // render the component template
                $(evt.item).append(
                    _.template(that.controlMap[name].template)(modelAttribute)
                );
                $(evt.item).append(
                    _.template(
                        '<a href="#"><img class="js-remove" src=<%- iconx %>></img></a>'
                    )({
                        iconx: that.iconUrlPrefix + "iconx.png"
                    })
                );
                // item click event
                $(evt.item).click(
                    {
                        propertyEditorId: "parameter_property_editor",
                        model: propertyModel
                    },
                    item_click
                );

                //Mouse hover
                $(evt.item).css("border", "solid 1px transparent");
                $(evt.item)
                    .mouseenter(function() {
                        $(evt.item).css(
                            "border",
                            "solid 1px rgba(25, 138, 186, 0.5)"
                        );
                    })
                    .mouseleave(function() {
                        if (!that.currentComponent) {
                            $(evt.item).css("border", "solid 1px transparent");
                        } else if (
                            that.currentComponent &&
                            $(evt.item)[0] !== that.currentComponent[0]
                        ) {
                            $(evt.item).css("border", "solid 1px transparent");
                        }
                    });
                // show property editor
                $(evt.item).trigger("click");
            }
        });

        // global tab
        Sortable.create(this.$el.find("#global_common_library_body")[0], {
            group: {
                name: "drag_library",
                pull: "clone",
                put: false
            },
            sort: false,
            handle: ".ta-playground-component-item",
            animation: 150
        });

        Sortable.create(this.$el.find("#global_editor_body_content")[0], {
            group: {
                name: "drag_editor",
                put: ["drag_library", "drag_editor"]
            },
            handle: ".ta-playground-component-item",
            animation: 150,
            filter: ".js-remove",
            onFilter: function(evt) {
                var item = evt.item, ctrl = evt.target;

                if (Sortable.utils.is(ctrl, ".js-remove")) {
                    // Click on remove button
                    item.parentNode.removeChild(item); // remove sortable item
                }
                that.globalCollection.remove(
                    that.globalCollection.at(evt.oldIndex)
                );
                //clear the left content if needed
                that
                    .$(
                        ".ta-playground-editor-body-content .ta-playground-component-item"
                    )
                    .css("border", "1px solid transparent");
                that.$(".ta-playground-property-editor-body").empty();
            },
            onSort: function(evt) {
                if (
                    evt.from.className.indexOf(
                        "ta-playground-editor-body-content"
                    ) > -1
                ) {
                    var temp = that.globalCollection.at(evt.oldIndex);
                    that.globalCollection.remove(temp);
                    that.globalCollection.add(temp, { at: evt.newIndex });
                }
            },
            onAdd: function(/**Event*/ evt) {
                var name = $.trim(
                    $(evt.item).find(".ta-playground-component-name").text()
                ).toLowerCase();
                $(evt.item).empty();
                var modelAttribute = _.clone(
                    that.controlMap[name].modelAttribute
                );
                modelAttribute.internal_name = "";
                // for global vars, should set type.
                modelAttribute.type = modelAttribute.format_type;
                var propertyModel = new that.componentModel(modelAttribute);
                // change the name if duplicate
                _.each(that.globalCollection.models, function(model) {
                    if (model.get("name") === propertyModel.get("name")) {
                        var label =
                            model.get("label") +
                            "_" +
                            parseInt(new Date() - 0).toString();
                        var name = NameConvertUtil.convertNameToInternalName(
                            label
                        );
                        propertyModel.set("label", label);
                        propertyModel.set("name", name);
                        modelAttribute.label = label;
                        modelAttribute.name = name;
                    }
                });
                // render the component template
                $(evt.item).append(
                    _.template(that.controlMap[name].template)(modelAttribute)
                );
                $(evt.item).append(
                    _.template(
                        '<a href="#"><img class="js-remove" src=<%- iconx %>></img></a>'
                    )({
                        iconx: that.iconUrlPrefix + "iconx.png"
                    })
                );
                that.globalCollection.add(propertyModel, { at: evt.newIndex });
                // item click event
                $(evt.item).click(
                    {
                        propertyEditorId: "global_property_editor",
                        model: propertyModel
                    },
                    item_click
                );
                //Mouse hover
                $(evt.item).css("border", "solid 1px transparent");
                $(evt.item)
                    .mouseenter(function() {
                        $(evt.item).css(
                            "border",
                            "solid 1px rgba(25, 138, 186, 0.5)"
                        );
                    })
                    .mouseleave(function() {
                        if (!that.currentComponent) {
                            $(evt.item).css("border", "solid 1px transparent");
                        } else if (
                            that.currentComponent &&
                            $(evt.item)[0] !== that.currentComponent[0]
                        ) {
                            $(evt.item).css("border", "solid 1px transparent");
                        }
                    });

                $(evt.item).trigger("click");
            }
        });
        return this;
    },

    displayErrorMessage: function(selector, content) {
        var html =
            '<div class="error_message"><i class="icon-warning-sign"></i>' +
            content +
            "</div>";
        selector.after(html);
    },

    removeErrorMessage: function(selector) {
        selector.nextAll(".error_message").remove();
    },

    fieldMap: {
        option_value: "Internal value",
        option_label: "Display value"
    },

    controlMap: {
        text: {
            template: TextTemplate,
            modelAttribute: {
                format_type: "text",
                required: false,
                name: NameConvertUtil.convertNameToInternalName("String Label"),
                label: "String label",
                is_internal_name_touched: false,
                default_value: "",
                help_string: ""
            }
        },
        password: {
            template: PasswordTemplate,
            modelAttribute: {
                format_type: "password",
                required: false,
                name: NameConvertUtil.convertNameToInternalName("Password"),
                label: "Password",
                is_internal_name_touched: false,
                default_value: "",
                help_string: ""
            }
        },
        "radio buttons": {
            template: RadioButtonTemplate,
            modelAttribute: {
                format_type: "radio",
                required: false,
                name: NameConvertUtil.convertNameToInternalName("Radio Group"),
                label: "Radio Buttons",
                is_internal_name_touched: false,
                default_value: "",
                help_string: "",
                possible_values: {
                    Option1: "option1",
                    Option2: "option2",
                    Option3: "option3"
                }
            }
        },
        checkbox: {
            template: CheckboxTemplate,
            modelAttribute: {
                format_type: "checkbox",
                required: false,
                name: NameConvertUtil.convertNameToInternalName("Checkbox"),
                label: "Checkbox",
                is_internal_name_touched: false,
                default_value: 0,
                help_string: ""
            }
        },
        dropdown: {
            template: DropdownTemplate,
            modelAttribute: {
                format_type: "dropdownlist",
                required: false,
                name: NameConvertUtil.convertNameToInternalName(
                    "Dropdown List"
                ),
                label: "Dropdown List",
                is_internal_name_touched: false,
                default_value: "",
                help_string: "",
                possible_values: {
                    Option1: "option1",
                    Option2: "option2",
                    Option3: "option3"
                }
            }
        }
    }
});
