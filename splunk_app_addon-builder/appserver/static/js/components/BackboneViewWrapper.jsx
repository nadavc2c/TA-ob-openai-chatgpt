import React from "react";
import { View, Model } from "backbone";
import _ from "lodash";
import PropTypes from "prop-types";

export default class Wrapper extends React.Component {
    static defaultProps = {
        viewClass: View,
        options: {}
    };

    static propTypes = {
        viewClass: PropTypes.func.isRequired,
        options: PropTypes.shape({
            model: PropTypes.instanceOf(Model),
            modelAttribute: PropTypes.string
        })
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        return <div ref="myWrapper" />;
    }
    renderBackboneView() {
        const { options, viewClass } = this.props;
        this.backboneView = new viewClass(
            _.merge(options, {
                el: this.refs.myWrapper
            })
        );
        this.backboneView.render();
    }
    removeBackboneView() {
        let view = this.backboneView;
        if (view && _.isFunction(view.remove)) {
            view.remove();
        }
    }
    componentDidMount() {
        this.renderBackboneView();
    }
    componentDidUpdate() {
        this.removeBackboneView();
        this.renderBackboneView();
    }
    componentWillUnmount() {
        this.removeBackboneView();
    }
}
