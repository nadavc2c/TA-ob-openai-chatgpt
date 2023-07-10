import React from "react";
import _ from "lodash";
import PropTypes from "prop-types";

class BaseInputPropertiesComponent extends React.Component {
    static defaultProps = {
        interval: "30",
        description: "",
        name: "",
        title: "",
        sourcetype: "",
        onPropertiesChange: _.noop,
        errors: {}
    };

    static propTypes = {
        sourcetype: PropTypes.string,
        interval: PropTypes.string,
        description: PropTypes.string,
        name: PropTypes.string,
        title: PropTypes.string,
        onPropertiesChange: PropTypes.func,
        errors: PropTypes.object
    };
    constructor(props, context) {
        super(props, context);

        this.handleLabelInput = this.handleLabelInput.bind(this);
        this.handleInternalNameInput = this.handleInternalNameInput.bind(this);
        this.handleChangeSourceType = this.handleChangeSourceType.bind(this);
        this.handleChangeInterval = this.handleChangeInterval.bind(this);
        this.handleChangeDescription = this.handleChangeDescription.bind(this);
    }

    handleLabelInput(e) {
        const title = e.target.value;
        this.props.onPropertiesChange("title", title);
    }

    handleInternalNameInput(e) {
        this.props.onPropertiesChange("name", e.target.value);
    }

    handleChangeSourceType(e) {
        const sourcetype = e.target.value;
        this.props.onPropertiesChange("sourcetype", sourcetype);
    }

    handleChangeInterval(e) {
        const interval = e.target.value;
        this.props.onPropertiesChange("interval", interval);
    }

    handleChangeDescription(e) {
        this.props.onPropertiesChange("description", e.target.value);
    }

    render() {
        return (
            <div className="ta-setting-details">
                <div className="ta-setting">
                    <div className="ta-label">
                        <span className="required">*</span>
                        {_.t("Source type name:")}
                    </div>
                    <div className="ta-form-input">
                        <input
                            type="text"
                            className="form-control"
                            name="sourcetypeName"
                            placeholder={ _.t("Enter a source type name") }
                            onChange={ this.handleChangeSourceType }
                            value={ this.props.sourcetype }
                        />
                    </div>
                    <div className="ta-sourcetype-error" />
                    {this.props.errors.sourcetype &&
                        <div className="error_message">
                            <i className="icon-warning-sign" />
                            {this.props.errors.sourcetype}
                        </div>}
                </div>
                <div className="ta-setting">
                    <div className="ta-label">
                        <span className="required">*</span>
                        {_.t("Input display name:")}
                    </div>
                    <div className="ta-form-input">
                        <input
                            type="text"
                            className="form-control"
                            name="inputTitle"
                            placeholder={ _.t("Enter an input display name") }
                            onChange={ this.handleLabelInput }
                            value={ this.props.title }
                        />
                    </div>
                    <div className="ta-label-error" />
                    {this.props.errors.title &&
                        <div className="error_message">
                            <i className="icon-warning-sign" />
                            {this.props.errors.title}
                        </div>}
                </div>
                <div className="ta-setting">
                    <div className="ta-label">
                        <span className="required">*</span>
                        {_.t("Input name:")}
                    </div>
                    <div className="ta-form-input">
                        <input
                            type="text"
                            className="form-control"
                            name="inputName"
                            placeholder={ _.t("Enter an input internal name") }
                            onChange={ this.handleInternalNameInput }
                            value={ this.props.name }
                        />
                    </div>
                    <div className="ta-name-error" />
                    {this.props.errors.name &&
                        <div className="error_message">
                            <i className="icon-warning-sign" />
                            {this.props.errors.name}
                        </div>}
                </div>
                <div className="ta-setting">
                    <div className="ta-label">
                        <span className="optional">{_.t("Description:")}</span>
                    </div>
                    <div className="ta-form-input">
                        <textarea
                            className="form-control"
                            name="description"
                            rows="4"
                            placeholder={ _.t("Enter a description") }
                            onChange={ this.handleChangeDescription }
                            value={ this.props.description }
                        />
                    </div>
                </div>
                <div className="ta-setting">
                    <div className="ta-label">
                        <span className="required">*</span>
                        {_.t("Collection interval:")}
                    </div>
                    <div
                        className="ta-form-input"
                        style={ {
                            width: "70px"
                        } }
                    >
                        <input
                            type="text"
                            className="form-control"
                            style={ {
                                width: "50px"
                            } }
                            name="interval"
                            placeholder=""
                            onChange={ this.handleChangeInterval }
                            value={ this.props.interval }
                        />
                    </div>
                    <label
                        className="ta-label"
                        style={ {
                            display: "inline-block",
                            width: "30px"
                        } }
                    >
                        {_.t("seconds")}
                    </label>
                    <div className="ta-interval-error" />
                    {this.props.errors.interval &&
                        <div className="error_message">
                            <i className="icon-warning-sign" />
                            {this.props.errors.interval}
                        </div>}
                </div>
            </div>
        );
    }
}

export default BaseInputPropertiesComponent;
