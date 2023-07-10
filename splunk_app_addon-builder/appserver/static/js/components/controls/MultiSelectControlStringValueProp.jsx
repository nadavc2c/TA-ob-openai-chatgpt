import _ from "lodash";
import React from "react";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
import Multiselect from '@splunk/react-ui/Multiselect';


export default class MultiSelectControl extends React.Component {
    static defaultProps = {
        allowClear: false,
        value: null,
        onChange: _.noop,
        placeholder: 'select values...',
        disabled: false,
        items: []
    };

    static propTypes = {
        items: PropTypes.array,
        value: PropTypes.string,
        placeholder: PropTypes.string,
        onChange: PropTypes.func,
        disabled: PropTypes.bool
    };
    
    constructor(props) {
        super(props);
        var values_str = this.props.value;
        var values_array = values_str? values_str.split(",") : [];
        this.state = {
            values: values_array
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
