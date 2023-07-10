import _ from "lodash";
import React from "react";
import BaseSettings from "app/views/common/BaseSettings.jsx";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import ControlGroup from "app/components/ControlGroup.jsx";
import Text from "@splunk/react-ui/Text";

export default class EventExtractionSettings extends BaseSettings {
    static defaultProps = BaseSettings.defaultProps;

    static propTypes = BaseSettings.propTypes;
    constructor(...args) {
        super(...args);
    }
    render() {
        const { settings, errors } = this.props;
        return (
            <AccordionGroup
                title={ _.t("Event extraction settings") }
                description={ _.t(
                    "If the response payload is an array, enter the JSON path to the array in the payload to use for breaking the data into individual events."
                ) }
                // helpLinkKey='step_datainput'// The Learn more link could be removed by delete this line. Or you could change the id that links to your document.
                defaultOpen={ !!settings.event_json_path_key }
            >
                <ControlGroup
                    label={ _.t("JSON path") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "event_json_path_key") }
                >
                    <Text
                        value={ settings.event_json_path_key }
                        onChange={ this.setFieldValueFunc("event_json_path_key") }
                    />
                </ControlGroup>
            </AccordionGroup>
        );
    }
}
