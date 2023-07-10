import _ from "lodash";
import React from "react";
import BaseSettings from "app/views/common/BaseSettings.jsx";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import ControlGroup from "app/components/ControlGroup.jsx";
import Text from "@splunk/react-ui/Text";
import Switch from "@splunk/react-ui/Switch";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";

export default class ProxySettings extends BaseSettings {
    static defaultProps = BaseSettings.defaultProps;

    static propTypes = BaseSettings.propTypes;
    constructor(...args) {
        super(...args);
    }
    render() {
        const { settings } = this.props;
        return (
            <AccordionGroup
                title={ _.t("Proxy") }
                defaultOpen={ !!settings.proxy_enabled }
            >
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
                <ControlGroup label="" labelPosition="top">
                    <Switch
                        selected={ !!settings.proxy_enabled }
                        value="proxy_enabled"
                        onClick={ this.toggleFieldValueFunc("proxy_enabled") }
                    >
                        {_.t("Enable proxy")}
                    </Switch>
                </ControlGroup>
                <ControlGroup label={ _.t("Proxy host") } labelPosition="top">
                    <Text
                        value={ settings.proxy_url || "" }
                        onChange={ this.setFieldValueFunc("proxy_url") }
                    />
                </ControlGroup>
                <ControlGroup label={ _.t("Proxy port") } labelPosition="top">
                    <Text
                        value={ settings.proxy_port || "" }
                        onChange={ this.setFieldValueFunc("proxy_port") }
                    />
                </ControlGroup>
                <ControlGroup label={ _.t("Proxy username") } labelPosition="top">
                    <Text
                        value={ settings.proxy_username || "" }
                        onChange={ this.setFieldValueFunc("proxy_username") }
                    />
                </ControlGroup>
                <ControlGroup label={ _.t("Proxy password") } labelPosition="top">
                    <Text
                        value={ settings.proxy_password || "" }
                        type="password"
                        onChange={ this.setFieldValueFunc("proxy_password") }
                    />
                </ControlGroup>
                <ControlGroup label={ _.t("Proxy type") } labelPosition="top">
                    <SingleSelectControl
                        value={ settings.proxy_type }
                        items={ [
                            { value: "http", label: "http" },
                            { value: "socks4", label: "socks4" },
                            { value: "socks5", label: "socks5" }
                        ] }
                        onChange={ this.setFieldValueFunc("proxy_type") }
                    />
                </ControlGroup>
                <ControlGroup label="" labelPosition="top">
                    <Switch
                        selected={ !!settings.proxy_rdns }
                        value="proxy_rdns"
                        onClick={ this.toggleFieldValueFunc("proxy_rdns") }
                    >
                        {_.t("Remote DNS resolution")}
                    </Switch>
                </ControlGroup>
            </AccordionGroup>
        );
    }
}
