import { View, Model } from "backbone";
import { createElement } from "react";
import _ from "lodash";
import Wrapper from "app/components/BackboneViewWrapper.jsx";

const createWrappedElement = function(viewClass = View, options = {}) {
    return createElement(Wrapper, {
        viewClass: viewClass,
        options: _.merge(
            {
                model: new Model(),
                modelAttribute: "val"
            },
            options
        )
    });
};

export { createWrappedElement };
