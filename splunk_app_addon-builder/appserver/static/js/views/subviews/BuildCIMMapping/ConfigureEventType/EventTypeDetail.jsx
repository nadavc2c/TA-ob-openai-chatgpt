import React from "react";
import _ from "lodash";
import Styles from "./EventTypeDetail.pcssm";
import SearchEventsView from "./SearchEventsView.jsx";
import { connect } from "react-redux";
import Text from "@splunk/react-ui/Text";
import ControlGroup from "app/components/ControlGroup.jsx";
import MultiSelectControl from "app/components/controls/MultiSelectControl.jsx";
import actions from "app/redux/actions/cimMapping";
import { createTestHook } from "app/utils/testSupport";
import SearchBar from "app/components/SearchBar.jsx";

import PropTypes from "prop-types";

class EventTypeDetail extends React.Component {
    static propTypes = {
        currentEventTypeInfo: PropTypes.object,
        currentEventTypeInfoError: PropTypes.object,
        sourcetypesFromConf: PropTypes.object,
        onEventTypeNameChange: PropTypes.func,
        onEventTypeSourcetypesChange: PropTypes.func,
        onEventTypeSearchChange: PropTypes.func,
        pendings: PropTypes.object,
        saveAction: PropTypes.string,
        dispatch: PropTypes.func
    };

    constructor(...args) {
        super(...args);
        this.onSearchClick = _.throttle(this.onSearchClick.bind(this), 500);
    }
    render() {
        const {
            currentEventTypeInfo,
            currentEventTypeInfoError,
            sourcetypesFromConf,
            onEventTypeNameChange,
            onEventTypeSearchChange,
            onEventTypeSourcetypesChange,
            pendings,
            saveAction
        } = this.props;
        let disabled = false;
        if (actions.isActionPending(pendings, saveAction)) {
            disabled = true;
        }
        const errorObj = currentEventTypeInfoError.toJS();

        let itemList;
        let disableSourcetypes = false;
        if (
            actions.isActionPending(pendings, "GET_APP_SOURCETYPES_FROM_CONF$")
        ) {
            disableSourcetypes = true;
            itemList = currentEventTypeInfo.get("sourcetypes");
        } else {
            itemList = sourcetypesFromConf.get("data");
        }
        const sourcetypeItems = _.map(itemList, sourcetype => ({
            value: sourcetype,
            label: sourcetype
        }));
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                <ControlGroup
                    label={ _.t("Enter a name for the event type: ") }
                    labelPosition="top"
                    controlsLayout="fillJoin"
                    { ...this.getErrorProps(errorObj, "name") }
                >
                    <Text
                        value={ currentEventTypeInfo.get("name") }
                        onChange={ onEventTypeNameChange }
                        disabled={ disabled }
                    />
                </ControlGroup>
                <ControlGroup
                    label={ _.t("Select one or more source types: ") }
                    labelPosition="top"
                    controlsLayout="fillJoin"
                    { ...this.getErrorProps(errorObj, "sourcetypes") }
                >
                    <MultiSelectControl
                        value={ currentEventTypeInfo.get("sourcetypes") }
                        onChange={ onEventTypeSourcetypesChange }
                        disabled={ disabled || disableSourcetypes }
                        items={ _.sortBy(sourcetypeItems, ["label"]) }
                    />
                </ControlGroup>
                <ControlGroup
                    label={ _.t("Enter a search: ") }
                    labelPosition="top"
                    controlsLayout="fillJoin"
                    style={ {
                        maxWidth: "100%"
                    } }
                >
                    <SearchBar
                        value={ currentEventTypeInfo.get("search") }
                        onChange={ onEventTypeSearchChange }
                        onSubmit={ this.onSearchClick }
                        disabled={ disabled }
                    />
                </ControlGroup>
                {currentEventTypeInfo.get("searchID")
                    ? <SearchEventsView
                          searchID={ currentEventTypeInfo.get("searchID") }
                      />
                    : null}
            </div>
        );
    }
    getErrorProps(errors, propName) {
        let extraProps = {};
        if (errors[propName]) {
            extraProps.error = true;
            extraProps.help = errors[propName];
        }
        return extraProps;
    }
    onSearchClick() {
        const { currentEventTypeInfo, dispatch } = this.props;

        dispatch(
            actions.getAction(
                "START_EVENTTYPE_SEARCH",
                currentEventTypeInfo.get("search")
            )
        );
    }
}

const mapStateToProps = state => {
    return {
        currentEventTypeInfo: state.get("currentEventTypeInfo"),
        currentEventTypeInfoError: state.get("currentEventTypeInfoError"),
        sourcetypesFromConf: state.get("sourcetypesFromConf"),
        pendings: state.get("pendings")
    };
};

const mapDispatchToProps = dispatch => {
    return {
        onEventTypeNameChange: (event, { value }) => {
            dispatch(
                actions.getAction("SET_CURRENT_EVENTTYPE_INFO", {
                    name: value
                })
            );
        },
        onEventTypeSearchChange: (event, { value }) => {
            dispatch(
                actions.getAction("SET_CURRENT_EVENTTYPE_INFO", {
                    search: value
                })
            );
        },
        onEventTypeSourcetypesChange: (event, { value }) => {
            dispatch(
                actions.getAction("SET_CURRENT_EVENTTYPE_INFO", {
                    sourcetypes: value
                })
            );
        },
        dispatch
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(EventTypeDetail);
