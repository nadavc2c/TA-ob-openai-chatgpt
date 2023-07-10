import React from "react";
import _ from "lodash";
import Backbone from "backbone";
import Styles from "./Master.pcssm";
import Header from "./Header.jsx";
import { root as ComponentClass } from "./items/BaseItem.pcssm";
import * as Factory from "./ItemFactory";
import Sortable from "Sortable";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class ComponentEditor extends React.Component {
    static defaultProps = {
        onComponentItemClick: _.noop
    };

    static propTypes = {
        header: PropTypes.shape({
            text: PropTypes.string,
            icon: PropTypes.string
        }),
        collection: PropTypes.arrayOf(PropTypes.any),
        onComponentItemClick: PropTypes.func,
        onGlobalAccountAdd: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    componentWillMount() {
        const { collection = [] } = this.props;
        this.collection = new Backbone.Collection(collection);
        this.state = {
            items: collection
        };
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
                name: "drag_editor",
                put: ["drag_library", "drag_editor"]
            },
            handle: "." + ComponentClass,
            filter: ".js-remove",
            animation: 150,
            onUpdate: event => {
                const model = this.collection.at(event.oldIndex);
                // Delay the component refresh in case event dispatcher loses target.
                _.delay(() => {
                    this.collection.remove(model);
                    this.collection.add(model, { at: event.newIndex });
                    this.setState({
                        currentComponentName: model.get("name"),
                        items: this.collection.toJSON()
                    });
                });
                this.triggerClick(model);
            },
            onAdd: event => {
                let { item, to, newIndex } = event;
                // Delay the component refresh in case event dispatcher loses target.
                _.delay(() => {
                    this.addComponent(item.getAttribute("data-type"), {
                        at: newIndex
                    });
                });
                if (to.contains(item)) {
                    to.removeChild(item);
                }
            }
        });
    }
    removeSortableInstance() {
        this.sortableInstance &&
            this.sortableInstance.destroy &&
            this.sortableInstance.destroy();
    }
    render() {
        let header = null;
        let bodyClassName = Styles.body;
        if (this.props.header) {
            header = <Header { ...this.props.header } />;
            bodyClassName = Styles.bodySmall;
        }
        let items = _.map(this.state.items, item => {
            let props = _.cloneDeep(item);
            props.onClick = this.onComponentItemClick;
            props.onRemoveClick = this.onComponentItemRemove;
            if (
                this.state.currentComponentName != null &&
                item.name === this.state.currentComponentName
            ) {
                props.isSelected = true;
            }
            return Factory.createComponent(item.type, props);
        });
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                {header}
                <div className={ bodyClassName }>
                    <div className={ Styles.bodyContent } ref="dragable">
                        {items}
                    </div>
                </div>
            </div>
        );
    }
    addComponent(type, options = {}) {
        const collection = this.collection;
        const model = Factory.createModel(collection, type, options);
        if (model) {
            if (model.get("type") === "global_account") {
                this.props.onGlobalAccountAdd();
            }
            this.setState({
                currentComponentName: model.get("name"),
                items: collection.toJSON()
            });
            this.triggerClick(model);
        }
    }
    onComponentItemClick(component) {
        this.setState({
            currentComponentName: component.props.name
        });
        const collection = this.collection;
        const model = collection.findWhere({
            name: component.props.name
        });
        this.triggerClick(model);
    }
    onComponentItemRemove(component) {
        const collection = this.collection;
        collection.remove(
            collection.findWhere({
                name: component.props.name
            })
        );
        this.setState({
            currentComponentName: null,
            items: collection.toJSON()
        });
        this.triggerClick(null);
    }
    triggerClick(model) {
        const collection = this.collection;
        let index = -1;
        let props = null;
        if (model != null) {
            index = collection.indexOf(model);
            props = model.toJSON();
        }
        this.props.onComponentItemClick(index, props, collection.toJSON());
    }
    updateComponentItemProps(index, props) {
        const collection = this.collection;
        const model = collection.at(index);
        model.set(props);
        this.setState({
            currentComponentName: props.name,
            items: collection.toJSON()
        });
    }
    removeGlobalAccount() {
        const collection = this.collection;
        const model = collection.findWhere({
            type: "global_account"
        });
        if (model) {
            collection.remove(model);
            this.setState({
                currentComponentName: null,
                items: collection.toJSON()
            });
            this.triggerClick(null);
        }
    }
}
