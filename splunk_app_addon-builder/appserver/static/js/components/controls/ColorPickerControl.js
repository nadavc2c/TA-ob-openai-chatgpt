import $ from "jquery";
import { ColorPicker } from "swc-aob/index";
import { ColorPickerControl } from "swc-aob/index";

export default ColorPickerControl.extend({
    events: {
        "click .color-square": function(e) {
            e.preventDefault();
            var $target = $(e.target);
            this.children.colorPicker = new ColorPicker({
                model: this.mediatorModel,
                paletteColors: this.options.paletteColors,
                shadeColor: function(color) {
                    return color;
                },
                onHiddenRemove: true
            });
            var popContainer = this.options.popContainer || $("body");
            this.children.colorPicker.render().appendTo(popContainer);
            this.children.colorPicker.show($target);
        }
    },

    initialize: function() {
        ColorPickerControl.prototype.initialize.apply(this, arguments);
    }
});
