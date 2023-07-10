import _ from "lodash";
import Text from "@splunk/react-ui/Text";
import ControlGroup from "app/components/ControlGroup.jsx";
import Button from "@splunk/react-ui/Button";
import React, { Component } from "react";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

class SearchBar extends Component {
    static defaultProps = {
        placeholder: _.t("Please enter any key to search")
    };

    static propTypes = {
        showSearchButton: PropTypes.bool,
        label: PropTypes.string,
        placeholder: PropTypes.string,
        disableSearchButton: PropTypes.bool,
        applyFilter: PropTypes.func
    };
    constructor(props, context) {
        super(props, context);
        this.applyFilter = _.debounce(this.props.applyFilter, 300);
        this.state = { searchStr: "" }; //TODO this will be moved to store when reselect introduced
    }
    componentWillMount() {
        this.applyFilter("");
    }
    render() {
        const { placeholder } = this.props;
        let { searchStr } = this.state;
        const textComponent = (
            <Text
                canClear
                value={ this.state.value }
                placeholder={ placeholder }
                onClick={ searchStr ? this.applyFilter(searchStr) : _.noop }
                onChange={ (e, { value }) => {
                    this.setState({ searchStr: value });
                    this.applyFilter(value);
                } }
            />
        );
        return (
            <div { ...createTestHook(__filename) }>
                {this.props.showSearchButton
                    ? <ControlGroup
                          controlsLayout="fillJoin"
                          label={ _.t(this.props.label) }
                          labelPosition="top"
                      >
                          {textComponent}
                          {!this.props.disableSearchButton &&
                              <Button
                                  label={ _.t("search") }
                                  onClick={ () =>
                                      this.props.applyFilter(searchStr) }
                              />}
                      </ControlGroup>
                    : textComponent}
            </div>
        );
    }
}

export default SearchBar;
