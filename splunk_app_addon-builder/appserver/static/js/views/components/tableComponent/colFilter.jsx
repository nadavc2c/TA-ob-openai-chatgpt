import React from "react";
import $ from "jquery";
import Text from "@splunk/react-ui/Text";
import Select from "@splunk/react-ui/Select";
import _ from "lodash";
import PropTypes from "prop-types";
/*
 filter actions must named setFilter
*/
class ColFilter extends React.Component {
    static propTypes = {
        mapping: PropTypes.array,
        actions: PropTypes.object
    };
    constructor(...args) {
        super(...args);
        this.state = {
            value: "name"
        };
    }

    handleChange(e, { value }) {
        this.setState({ value });
    }

    render() {
        return (
            <div>
                <Select
                    className="selectButton"
                    value={ this.state.value }
                    onChange={ this.handleChange }
                >
                    {this.props.mapping.map(function(elem, index) {
                        return (
                            <Select.Option
                                onBlur={ () =>
                                    $(".selectButton").find("button").click() }
                                key={ elem.sortKey + index }
                                label={ elem.label }
                                value={ elem.sortKey }
                            />
                        );
                    })}
                </Select>
                <Text
                    inline
                    placeholder={ _.t("Search Add-on") }
                    onChange={ event =>
                        this.props.actions.setFilter(
                            this.state.value,
                            event.target.value
                        ) }
                />
            </div>
        );
    }
}

export default ColFilter;
