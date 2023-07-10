import _ from "lodash";
import React from "react";
import BaseSettings from "app/views/common/BaseSettings.jsx";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import ControlGroup from "app/components/ControlGroup.jsx";
import Text from "@splunk/react-ui/Text";

export default class CommandSettings extends BaseSettings {
    static defaultProps = BaseSettings.defaultProps;

    static propTypes = BaseSettings.propTypes;
    constructor(...args) {
        super(...args);
    }
    render() {
        const { settings, errors } = this.props;
        return (
            <AccordionGroup
                title={ _.t("Command settings") }
                isCollapsible={ false }
            >
                <ControlGroup
                    label={ _.t("Shell commands") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "command") }
                >
                    <Text
                        value={ settings.command }
                        onChange={ this.setFieldValueFunc("command") }
                        multiline
                    />
                </ControlGroup>
            </AccordionGroup>
        );
    }
}
