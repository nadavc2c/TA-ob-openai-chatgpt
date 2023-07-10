import React from "react";
import _ from "lodash";
import LibraryComponent from "./LibraryComponent.jsx";
import { root as ComponentClass } from "./LibraryComponent.pcssm";
import Sortable from "Sortable";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class LibraryComponentList extends React.Component {
    static propTypes = {
        items: PropTypes.arrayOf(
            PropTypes.shape({
                type: PropTypes.string.isRequired,
                title: PropTypes.string
            })
        ),
        onLibraryItemClick: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    componentDidMount() {
        this.createSortableInstance();
    }
    componentWillUnmount() {
        this.removeSortableInstance();
    }
    componentWillUpdate() {
        this.removeSortableInstance();
    }
    componentDidUpdate() {
        this.createSortableInstance();
    }
    createSortableInstance() {
        this.sortableInstance = Sortable.create(this.refs.dragable, {
            group: {
                name: "drag_library",
                pull: "clone",
                put: false
            },
            sort: false,
            handle: "." + ComponentClass,
            animation: 150,
            // Sortable would clone a DOM element each time drag&drop and use this cloned one to replace the original one when dragging ended,
            // which would break the event listening of react components.
            // This callback function is to set the original one back to the position.
            onEnd: event => {
                const { clone, item } = event;
                const parent = clone.parentNode;
                parent.replaceChild(item, clone);
            }
        });
    }
    removeSortableInstance() {
        this.sortableInstance &&
            this.sortableInstance.destroy &&
            this.sortableInstance.destroy();
    }
    render() {
        let componentList = _.map(this.props.items, (item, index) => {
            return (
                <LibraryComponent
                    type={ item.type }
                    title={ item.title }
                    key={ index }
                    onClick={ this.props.onLibraryItemClick }
                />
            );
        });
        return (
            <div
                className="ta-playground-component-list"
                ref="dragable"
                { ...createTestHook(__filename) }
            >
                {componentList}
            </div>
        );
    }
}
