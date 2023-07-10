import _ from "lodash";
import React, { Component } from "react";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import ValueDefinitionTable from "./ValueDefinitionTable.jsx";
import PropTypes from "prop-types";

export default class AccountSettings extends Component {
    static defaultProps = {
        onChange: _.noop
    };

    static propTypes = {
        settings: PropTypes.array,
        onChange: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const { settings } = this.props;
        return (
            <AccordionGroup
                title={ _.t("Account") }
                defaultOpen={ !!settings.length }
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
                <ValueDefinitionTable
                    rows={ settings }
                    onChange={ this.onTableChange }
                    labelKeyName="username"
                    valueKeyName="password"
                    labelHeadText={ _.t("Username") }
                    valueHeadText={ _.t("Password") }
                    valueTextType="password"
                    buttonText={ _.t("New Account") }
                />
            </AccordionGroup>
        );
    }
    onTableChange(event, { value }) {
        const { onChange } = this.props;
        onChange(value);
    }
}
