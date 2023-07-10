import React from "react";
import _ from "lodash";
import { validateProps } from "./ValidateUtil";
import { IS_NAME_CHANGED } from "./Constants";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";
import {
    noInputReservedNamesValidator,
    noSetupReservedNamesValidator
} from "./ValidateUtil";
import PropTypes from "prop-types";
//TODO: Remove state management inside this component.

export default class BasePropertyEditorForm extends React.Component {
    static defaultProps = {
        onChange: _.noop,
        onError: _.noop,
        isSharedPlayground: false
    };

    static propTypes = {
        onChange: PropTypes.func,
        onError: PropTypes.func,
        index: PropTypes.number.isRequired,
        props: PropTypes.object,
        collection: PropTypes.array,
        isSharedPlayground: PropTypes.bool
    };
    constructor(...args) {
        super(...args);
        // initialize the is_internal_name_changed attribute
        let varProperties = _.cloneDeep(this.props.props);
        if (!_.has(varProperties, IS_NAME_CHANGED)) {
            if (_.has(varProperties, "label")) {
                varProperties[IS_NAME_CHANGED] =
                    convertNameToInternalName(varProperties.label) !==
                    varProperties.name;
            } else {
                varProperties[IS_NAME_CHANGED] = false;
            }
        }
        this.state = {
            props: varProperties,
            errors: {}
        };
        this.validatorDefinition = {};
    }
    componentWillReceiveProps(props) {
        this.setState({
            props: props.props,
            errors: {}
        });
    }
    getLabelList() {
        const { props, collection } = this.props;
        return _.without(_.map(collection, "label"), props.label);
    }
    getNameList() {
        const { props, collection } = this.props;
        return _.without(_.map(collection, "name"), props.name);
    }
    getNoReservedNamesValidator() {
        if (this.props.isSharedPlayground) {
            return noSetupReservedNamesValidator();
        } else {
            return noInputReservedNamesValidator();
        }
    }
    triggerChange(field, value) {
        let originalProps = _.cloneDeep(this.state.props);
        let props = _.cloneDeep(originalProps);
        props[field] = value;
        // auto update the name according to the label
        if (!props[IS_NAME_CHANGED] && field === "label") {
            props["name"] = convertNameToInternalName(value);
        }
        if (field === "name") {
            props[IS_NAME_CHANGED] = true;
        }

        const errors = validateProps(this.validatorDefinition, props);
        if (_.size(errors) === 0) {
            this.props.onChange(this.props.index, props);
            this._originalProps = null;
        } else {
            if (!this._originalProps) {
                // The first time error happens, record original props.
                this._originalProps = originalProps;
            }
        }
        this.props.onError(errors);
        this.setState({
            props: props,
            errors: errors
        });
    }
    getErrorProps(errors, propName) {
        let extraProps = {};
        if (errors[propName]) {
            extraProps.error = true;
            extraProps.help = errors[propName];
        }
        return extraProps;
    }
    setFieldValueFunc(field) {
        let func = this[`__triggerSet${field}Value`];
        if (!_.isFunction(func)) {
            func = (event, { value }) => {
                this.triggerChange(field, value);
            };
            this[`__triggerSet${field}Value`] = func;
        }
        return func;
    }
    toggleFieldValueFunc(field) {
        let func = this[`__triggerToggle${field}Value`];
        if (!_.isFunction(func)) {
            func = () => {
                this.triggerChange(field, !this.state.props[field]);
            };
            this[`__triggerToggle${field}Value`] = func;
        }
        return func;
    }
    onBlur() {
        if (this._originalProps) {
            const errors = {};
            const props = this._originalProps;
            this._originalProps = null;
            this.props.onError(errors);
            this.setState({
                props: props,
                errors: errors
            });
        }
    }
}
