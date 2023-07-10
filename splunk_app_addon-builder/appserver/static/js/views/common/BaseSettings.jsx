import _ from "lodash";
import React from "react";
import PropTypes from "prop-types";

export default class BaseSettings extends React.Component {
    static defaultProps = {
        onChange: _.noop,
        errors: {}
    };

    static propTypes = {
        settings: PropTypes.object,
        onChange: PropTypes.func,
        errors: PropTypes.object
    };
    constructor(...args) {
        super(...args);
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
                this.triggerChange(field, !this.props.settings[field]);
            };
            this[`__triggerToggle${field}Value`] = func;
        }
        return func;
    }
    triggerChange(field, value) {
        let settings = _.cloneDeep(this.props.settings);
        settings[field] = value;
        this.props.onChange(settings, this.props.settings, {
            field,
            value
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
}
