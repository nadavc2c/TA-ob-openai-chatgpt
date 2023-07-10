import $ from "jquery";
import { Control } from "swc-aob/index";
import ReactDOM from "react-dom";
import SingleSelectControl from "app/components/controls/SingleSelectControl";
import React from "react";

export default Control.extend({
    initialize: function() {
        Control.prototype.initialize.apply(this, arguments);
        if (this.options.modelAttribute === "log_level") {
            this.setValue("DEBUG", false);
        }
        this.options.placeholder = this.options.placeholder || "";
        this.placeholder = this.options.placeholder;
        this.onchange = this.onchange.bind(this);
    },
    /**
     * @constructor
     * @param {Object} options {
     *     {String, required} modelAttribute The attribute on the model to observe and update on selection
     *     {Model, required} model The model to operate on
     *     {String, optional} placeholder The placeholder text for an empty input
     *     {Boolean, optional} allowClear Whether to allow clear select items, default is false
     *     {Array<String>, optional} autoCompleteFields A list of fields to use for auto-complete,
     *     {Array<String>, optional} unselectableFields A list of disabled fields
     *     {String, optional} inputClassName A class name to apply to the input element
     *     {Function, optional} tooltip A function to add tooltip on items based on rules
     */
     render: function() {
        this.$el.html(
            this.compiledTemplate()
        );
        this.renderInputProps();
        return this;
    },
    renderInputProps() {
        ReactDOM.render(
            // eslint-disable-next-line react/react-in-jsx-scope
            <SingleSelectControl
                value={ this._value }
                items={ this.options.autoCompleteFields }
                filter={ this.options.filter }
                onChange={ this.onchange }
            />,
            this.$("#select")[0]
        );
    },
    onchange(e, value) {
        var val = value['value'];
        this.setValue(val, false);
    },
    remove() {
        ReactDOM.unmountComponentAtNode(this.$("#select")[0]);
        Control.prototype.remove.apply(this, arguments);
    },
    setAutoCompleteFields: function(fields, render, unselectableFields) {
        render = render != null ? render : true;
        if (fields != null) {
            this.options.autoCompleteFields = fields;
        }
        // Peter: add unselectable fields support. This parameter can be null
        // when it is set, all matched item in autoCompleteFields will be disabled
        if (unselectableFields) {
            this.options.unselectableFields = unselectableFields;
        }
        if (render) {
            // enable and render
            this.enable(false);
            this.render();
        }
    },
    disable: function() {
        this.options.disabled = true;
        this.$("#select").prop("disabled", true);
    },
    startLoading: function() {
        this.options.placeholder = "Loading ...";
        this.disable();
        this.render();
    },
    enable: function(render) {
        if (this.options.placeholder !== this.placeholder) {
            this.options.placeholder = this.placeholder;
            if (render) {
                this.render();
            }
        }
        this.options.disabled = false;
        this.$("#select").prop("disabled", false);
    },
    template: '<div id="select" />'
});
