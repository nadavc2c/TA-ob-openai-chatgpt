import _ from "lodash";
import React, { Component } from "react";
import AccordionGroup from "app/components/AccordionGroup.jsx";
import Text from "./items/Text.jsx";
import Checkbox from "./items/Checkbox.jsx";
import DropdownList from "./items/DropdownList.jsx";
import MultiDropdownList from "./items/MultiDropdownList.jsx";
import GlobalAccount from "./items/GlobalAccount.jsx";
import Password from "./items/Password.jsx";
import RadioGroup from "./items/RadioGroup.jsx";
import Message from "@splunk/react-ui/Message";
import PropTypes from "prop-types";

const TYPE_TO_COMPONENT = {
    text: Text,
    password: Password,
    dropdownlist: DropdownList,
    multi_dropdownlist: MultiDropdownList,
    global_account: GlobalAccount,
    radio: RadioGroup,
    radiogroup: RadioGroup,
    checkbox: Checkbox
};

export default class CustomizedSettings extends Component {
    static defaultProps = {
        errors: {},
        accountItems: [],
        currentAccount: "",
        onChange: _.noop,
        formatTooltip: _.noop
    };

    static propTypes = {
        settings: PropTypes.array,
        errors: PropTypes.object,
        accountItems: PropTypes.array,
        currentAccount: PropTypes.string,
        onChange: PropTypes.func,
        formatTooltip: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const {
            settings,
            errors,
            formatTooltip,
            accountItems,
            currentAccount
        } = this.props;
        let items = [];
        _.each(settings, (setting, index) => {
            const { format_type, name } = setting;
            const Item = TYPE_TO_COMPONENT[format_type];
            if (Item) {
                let settingToRender = _.cloneDeep(setting);
                if (_.has(errors, name)) {
                    settingToRender.help_string = errors[name];
                    settingToRender.error = true;
                }
                if (format_type === "global_account") {
                    settingToRender.possible_values = accountItems;
                    settingToRender.value = currentAccount;
                }
                items.push(
                    <Item
                        { ...settingToRender }
                        key={ index }
                        index={ index }
                        onChange={ this.onItemValueChange }
                        formatTooltip={ formatTooltip }
                    />
                );
            }
        });
        return (
            <AccordionGroup { ...this.props }>
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
                {items.length
                    ? items
                    : <div>
                          <Message type="info">
                              {_.t("Input variables have not been defined")}
                          </Message>
                      </div>}
            </AccordionGroup>
        );
    }
    onItemValueChange(index, value) {
        let settings = _.cloneDeep(this.props.settings);
        settings[index].value = value;
        this.props.onChange(settings, this.props.settings, settings[index]);
    }
}
