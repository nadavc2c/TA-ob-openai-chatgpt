import _ from "lodash";
import React from "react";
import { connect } from "react-redux";
import actions from "app/redux/actions/cimMapping";
import Styles from "./Master.pcssm";
import ErrorBanner from "app/views/common/ErrorBanner.jsx";
import BreadCrumb from "app/views/common/BreadCrumb.jsx";
import ButtonGroup from "./ButtonGroup.jsx";
import CIMModelFieldsPanel from "./CIMModelFieldsPanel.jsx";
import EventTypeFieldsPanel from "./EventTypeFieldsPanel.jsx";
import MappingTablePanel from "./MappingTablePanel.jsx";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

class Root extends React.Component {
    static defaultProps = {
        shouldUpdateFields: true
    };

    static propTypes = {
        pendings: PropTypes.object,
        dispatch: PropTypes.func,

        appInfo: PropTypes.object,
        eventTypeInfo: PropTypes.object,
        shouldUpdateFields: PropTypes.bool,
        eventTypeKnowledgeObjects: PropTypes.object,
        eventTypeFieldValues: PropTypes.object
    };
    constructor(...args) {
        super(...args);
    }
    componentWillMount() {
        const { dispatch, eventTypeInfo, shouldUpdateFields } = this.props;
        dispatch(actions.getAction("CLEAR_ERROR"));
        dispatch(
            actions.getAction("CLEAR_EPIC_STATUS", [
                "CREATE_EVENTTYPE_EVAL$",
                "UPDATE_EVENTTYPE_EVAL$",
                "DELETE_EVENTTYPE_EVAL$",
                "CREATE_EVENTTYPE_ALIAS$",
                "UPDATE_EVENTTYPE_ALIAS$",
                "DELETE_EVENTTYPE_ALIAS$"
            ])
        );
        if (shouldUpdateFields) {
            dispatch(
                actions.getAction("GET_EVENTTYPE_FIELD_VALUES$", {
                    sourcetypes: eventTypeInfo.get("sourcetypes"),
                    search: eventTypeInfo.get("search")
                })
            );
        }
        dispatch(
            actions.getAction("GET_EVENTTYPE_KNOWLEDGE_OBJECTS$", {
                sourcetypes: eventTypeInfo.get("sourcetypes")
            })
        );
    }
    goToSummary() {
        const { dispatch } = this.props;
        dispatch(
            actions.getAction("SET_NAVIGATION", {
                view: "cim-mapping"
            })
        );
    }
    render() {
        const {
            eventTypeKnowledgeObjects,
            eventTypeFieldValues,
            eventTypeInfo
        } = this.props;

        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                <ErrorBanner
                    message={
                        eventTypeKnowledgeObjects.get("error") ||
                            eventTypeFieldValues.get("error")
                    }
                />
                <ButtonGroup />
                <BreadCrumb
                    previousTitle={ _.t("Data Model Mapping") }
                    title={ _.t("Data Model Mapping Details") }
                    helpLinkKey="step_mapcim_detail"
                    StyleOverwrite={ _.pick(Styles, [
                        "breadCrumbHeadWithDescription",
                        "breadCrumbBodyWithDescription"
                    ]) }
                    onPreviousTitleClick={ this.goToSummary }
                >
                    <div className={ Styles.body }>
                        <EventTypeFieldsPanel eventTypeInfo={ eventTypeInfo } />
                        <MappingTablePanel eventTypeInfo={ eventTypeInfo } />
                        <CIMModelFieldsPanel eventTypeInfo={ eventTypeInfo } />
                    </div>
                </BreadCrumb>
            </div>
        );
    }
}

const mapStateToProps = state => {
    return {
        pendings: state.get("pendings"),
        eventTypeKnowledgeObjects: state.get("eventTypeKnowledgeObjects"),
        eventTypeFieldValues: state.get("eventTypeFieldValues")
    };
};

export default connect(mapStateToProps)(Root);
