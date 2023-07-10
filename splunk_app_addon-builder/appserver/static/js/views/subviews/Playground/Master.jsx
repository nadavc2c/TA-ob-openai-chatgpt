import React from "react";
import _ from "lodash";
import Styles from "./Master.pcssm";
import Library from "./ComponentLibrary/Library.jsx";
import SharedLibrary from "./ComponentLibrary/SharedLibrary.jsx";
import ComponentEditor from "./ComponentEditor/Master.jsx";
import PropertyEditor from "./PropertyEditor/Master.jsx";
import { IS_NAME_CHANGED } from "./PropertyEditor/forms/Constants";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

export default class Playground extends React.Component {
    static propTypes = {
        isSharedPlayground: PropTypes.bool,
        onGlobalAccountAdd: PropTypes.func,
        onComponentPropsUpdateError: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const { props } = this;
        let componentLibrary;
        if (props.isSharedPlayground) {
            componentLibrary = (
                <SharedLibrary
                    onLibraryItemClick={ this.onLibraryItemClickHandler }
                    { ...props }
                />
            );
        } else {
            componentLibrary = (
                <Library
                    onLibraryItemClick={ this.onLibraryItemClickHandler }
                    { ...props }
                />
            );
        }
        let editorProps = _.cloneDeep(props);
        if (editorProps.editorHeader) {
            editorProps.header = editorProps.editorHeader;
            delete editorProps.editorHeader;
        }
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                {componentLibrary}
                <ComponentEditor
                    ref="componentEditor"
                    onComponentItemClick={ this.onComponentItemClick }
                    onGlobalAccountAdd={ this.onGlobalAccountAdd }
                    { ...editorProps }
                />
                <PropertyEditor
                    ref="propertyEditor"
                    onPropertiesUpdate={ this.onComponentPropsUpdate }
                    onPropertiesUpdateError={ this.onComponentPropsUpdateError }
                    { ...props }
                />
            </div>
        );
    }
    onLibraryItemClickHandler(type) {
        this.refs.componentEditor.addComponent(type);
    }
    onComponentPropsUpdate(...args) {
        this.refs.componentEditor.updateComponentItemProps(...args);
    }
    onComponentPropsUpdateError(...args) {
        this.props.onComponentPropsUpdateError(...args);
    }
    onComponentItemClick(index, props, collection) {
        this.refs.propertyEditor.setState({
            index,
            props,
            collection
        });
    }
    onGlobalAccountAdd(...args) {
        this.props.onGlobalAccountAdd(...args);
    }
    getComponentItems() {
        let items = this.refs.componentEditor.collection.toJSON();
        _.each(items, item => {
            delete item[IS_NAME_CHANGED];
        });
        return items;
    }
    removeGlobalAccount() {
        this.refs.componentEditor.removeGlobalAccount();
    }
}
