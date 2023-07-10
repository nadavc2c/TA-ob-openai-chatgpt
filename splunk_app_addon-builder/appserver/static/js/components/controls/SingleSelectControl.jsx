import $ from "jquery";
import _ from "lodash";
import React from "react";
import PropTypes from "prop-types";
import SingleSelect from '@splunk/react-ui/Select';
export default class SingleSelectControl extends React.PureComponent {
    static defaultProps = {
        placeholder: "",
        onChange: _.noop,
        disabled: false,
        noMatchText: "No matches found",
        filter: false,
        items: []
    };

    static propTypes = {
        items: PropTypes.array,
        value: PropTypes.string,
        placeholder: PropTypes.string,
        onChange: PropTypes.func,
        disabled: PropTypes.bool,
        noMatchText: PropTypes.string,
        filter: PropTypes.bool,
    };

    constructor(props) {
        super(props);

        this.state = {
            value: this.props.value
        };
    }

    handleChange(e, { value }){
        this.setState((_) => {
            return { value };
        });
        this.props.onChange(e, { value });
    }

    render() {
        const optionNodes = this.props.items.map(
            (item,i) => <SingleSelect.Option label={ item.label } value={ item.value } />
        );
        return (
            <SingleSelect
                defaultValue={ this.props.value }
                filter={ this.props.filter }
                value={ this.state.value }
                placeholder={ this.props.placeholder === "" ? "Select..." : this.props.placeholder }
                noOptionsMessage={ this.props.noMatchText }
                disabled={ this.props.disabled }
                onChange={ this.handleChange }
                style={ { width: "303px" } }
                inline>
                { optionNodes }
            </SingleSelect>
        );
    }
}
