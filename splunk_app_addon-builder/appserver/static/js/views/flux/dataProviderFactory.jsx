import React from "react";
import PropTypes from "prop-types";
/*
args[0] : store
args[1] : getStateData
args[2] : actions
*/

let controlledViewFac = function(store) {
    class DataProvider extends React.Component {
        static propTypes = {
            children: PropTypes.func
        };
        constructor(...args) {
            super(...args);
        }
        // Get initial state from stores
        componentWillMount() {
            this.state = store.getViewData();
        }
        // Add change listeners to stores
        componentDidMount() {
            store.emitter.addChangeListener(this._onChange);
        }

        // Remove change listers from stores
        componentWillUnmount() {
            store.emitter.removeChangeListener(this._onChange);
        }

        // Render our child components, passing state via props
        render() {
            return (
                <div>
                    {this.props.children()}
                </div>
            );
        }

        // Method to setState based upon Store changes
        _onChange(v) {
            if (!v) {
                return;
            }
            this.setState(v);
        }
    }

    return DataProvider;
};

export { controlledViewFac };
