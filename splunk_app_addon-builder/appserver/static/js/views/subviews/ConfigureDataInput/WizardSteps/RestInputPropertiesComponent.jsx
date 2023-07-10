import _ from "lodash";
import React from "react";
import BaseInputPropertiesComponent from "./BaseInputPropertiesComponent.jsx";
import Immutable from "immutable";
import RestURLSettings from "./LocalSettings/RestURLSettings.jsx";
import EventExtractionSettings
    from "./LocalSettings/EventExtractionSettings.jsx";
import CheckpointSettings from "./LocalSettings/CheckpointSettings.jsx";
import { getFormattedMessage as getMsg } from "app/utils/MessageUtil";
import PropTypes from "prop-types";

const EVT_EXT_FIELDS = ["event_json_path_key"];
const CKPT_NAME_PATTERN = /^[a-zA-Z]\w*$/;
const CKPT_FIELDS = [
    "ckpt_enable",
    "ckpt_var_name",
    "ckpt_json_path_key",
    "ckpt_initial_value",
    "ckpt_source_time_format",
    "ckpt_target_time_format"
];

const extractParametersFromURL = url => {
    const parts = url.split("?");
    if (parts.length < 2 || !parts[1]) {
        //No question mark.
        return [
            {
                name: "",
                value: ""
            }
        ];
    }
    const address = parts[0];
    const parameters = url.substring(address.length + 1).split(/&+/);
    return _(parameters)
        .filter(p => p)
        .map(parameter => {
            const [name] = parameter.split("=");
            const value = parameter.substring(name.length + 1);
            return {
                name,
                value
            };
        })
        .value();
};

const constructURLFromParameters = (oriUrl, parameters) => {
    let baseUrl;
    const parts = oriUrl.split("?");
    if (parts.length < 2) {
        //No question mark.
        baseUrl = oriUrl;
    }
    baseUrl = parts[0];
    if (!parameters.length) {
        return baseUrl;
    }
    baseUrl += "?";
    baseUrl = _.reduce(
        parameters,
        (url, p) => {
            if (!p.name) {
                return url;
            }
            let v = p.value || "";
            url += `${p.name}=${v}&`;
            return url;
        },
        baseUrl
    );
    baseUrl = baseUrl.substring(0, baseUrl.length - 1); //Remove the last & character.
    return baseUrl;
};

export default class RestInputPropertiesComponent
    extends BaseInputPropertiesComponent {
    static defaultProps = _.defaults(
        {
            onJSONPathChange: _.noop
        },
        BaseInputPropertiesComponent.defaultProps
    );

    static propTypes = _.defaults(
        {
            onJSONPathChange: PropTypes.func
        },
        BaseInputPropertiesComponent.propTypes
    );
    constructor(...args) {
        super(...args);

        this.changeHighLight = _.throttle(this.changeHighLight.bind(this), 500);
    }
    setLocalSettingsState() {
        const { model } = this.props;
        let dataInputOptions = model.get("data_inputs_options") || [];

        let settings = BaseInputPropertiesComponent.prototype.setLocalSettingsState.apply(
            this
        );

        let restHeader = [];
        let restParameter = [];
        let restURLSettings = {
            rest_url: "http:\/\/",
            rest_method: "GET",
            use_basic_auth: false
        };
        let eventExtractionSettings = {
            event_json_path_key: ""
        };
        let checkpointSettings = {
            ckpt_enable: false,
            ckpt_var_name: "",
            ckpt_json_path_key: "",
            ckpt_initial_value: "",
            ckpt_source_time_format: "",
            ckpt_target_time_format: ""
        };
        _.each(dataInputOptions, option => {
            const { name, value, type } = option;
            if (name === "_rest_api_url") {
                restURLSettings.rest_url = value;
            } else if (name === "_rest_api_method") {
                restURLSettings.rest_method = value;
            } else {
                if (type !== "customized_var") {
                    if (_.has(option, "rest_header")) {
                        if (option.rest_header) {
                            restHeader.push({
                                name: name,
                                value: value
                            });
                        } else {
                            restParameter.push({
                                name: name,
                                value: value
                            });
                        }
                    }
                }
            }
            if (_.includes(EVT_EXT_FIELDS, type)) {
                eventExtractionSettings[type] = value;
            } else if (_.includes(CKPT_FIELDS, type)) {
                checkpointSettings[type] = value;
            }
        });

        if (!restHeader.length) {
            restHeader.push({
                name: "",
                value: ""
            });
        }
        if (!restParameter.length) {
            restParameter.push({
                name: "",
                value: ""
            });
        }

        let restGetParameter = extractParametersFromURL(
            restURLSettings.rest_url
        );

        _.each([restHeader, restParameter, restGetParameter], list => {
            if (!list.length) {
                list.push({
                    name: "",
                    value: ""
                });
            }
        });
        restURLSettings.rest_headers = restHeader;
        restURLSettings.rest_parameters = restParameter;
        restURLSettings.rest_url_parameters = restGetParameter;

        if (model.has("use_basic_auth") && settings.hasGlobalAccount) {
            restURLSettings.use_basic_auth = model.get("use_basic_auth");
        }

        settings.rest_url_settings = restURLSettings;
        settings.event_extraction_settings = eventExtractionSettings;
        settings.checkpoint_settings = checkpointSettings;

        this.state.localSettings = Immutable.Map(settings);
        this.state.localErrors = Immutable.Map({
            rest_url_errors: {},
            event_extraction_errors: {},
            checkpoint_errors: {}
        });
    }
    getDataInputsOptions() {
        const { localSettings } = this.state;
        let settings;
        settings = localSettings.get("rest_url_settings");
        const method = settings.rest_method;
        let inputOptions = [
            {
                name: "_rest_api_url",
                rest_header: false,
                description: "url",
                value: settings.rest_url
            },
            {
                name: "_rest_api_method",
                rest_header: false,
                description: "method",
                value: method
            }
        ];
        _.each(settings.rest_headers, ({ name, value }) => {
            if (!name && !value) {
                return;
            }
            inputOptions.push({
                name,
                value,
                rest_header: true,
                description: name
            });
        });
        if (method === "POST") {
            _.each(settings.rest_parameters, ({ name, value }) => {
                if (!name && !value) {
                    return;
                }
                inputOptions.push({
                    name,
                    value,
                    rest_header: false,
                    description: name
                });
            });
        }

        settings = localSettings.get("event_extraction_settings");
        _.each(EVT_EXT_FIELDS, f => {
            inputOptions.push({
                type: f,
                name: "_" + f,
                value: settings[f]
            });
        });

        settings = localSettings.get("checkpoint_settings");
        _.each(CKPT_FIELDS, f => {
            inputOptions.push({
                type: f,
                name: "_" + f,
                value: settings[f]
            });
        });

        inputOptions = _.concat(
            inputOptions,
            BaseInputPropertiesComponent.prototype.getDataInputsOptions.apply(
                this
            )
        );
        return inputOptions;
    }
    getUseBaseAuth() {
        return this.state.localSettings.get("rest_url_settings").use_basic_auth;
    }
    getLocalSettingsComponents() {
        const { localSettings, localErrors } = this.state;
        let components = BaseInputPropertiesComponent.prototype.getLocalSettingsComponents.apply(
            this
        );
        components.unshift(
            <RestURLSettings
                key="local_rest_url_settings"
                settings={ localSettings.get("rest_url_settings") }
                errors={ localErrors.get("rest_url_errors") }
                hasGlobalAccount={ localSettings.get("hasGlobalAccount") }
                onChange={ this.onLocalRestURLSettingsChange }
            />
        );
        components.push(
            <EventExtractionSettings
                key="local_event_extraction_settings"
                settings={ localSettings.get("event_extraction_settings") }
                errors={ localErrors.get("event_extraction_errors") }
                onChange={ this.onLocalEventExtractionSettingsChange }
            />
        );
        components.push(
            <CheckpointSettings
                key="local_checkpoint_settings"
                settings={ localSettings.get("checkpoint_settings") }
                errors={ localErrors.get("checkpoint_errors") }
                onChange={ this.onLocalCheckpointSettingsChange }
            />
        );
        return components;
    }
    onLocalRestURLSettingsChange(settings, oriSettings, { field, value }) {
        const { localSettings, localErrors } = this.state;
        this.isTouchedMap[field] = true;
        if (field === "rest_url") {
            settings.rest_url_parameters = extractParametersFromURL(value);
        } else if (field === "rest_url_parameters") {
            settings.rest_url = constructURLFromParameters(
                settings.rest_url,
                value
            );
        }
        const errors = localErrors.set(
            "rest_url_errors",
            this.validateRestURLSettings(settings)
        );
        this.props.onErrorsChange(errors.toJS());
        this.setState({
            localSettings: localSettings.set("rest_url_settings", settings),
            localErrors: errors
        });
    }
    validateRestURLSettings(settings, strict) {
        let errors = {};
        settings =
            settings || this.state.localSettings.get("rest_url_settings");
        const isTouchedMap = this.isTouchedMap;
        let field, value;

        field = "rest_url";
        if (strict || isTouchedMap[field]) {
            value = settings[field];
            if (!value) {
                errors[field] = getMsg(3003);
            }
        }

        field = "rest_headers";
        if (strict || isTouchedMap[field]) {
            value = _.filter(
                settings[field],
                ({ name, value }) => name || value
            );
            let nameMap = {};
            for (let i = 0; i < value.length; ++i) {
                let name = value[i].name;
                if (nameMap[name]) {
                    errors[field] = getMsg(3125, {
                        name: name
                    });
                    break;
                }
                nameMap[name] = true;
            }
        }

        field = "rest_parameters";
        if (strict || isTouchedMap[field]) {
            value = _.filter(
                settings[field],
                ({ name, value }) => name || value
            );
            let nameMap = {};
            for (let i = 0; i < value.length; ++i) {
                let name = value[i].name;
                if (nameMap[name]) {
                    errors[field] = getMsg(3126, {
                        name: name
                    });
                    break;
                }
                nameMap[name] = true;
            }
        }
        return errors;
    }
    changeHighLight(error, field) {
        const { localErrors } = this.state;
        this.props.onJSONPathChange().then(errorDic => {
            let errors;
            if (error === "event_extraction_errors") {
                if (_.isEmpty(errorDic[field])) {
                    errors = localErrors.set(error, {});
                } else {
                    errors = localErrors.set(error, { [field]: getMsg(3021) });
                }
            }
            if (error === "checkpoint_errors") {
                if (_.isEmpty(errorDic[field])) {
                    errors = localErrors;
                } else {
                    errors = localErrors.set(error, { [field]: getMsg(3021) });
                }
            }
            this.setState({
                localErrors: errors
            });
            this.props.onErrorsChange(errors.toJS());
        });
    }
    onLocalEventExtractionSettingsChange(settings, oriSettings, { field }) {
        const { localSettings } = this.state;
        this.setState({
            localSettings: localSettings.set(
                "event_extraction_settings",
                settings
            )
        });
        if (field === "event_json_path_key") {
            _.delay(() =>
                this.changeHighLight(
                    "event_extraction_errors",
                    "event_json_path_key"
                )
            ); // this is necessay which allow check error after content change;
        }
    }
    onLocalCheckpointSettingsChange(settings, oriSettings, { field, value }) {
        const { localSettings, localErrors } = this.state;

        this.isTouchedMap[field] = true;
        if (field === "ckpt_enable" && value && settings.ckpt_var_name) {
            this.isTouchedMap.ckpt_var_name = true;
        }
        if (field === "ckpt_enable" || field === "ckpt_json_path_key") {
            _.delay(() =>
                this.changeHighLight("checkpoint_errors", "ckpt_json_path_key")
            );
        }
        const errors = localErrors.set(
            "checkpoint_errors",
            this.validateCheckpointSettings(settings)
        );
        this.props.onErrorsChange(errors.toJS());
        this.setState({
            localSettings: localSettings.set("checkpoint_settings", settings),
            localErrors: errors
        });
    }
    validateCheckpointSettings(settings, strict) {
        let errors = {};
        settings =
            settings || this.state.localSettings.get("checkpoint_settings");
        const isTouchedMap = this.isTouchedMap;
        if (settings.ckpt_enable) {
            let field, value;

            field = "ckpt_var_name";
            if (isTouchedMap[field] || strict) {
                value = settings[field];
                if (!value) {
                    errors[field] = getMsg(3159);
                } else if (!CKPT_NAME_PATTERN.test(value)) {
                    errors[field] = getMsg(3161);
                }
            }

            field = "ckpt_json_path_key";
            if (isTouchedMap[field] || strict) {
                value = settings[field];
                if (!value) {
                    errors[field] = getMsg(3167);
                }
            }

            field = "ckpt_initial_value";
            if (isTouchedMap[field] || strict) {
                value = settings[field];
                if (!value) {
                    errors[field] = getMsg(3167);
                }
            }

            if (
                (isTouchedMap["ckpt_source_time_format"] &&
                    isTouchedMap["ckpt_target_time_format"]) ||
                strict
            ) {
                if (
                    settings["ckpt_source_time_format"] &&
                    !settings["ckpt_target_time_format"]
                ) {
                    errors["ckpt_target_time_format"] = getMsg(3170);
                }
                if (
                    settings["ckpt_target_time_format"] &&
                    !settings["ckpt_source_time_format"]
                ) {
                    errors["ckpt_source_time_format"] = getMsg(3169);
                }
            }
        }
        return errors;
    }
}
