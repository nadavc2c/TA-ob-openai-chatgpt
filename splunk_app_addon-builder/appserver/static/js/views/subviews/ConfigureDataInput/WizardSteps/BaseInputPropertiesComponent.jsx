import _ from "lodash";
import $ from "jquery";
import React, { Component } from "react";
import TabLayout from "@splunk/react-ui/TabLayout";
import Immutable from "immutable";
import AccountSettings
    from "app/views/subviews/GlobalSettings/AccountSettings.jsx";
import CustomizedSettings
    from "app/views/subviews/GlobalSettings/CustomizedSettings.jsx";
import LogSettings from "app/views/subviews/GlobalSettings/LogSettings.jsx";
import ProxySettings from "app/views/subviews/GlobalSettings/ProxySettings.jsx";
import {
    convertInputOptionsToParameters,
    convertParametersToInputOptions
} from "app/views/subviews/ConfigureDataInput/DataCollectionUtil";
import { parametersBackwardAdapter } from "app/views/subviews/Playground/Util";
import PropTypes from "prop-types";

const TAB_LAYOUT_STYLES = {
    marginTop: 0,
    width: "100%",
    height: "100%"
};

const TAB_LAYOUT_PANEL_STYLES = {
    width: "100%",
    height: "calc(100% - 26px)",
    overflowY: "auto"
};

const setOptionValue = option => {
    const hasValue = _.has(option, "value");
    const hasDefaultValue = _.has(option, "default_value");
    let isSetDefault = false;
    if (!hasValue) {
        isSetDefault = true;
    } else if (!_.isBoolean(option.value) && !option.value) {
        isSetDefault = true;
    } else if (_.isArray(option.value) && _.isEmpty(option.value)) {
        isSetDefault = true;
    }

    if (isSetDefault && hasDefaultValue) {
        option.value = option.default_value;
    }
};

export default class BaseInputPropertiesComponent extends Component {
    static defaultProps = {
        globalDfd: $.Deferred(),
        onErrorsChange: _.noop
    };

    static propTypes = {
        model: PropTypes.object,
        globalModel: PropTypes.object,
        globalDfd: PropTypes.object,
        onErrorsChange: PropTypes.func
    };

    constructor(...args) {
        super(...args);

        this.isTouchedMap = {};
        this.state = {
            activePanelId: "local",
            globalSettings: Immutable.Map(),
            customizedVarErrors: Immutable.Map(),
            globalSettingsErrors: Immutable.Map()
        };
        this.setLocalSettingsState();
        this.setGlobalSettingsState();
    }
    setLocalSettingsState() {
        //
        const { model } = this.props;
        let settings = {};
        let dataInputOptions = model.get("data_inputs_options") || [];
        let customizedOptions = model.get("customized_options") || [];
        let options = model.get("parameters");
        if (!_.isArray(options)) {
            options = convertInputOptionsToParameters(dataInputOptions);
            if (options.length) {
                this.model.set("parameters", options);
            }
        }
        _.each(customizedOptions, ({ name, value }) => {
            let option = _.find(options, {
                name
            });
            if (option) {
                option.value = value;
            }
        });
        settings.customized_settings = parametersBackwardAdapter(options);
        _.each(settings.customized_settings, setOptionValue);

        let name;
        let accountId = "";
        let hasGlobalAccount = false;
        for (let i = 0; i < dataInputOptions.length; i++) {
            if (dataInputOptions[i].format_type === "global_account") {
                name = dataInputOptions[i].name;
                hasGlobalAccount = true;
                break;
            }
        }
        for (let i = 0; i < customizedOptions.length; ++i) {
            if (customizedOptions[i].name === name) {
                accountId = customizedOptions[i].value;
                break;
            }
        }
        settings.currentAccount = accountId;
        settings.hasGlobalAccount = hasGlobalAccount;

        this.state.localSettings = Immutable.Map(settings);

        return settings;
    }
    setGlobalSettingsState() {
        const { globalModel } = this.props;
        if (globalModel.isFetched) {
            this._setGlobalSettingsState(globalModel);
        } else {
            globalModel.fetch().done(() => {
                this._setGlobalSettingsState(globalModel, true);
                globalModel.isFetched = true;
            });
        }
    }
    getGlobalSettings() {
        return this.state.globalSettings.toJS();
    }
    getDataInputsOptions() {
        const { localSettings } = this.state;
        return convertParametersToInputOptions(
            localSettings.get("customized_settings")
        );
    }
    getCustomizedOptions() {
        const { localSettings } = this.state;
        return _.map(localSettings.get("customized_settings"), setting => {
            return {
                name: setting.name,
                value: setting.format_type === "global_account"
                    ? localSettings.get("currentAccount")
                    : setting.value
            };
        });
    }
    _setGlobalSettingsState(model, isAsync = false) {
        let settings = {};
        let settingEntity;

        settingEntity = model.get("proxy_settings");
        if (settingEntity) {
            let proxy_settings = _.cloneDeep(settingEntity);
            if (!_.has(proxy_settings, "proxy_type")) {
                proxy_settings.proxy_type = "http";
            }
            settings.proxy_settings = proxy_settings;
        }

        settingEntity = model.get("log_settings");
        if (settingEntity) {
            let log_settings = _.cloneDeep(settingEntity);
            settings.log_settings = log_settings;
        }

        settingEntity = model.get("credential_settings");
        if (settingEntity) {
            if (!_.isArray(settingEntity)) {
                //Backward compatible
                settingEntity = _(settingEntity)
                    .toPairs()
                    .map(pair => {
                        return {
                            username: pair[0],
                            password: pair[1].password
                        };
                    })
                    .value();
            }
            model.set("credential_settings", settingEntity);
            let credential_settings = _.cloneDeep(settingEntity);
            if (credential_settings.length === 0) {
                credential_settings.push({
                    username: "",
                    password: ""
                });
            }
            settings.credential_settings = credential_settings;
        }

        settingEntity = model.get("customized_settings");
        if (settingEntity && settingEntity.length) {
            let customized_settings = _.cloneDeep(settingEntity);
            _.each(customized_settings, setOptionValue);
            settings.customized_settings = customized_settings;
        }
        if (isAsync) {
            this.setState({
                globalSettings: Immutable.Map(settings)
            });
        } else {
            /*eslint react/no-direct-mutation-state: 0*/
            this.state.globalSettings = Immutable.Map(settings);
        }
        this.props.globalDfd.resolve();
    }
    getGlobalSettingsComponents() {
        let components = [];
        const { globalSettings, globalSettingsErrors } = this.state;
        if (globalSettings.has("proxy_settings")) {
            components.push(
                <ProxySettings
                    key="global_proxy_settings"
                    settings={ globalSettings.get("proxy_settings") }
                    onChange={ this.onGlobalProxySettingsChange }
                />
            );
        }
        if (globalSettings.has("log_settings")) {
            components.push(
                <LogSettings
                    key="global_log_settings"
                    settings={ globalSettings.get("log_settings") }
                    onChange={ this.onGlobalLogSettingsChange }
                />
            );
        }
        if (globalSettings.has("credential_settings")) {
            components.push(
                <AccountSettings
                    key="global_credential_settings"
                    settings={ globalSettings.get("credential_settings") }
                    onChange={ this.onGlobalAccountSettingsChange }
                />
            );
        }
        if (globalSettings.has("customized_settings")) {
            components.push(
                <CustomizedSettings
                    title={ _.t("Additional Parameters") }
                    defaultOpen={ true }
                    key="global_customized_settings"
                    settings={ globalSettings.get("customized_settings") }
                    errors={ globalSettingsErrors.get("customized_settings") }
                    onChange={ this.onGlobalCustomizedSettingsChange }
                />
            );
        }
        return components;
    }
    onGlobalProxySettingsChange(settings) {
        const { globalSettings } = this.state;
        this.setState({
            globalSettings: globalSettings.set("proxy_settings", settings)
        });
    }
    onGlobalLogSettingsChange(settings) {
        const { globalSettings } = this.state;
        this.setState({
            globalSettings: globalSettings.set("log_settings", settings)
        });
    }
    onGlobalAccountSettingsChange(settings) {
        const { globalSettings, localSettings } = this.state;
        const validSettings = _.filter(settings, row => {
            return row.username && row.password;
        });
        let currentAccount = localSettings.get("currentAccount");
        if (validSettings.length) {
            currentAccount = "account" + (validSettings.length - 1);
        }
        this.setState({
            globalSettings: globalSettings.set("credential_settings", settings),
            localSettings: localSettings.set("currentAccount", currentAccount)
        });
    }
    onGlobalCustomizedSettingsChange(settings) {
        const { globalSettings } = this.state;
        this.changeCustomizedVarError({}, true);
        this.setState({
            globalSettings: globalSettings.set("customized_settings", settings)
        });
    }
    getLocalSettingsComponents() {
        const {
            localSettings,
            globalSettings,
            customizedVarErrors
        } = this.state;
        let components = [];
        components.push(
            <CustomizedSettings
                title={ _.t("Data input parameters") }
                description={ _.t(
                    "Enter a test value for the input parameters you defined in the previous step."
                ) }
                // helpLinkKey='step_datainput'// The Learn more link could be removed by delete this line. Or you could change the id that links to your document.
                isCollapsible={ false }
                key="local_customized_settings"
                settings={ localSettings.get("customized_settings") }
                errors={ customizedVarErrors.toJS() }
                onChange={ this.onLocalCustomizedSettingsChange }
                formatTooltip={ this.formatLocalCustomizeSettingsTooltip }
                currentAccount={ localSettings.get("currentAccount") }
                accountItems={ _(globalSettings.get("credential_settings") || [])
                    .filter(account => {
                        return account.username && account.password;
                    })
                    .map((account, i) => {
                        return {
                            value: account.name || "account" + i,
                            label: account.username
                        };
                    })
                    .value() }
            />
        );
        return components;
    }
    onLocalCustomizedSettingsChange(settings, oriSettings, diff) {
        let { localSettings } = this.state;
        if (diff.format_type === "global_account") {
            localSettings = localSettings.set("currentAccount", diff.value);
        }
        this.setState({
            localSettings: localSettings.set("customized_settings", settings)
        });
        this.changeCustomizedVarError({}, false);
    }
    formatLocalCustomizeSettingsTooltip({ name }) {
        return _.t(
            "Use ${" +
                name +
                "} to reference the value of this parameter in the REST URL, REST headers or REST POST body."
        );
    }
    render() {
        const { state } = this;
        let localSettingsComponents = this.getLocalSettingsComponents();
        let globalSettingsComponents = this.getGlobalSettingsComponents();
        return (
            <TabLayout
                activePanelId={ state.activePanelId }
                style={ TAB_LAYOUT_STYLES }
                onChange={ this.handleTabChange }
            >
                <TabLayout.Panel
                    label={ _.t("Data Input Definition") }
                    panelId="local"
                    style={ TAB_LAYOUT_PANEL_STYLES }
                >
                    {localSettingsComponents}
                </TabLayout.Panel>
                <TabLayout.Panel
                    label={ _.t("Add-on Setup Parameters") }
                    panelId="global"
                    style={ TAB_LAYOUT_PANEL_STYLES }
                >
                    {globalSettingsComponents}
                </TabLayout.Panel>
            </TabLayout>
        );
    }
    handleTabChange(e, data) {
        this.setState({
            activePanelId: data.activePanelId
        });
    }
    changeCustomizedVarError(errors, isGlobalVar) {
        // customized var errors should not disable any buttons
        if (isGlobalVar) {
            let newState = {
                globalSettingsErrors: Immutable.Map({
                    customized_settings: errors
                })
            };
            if (!_.isEmpty(errors)) {
                newState.activePanelId = "global";
            }
            this.setState(newState);
        } else {
            let newState = {
                customizedVarErrors: Immutable.Map(errors)
            };
            if (!_.isEmpty(errors)) {
                newState.activePanelId = "local";
            }
            this.setState(newState);
        }
    }
}
