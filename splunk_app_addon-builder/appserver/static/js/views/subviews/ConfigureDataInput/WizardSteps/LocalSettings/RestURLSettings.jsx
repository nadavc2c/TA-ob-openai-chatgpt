import _ from "lodash";
import React from "react";
import BaseSettings from "app/views/common/BaseSettings.jsx";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import ControlGroup from "app/components/ControlGroup.jsx";
import Text from "@splunk/react-ui/Text";
import Switch from "@splunk/react-ui/Switch";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";
import Styles from "./RestURLSettings.pcssm";
import ValueDefinitionTable
    from "app/views/subviews/GlobalSettings/ValueDefinitionTable.jsx";
import PropTypes from "prop-types";

export default class RestURLSettings extends BaseSettings {
    static defaultProps = _.defaults(
        {
            hasGlobalAccount: false
        },
        BaseSettings.defaultProps
    );

    static propTypes = _.defaults(
        {
            hasGlobalAccount: PropTypes.bool
        },
        BaseSettings.propTypes
    );
    constructor(...args) {
        super(...args);
    }
    render() {
        const { settings, errors, hasGlobalAccount } = this.props;
        const isGet = settings.rest_method === "GET";
        let tables = [];
        tables.push(
            <ControlGroup
                key="rest_headers"
                label={ _.t("REST request headers") }
                labelPosition="top"
                { ...this.getErrorProps(errors, "rest_headers") }
                className={ Styles.control }
            >
                <ValueDefinitionTable
                    rows={ settings.rest_headers }
                    onChange={ this.setFieldValueFunc("rest_headers") }
                    labelKeyName="name"
                    valueKeyName="value"
                    labelHeadText={ _.t("Name") }
                    valueHeadText={ _.t("Value") }
                    buttonText={ _.t("New header") }
                />
            </ControlGroup>
        );

        if (isGet) {
            tables.unshift(
                <ControlGroup
                    key="rest_url_parameters"
                    label={ _.t("REST URL parameters") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "rest_url_parameters") }
                    className={ Styles.control }
                >
                    <ValueDefinitionTable
                        rows={ settings.rest_url_parameters }
                        onChange={ this.setFieldValueFunc("rest_url_parameters") }
                        labelKeyName="name"
                        valueKeyName="value"
                        labelHeadText={ _.t("Name") }
                        valueHeadText={ _.t("Value") }
                        buttonText={ _.t("New parameter") }
                    />
                </ControlGroup>
            );
        } else {
            tables.push(
                <ControlGroup
                    key="rest_parameters"
                    label={ _.t("REST request body") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "rest_parameters") }
                    className={ Styles.control }
                >
                    <ValueDefinitionTable
                        rows={ settings.rest_parameters }
                        onChange={ this.setFieldValueFunc("rest_parameters") }
                        labelKeyName="name"
                        valueKeyName="value"
                        labelHeadText={ _.t("Name") }
                        valueHeadText={ _.t("Value") }
                        buttonText={ _.t("New parameter") }
                    />
                </ControlGroup>
            );
        }

        return (
            <AccordionGroup
                title={ _.t("REST settings") }
                // description={ _.t('Specify the configuration settings for the REST request.') } // The description part under this accordion group could be removed by delete this line.
                // helpLinkKey='step_datainput'// The Learn more link could be removed by delete this line. Or you could change the id that links to your document.
                isCollapsible={ false }
            >
                <ControlGroup
                    label={ _.t("REST URL") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "rest_url") }
                    className={ Styles.url }
                >
                    <Text
                        value={ settings.rest_url }
                        onChange={ this.setFieldValueFunc("rest_url") }
                        multiline
                        // onBlur={this.onBlur}
                    />
                </ControlGroup>
                <ControlGroup
                    label={ _.t("REST method") }
                    labelPosition="top"
                    { ...this.getErrorProps(errors, "rest_method") }
                    className={ Styles.method }
                >
                    <SingleSelectControl
                        value={ settings.rest_method }
                        onChange={ this.setFieldValueFunc("rest_method") }
                        items={ [
                            {
                                label: "GET",
                                value: "GET"
                            },
                            {
                                label: "POST",
                                value: "POST"
                            }
                        ] }
                        // onBlur={this.onBlur}
                    />
                </ControlGroup>
                {tables}
                {hasGlobalAccount
                    ? <ControlGroup
                          label=""
                          labelPosition="top"
                          className={ Styles.control }
                      >
                          <Switch
                              selected={ !!settings.use_basic_auth }
                              value="use_basic_auth"
                              onClick={ this.toggleFieldValueFunc(
                                  "use_basic_auth"
                              ) }
                          >
                              {_.t("Enable basic authentication")}
                          </Switch>
                      </ControlGroup>
                    : null}
            </AccordionGroup>
        );
    }
}
