import React from "react";
import _ from "lodash";
import ControlGroup from "app/components/ControlGroup.jsx";
import PropTypes from "prop-types";

export default class BaseItem extends React.Component {
    static propTypes = {
        onChange: PropTypes.func,
        formatTooltip: PropTypes.func,
        index: PropTypes.number,
        required: PropTypes.bool,
        error: PropTypes.bool,
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
        error: false,
        onChange: _.noop,
        formatTooltip: _.noop
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
        const control = this.renderControl();
        return (
            <ControlGroup
                label={ this.getDisplayLabel() }
                error={ this.props.error }
                help={ helpHTML }
                labelPosition="top"
                required={ this.props.required }
                tooltip={ this.getTooltipText() }
            >
                {control}
            </ControlGroup>
        );
    }
    getDisplayLabel() {
        const { label, name } = this.props;
        return `${label} (${name})`;
    }
    getTooltipText() {
        const { label, name, formatTooltip } = this.props;
        let tooltipText = formatTooltip({
            label,
            name
        });
        tooltipText = tooltipText || "";
        return tooltipText;
    }
    renderControl() {
        throw new Error("This method must be implemented!");
    }
    onValueChange(event, { value }) {
        const { onChange, index } = this.props;
        onChange(index, value);
    }
}
