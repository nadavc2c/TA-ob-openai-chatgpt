import React, { Component } from "react";
import SplunkDropdown from "@splunk/react-ui/Dropdown";
import $ from "jquery";
import PropTypes from "prop-types";

class Dropdown extends Component {
    static propTypes = {
        toggle: PropTypes.element,
        style: PropTypes.object,
        children: PropTypes.node
    };

    constructor(props, context) {
        super(props, context);
        this.handleClickAway = this.handleClickAway.bind(this);
    }

    handleClickAway(e) {
        this.dropdown && this.dropdown.handleRequestClose({
            reason: 'clickAway',
            event: e
        });
    }

    componentDidMount() {
        $(document).on('click', this.handleClickAway);
    }

    componentWillUnmount() {
        $(document).off('click', this.handleClickAway);
    }

    render() {
        return(
            <SplunkDropdown
                { ...this.props }
                ref={ (dropdown) => {this.dropdown = dropdown;} }
            />
        );
    }
}

export default Dropdown;