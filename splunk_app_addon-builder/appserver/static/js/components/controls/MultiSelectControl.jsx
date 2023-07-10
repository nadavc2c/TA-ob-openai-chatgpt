import _ from "lodash";
import React from "react";
import PropTypes from "prop-types";
import Multiselect from '@splunk/react-ui/Multiselect';


export default class MultiSelectControl extends React.Component {
    static defaultProps = {
        allowClear: false,
        value: [],
        onChange: _.noop,
        placeholder: 'select values...',
        disabled: false,
        items: []
    };

    static propTypes = {
        items: PropTypes.array,
        value: PropTypes.arrayOf(PropTypes.string),
        placeholder: PropTypes.string,
        onChange: PropTypes.func,
        disabled: PropTypes.bool
    };
    
    constructor(props) {
        super(props);
        this.state = {
            values: this.props.value
        };
    }

    onChange(event, {values}) {
        let new_values = {values};
        this._value = new_values['values'];
        this.setState({
            values: this._value
        });
        this.props.onChange(event, { value: this._value });
        
    }

    render() {
        let optionNodes = this.props.items.map(
            (item,i) => <Multiselect.Option label={ item.label } value={ item.value } />
        );
        return (
                <Multiselect placeholder={ this.props.placeholder } values={ this.state.values } onChange={ this.onChange } inline>
                    { optionNodes }
                </Multiselect>
        );
    }
    
}
