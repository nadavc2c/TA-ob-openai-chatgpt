import React from "react";
import _ from "lodash";

import PropTypes from "prop-types";

class alertActionPropertiesComponent extends React.Component {
    static defaultProps = {
        short_name: "",
        uuid: "",
        description: "",
        label: "",
        onPropertiesChange: _.noop,
        errors: {}
    };

    static propTypes = {
        short_name: PropTypes.string,
        uuid: PropTypes.string,
        description: PropTypes.string,
        label: PropTypes.string,
        onPropertiesChange: PropTypes.func,
        errors: PropTypes.object
    };
    constructor(props, context) {
        super(props, context);
    }

    handleLabelInput(e) {
        this.props.onPropertiesChange("label", e.target.value);
    }

    handleInputDescription(e) {
        this.props.onPropertiesChange("description", e.target.value);
    }

    handleInternalNameInput(e) {
        this.props.onPropertiesChange("short_name", e.target.value);
    }

    render() {
        return (
            <div>
                <div className="modularalert-basic-field">
                    <label className="ta-label">
                        <span className="required">*</span>
                        {_.t("Label")}
                    </label>
                    <div className="modularalert-input">
                        <input
                            type="text"
                            className="form-control"
                            name="label"
                            placeholder="Enter a friendly name for the alert action"
                            onChange={ this.handleLabelInput }
                            value={ this.props.label }
                        />
                    </div>
                    <div className="modularalert-input label_error">
                        {this.props.errors.label &&
                            <div className="error_message">
                                <i className="icon-warning-sign" />
                                {this.props.errors.label}
                            </div>}
                    </div>
                </div>
                <div className="modularalert-basic-field">
                    <label className="ta-label">
                        <span className="required">*</span>
                        {_.t("Name")}
                    </label>
                    <div className="modularalert-input">
                        <input
                            type="text"
                            className="form-control"
                            name="short_name"
                            placeholder="Enter an alert action name"
                            onChange={ this.handleInternalNameInput }
                            value={ this.props.short_name }
                            disabled={ this.props.uuid }
                        />
                    </div>
                    <div className="modularalert-input short_name_error">
                        {this.props.errors.short_name &&
                            <div className="error_message">
                                <i className="icon-warning-sign" />
                                {this.props.errors.short_name}
                            </div>}
                    </div>
                </div>
                <div className="modularalert-basic-field">
                    <label className="ta-label">
                        {_.t("Description")}
                    </label>
                    <div className="modularalert-input">
                        <input
                            type="text"
                            className="form-control"
                            name="description"
                            placeholder="Enter a description of the alert action"
                            value={ this.props.description }
                            onChange={ this.handleInputDescription }
                        />
                    </div>
                </div>
            </div>
        );
    }
}

export default alertActionPropertiesComponent;
