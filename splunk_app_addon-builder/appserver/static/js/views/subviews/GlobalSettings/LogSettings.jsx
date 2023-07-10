import _ from "lodash";
import React from "react";
import BaseSettings from "app/views/common/BaseSettings.jsx";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import ControlGroup from "app/components/ControlGroup.jsx";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";

export default class LogSettings extends BaseSettings {
    static defaultProps = BaseSettings.defaultProps;

    static propTypes = BaseSettings.propTypes;

    constructor(...args) {
        super(...args);
    }
    componentWillMount() {
        !this.props.settings.log_level &&
            this.setFieldValueFunc("log_level")(null, { value: "DEBUG" });
    }
    render() {
        const { settings } = this.props;
        return (
            <div style={ { display: "none" } }>
                <AccordionGroup title={ _.t("Logging") } defaultOpen={ true }>
                    {/* fake fields are a workaround for chrome autofill getting the wrong fields */}
                    <input
                        className="fraud-autofill-element"
                        type="text"
                        name="fakeusernameremembered"
                    />
                    <input
                        className="fraud-autofill-element"
                        type="password"
                        name="fakepasswordremembered"
                    />
                    <ControlGroup label={ _.t("Log level") } labelPosition="top">
                        <SingleSelectControl
                            value={ settings.log_level }
                            items={ [
                                { value: "DEBUG", label: "DEBUG" },
                                { value: "INFO", label: "INFO" },
                                { value: "WARNING", label: "WARNING" },
                                { value: "ERROR", label: "ERROR" },
                                { value: "CRITICAL", label: "CRITICAL" }
                            ] }
                            onChange={ this.setFieldValueFunc("log_level") }
                        />
                    </ControlGroup>
                </AccordionGroup>
            </div>
        );
    }
}
