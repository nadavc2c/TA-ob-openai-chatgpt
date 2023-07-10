import _ from "lodash";
import React from "react";
import BaseSettings from "app/views/common/BaseSettings.jsx";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import ControlGroup from "app/components/ControlGroup.jsx";
import Text from "@splunk/react-ui/Text";
import Switch from "@splunk/react-ui/Switch";
import ComboBox from "@splunk/react-ui/ComboBox";

/*
    comboBox popover's open status should sync with input blur&focus
    use ref to control it for now, applied to change in the future.
*/
const TIME_FORMAT_CANDIDATE_VALUES = [
    "%Y-%m-%d %H:%M:%S",
    "%d/%m/%y %H:%M",
    "%s"
];

export default class CheckpointSettings extends BaseSettings {
    static defaultProps = BaseSettings.defaultProps;

    static propTypes = BaseSettings.propTypes;
    constructor(...args) {
        super(...args);
    }
    render() {
        const { errors, settings } = this.props;
        let popover = {
            ckpt_source_time_format: null,
            ckpt_target_time_format: null
        };
        return (
            <AccordionGroup
                title={ _.t("Checkpoint settings") }
                description={ _.t(
                    "Use checkpoints for incremental data collection."
                ) }
                helpLinkKey="step_datainput"
                defaultOpen={ !!settings.ckpt_enable }
            >
                <ControlGroup label="" labelPosition="top">
                    <Switch
                        selected={ !!settings.ckpt_enable }
                        value="ckpt_enable"
                        onClick={ this.toggleFieldValueFunc("ckpt_enable") }
                    >
                        {_.t("Enable checkpointing")}
                    </Switch>
                </ControlGroup>
                <ControlGroup
                    required={ true }
                    label={ _.t("\u00a0\u00a0Checkpoint parameter name") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "ckpt_var_name") }
                >
                    <Text
                        disabled={ !settings.ckpt_enable }
                        value={ settings.ckpt_var_name }
                        onChange={ this.setFieldValueFunc("ckpt_var_name") }
                    />
                </ControlGroup>
                <ControlGroup
                    required={ true }
                    label={ _.t("\u00a0\u00a0Checkpoint field path") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "ckpt_json_path_key") }
                >
                    <Text
                        disabled={ !settings.ckpt_enable }
                        value={ settings.ckpt_json_path_key }
                        onChange={ this.setFieldValueFunc("ckpt_json_path_key") }
                    />
                </ControlGroup>
                <ControlGroup
                    required={ true }
                    label={ _.t("\u00a0\u00a0Checkpoint initial value") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "ckpt_initial_value") }
                >
                    <Text
                        disabled={ !settings.ckpt_enable }
                        value={ settings.ckpt_initial_value }
                        onChange={ this.setFieldValueFunc("ckpt_initial_value") }
                    />
                </ControlGroup>
                <ControlGroup
                    label={ _.t("Response timestamp format") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "ckpt_source_time_format") }
                >
                    <ComboBox
                        disabled={ !settings.ckpt_enable }
                        value={ settings.ckpt_source_time_format }
                        onChange={ this.setFieldValueFunc(
                            "ckpt_source_time_format"
                        ) }
                        ref={ function(component) {
                            popover["ckpt_source_time_format"] = component;
                        } }
                        onBlur={ () => {
                            popover["ckpt_source_time_format"].setState({
                                open: false
                            });
                        } }
                    >
                        {this.getTimeFormatOptions()}
                    </ComboBox>
                </ControlGroup>
                <ControlGroup
                    label={ _.t("Request timestamp format") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "ckpt_target_time_format") }
                >
                    <ComboBox
                        disabled={ !settings.ckpt_enable }
                        value={ settings.ckpt_target_time_format }
                        onChange={ this.setFieldValueFunc(
                            "ckpt_target_time_format"
                        ) }
                        ref={ function(component) {
                            popover["ckpt_target_time_format"] = component;
                        } }
                        onBlur={ () => {
                            popover["ckpt_target_time_format"].setState({
                                open: false
                            });
                        } }
                    >
                        {this.getTimeFormatOptions()}
                    </ComboBox>
                </ControlGroup>
            </AccordionGroup>
        );
    }
    getTimeFormatOptions() {
        return _.map(TIME_FORMAT_CANDIDATE_VALUES, (v, i) => (
            <ComboBox.Option key={ i } value={ v } />
        ));
    }
}
