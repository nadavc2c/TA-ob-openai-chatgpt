import React from "react";
import _ from "lodash";
import Switch from "@splunk/react-ui/Switch";
import ControlGroup from "app/components/ControlGroup.jsx";
import PropTypes from "prop-types";

export default class Checkbox extends React.Component {
    static propTypes = {
        onChange: PropTypes.func,
        index: PropTypes.number,
        required: PropTypes.bool,
        name: PropTypes.string,
        label: PropTypes.string,
        value: PropTypes.oneOfType([
            PropTypes.bool,
            PropTypes.number,
            PropTypes.string,
            PropTypes.array
        ]),
        help_string: PropTypes.string,
        possible_values: PropTypes.arrayOf(
            PropTypes.shape({
                value: PropTypes.string,
                label: PropTypes.string
            })
        )
    };

    static defaultProps = {
        onChange: _.noop
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const helpHTML = (
            <div style={ { wordWrap: "break-word" } }>
                {this.props.help_string}
            </div>
        );
        return (
            <ControlGroup help={ helpHTML } label="" labelPosition="top">
                <Switch
                    selected={ !!this.props.value }
                    value={ this.props.name }
                    onClick={ this.onClick }
                >
                    {`${this.props.label} (${this.props.name})`}
                </Switch>
            </ControlGroup>
        );
    }
    onClick() {
        const { onChange, index, value } = this.props;
        onChange(index, !value);
    }
}
