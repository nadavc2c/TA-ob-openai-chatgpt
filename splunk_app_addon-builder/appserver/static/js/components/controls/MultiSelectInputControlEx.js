import { Control } from "swc-aob/index";
import ReactDOM from "react-dom";
import React from "react";
import _ from "lodash";

import MultiSelectControl from "./MultiSelectControl.jsx";

/**
 * Radio button Group
 *
 * @param {Object} options
 *            {Object} model The model to operate on
 *            {String} modelAttribute The attribute on the model to observe and update on selection
 *            {Object} items An array of one-level deep data structures:
 *                                      label (textual display),
 *                                      value (value to store in model)
 */

export default Control.extend({
    className: "control multiselect-input-control splunk-multidropdown",
    initialize: function() {
        if (this.options.modelAttribute) {
            this.$el.attr("data-name", this.options.modelAttribute);
        }
        Control.prototype.initialize.call(this, this.options);
        this.OnChange = this.OnChange.bind(this);
        this.new_value = [];
    },
    renderInputProps: function() {
        var tags_dictionary = _.map(this.options.tags, tag => {
            return {
                label: tag,
                value: tag
            };
        });
        ReactDOM.render(
            <MultiSelectControl 
                value={ this._value }
                onChange={ this.OnChange }
                items={ tags_dictionary } 
            />,
            this.$("#multi-select-control-backbone")[0]
        );
    },
    render: function() {
        if (this._value === this.new_value) {
            return this;
        }

        this.$el.html(
            this.compiledTemplate()
        );
        this.renderInputProps();
        return this;
    },
    setItems: function(items, render) {
        render = render || true;
        this.options.items = items;
        if (render) {
            this.render();
        }
    },
    remove: function() {
        return Control.prototype.remove.apply(this, arguments);
    },
    OnChange: function(e, {value}) {
        var values_object = {value};
        var values = values_object['value'] || [];
        this.new_value = values;
        this.setValue(values, false);
    },
    setTags: function(tags, render) {
        render = render || true;
        this.options.tags = tags;
        if (render) {
            this.render();
        }
    },
    enable: function() {
        Control.prototype.enable.apply(this);
    },
    disable: function() {
        Control.prototype.disable.apply(this);
    },
    template: [
        '<div id="multi-select-control-backbone">',
        "</div>"
    ].join("")
});
