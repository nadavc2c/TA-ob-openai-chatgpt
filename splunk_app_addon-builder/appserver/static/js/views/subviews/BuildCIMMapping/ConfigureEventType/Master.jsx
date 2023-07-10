import _ from "lodash";
import React from "react";
import { connect } from "react-redux";
import actions from "app/redux/actions/cimMapping";

import BreadCrumb from "app/views/common/BreadCrumb.jsx";
import SaveAndCancel from "app/views/common/SaveAndCancel.jsx";
import ErrorBanner from "app/views/common/ErrorBanner.jsx";

import EventTypeDetail from "./EventTypeDetail.jsx";
import Immutable from "immutable";
import {
    composeSearchStatement
} from "app/views/subviews/BuildCIMMapping/Util";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

class Root extends React.Component {
    static defaultProps = {
        initialEventTypeInfo: Immutable.Map()
    };

    static propTypes = {
        currentEventTypeInfo: PropTypes.object,
        currentEventTypeInfoError: PropTypes.object,
        sourcetypesFromConf: PropTypes.object,
        pendings: PropTypes.object,
        dispatch: PropTypes.func,

        appInfo: PropTypes.object,
        saveAction: PropTypes.string,
        initialEventTypeInfo: PropTypes.object
    };
    constructor(...args) {
        super(...args);
    }
    componentWillMount() {
        let { dispatch, saveAction, initialEventTypeInfo } = this.props;
        dispatch(actions.getAction("CLEAR_ERROR"));
        dispatch(actions.getAction("CLEAR_EPIC_STATUS", this.props.saveAction));
        dispatch(actions.getAction("CLEAR_CURRENT_EVENTTYPE_INFO"));
        if (
            saveAction !== "CREATE_EVENTTYPE$" &&
            initialEventTypeInfo.get("search") !==
                composeSearchStatement(initialEventTypeInfo.get("sourcetypes"))
        ) {
            initialEventTypeInfo = initialEventTypeInfo.set(
                "isSearchChanged",
                true
            );
        }
        dispatch(
            actions.getAction(
                "SET_CURRENT_EVENTTYPE_INFO",
                initialEventTypeInfo
            )
        );
        dispatch(actions.getAction("GET_APP_SOURCETYPES_FROM_CONF$"));
    }

    shouldComponentUpdate(props) {
        const { pendings } = props;
        if (actions.isActionResolved(pendings, this.props.saveAction)) {
            this.navigateToDetailPage();
            return false;
        }
        return true;
    }
    render() {
        const {
            currentEventTypeInfo,
            currentEventTypeInfoError,
            saveAction,
            pendings
        } = this.props;
        let disableSaveBtn = true;
        if (
            currentEventTypeInfo.get("name") &&
            currentEventTypeInfo.get("search") &&
            (!actions.isActionPending(pendings, saveAction)) &&
            (!actions.isActionPending(
                pendings,
                "GET_APP_SOURCETYPES_FROM_CONF$"
            )) &&
            currentEventTypeInfoError.every(value => !value)
        ) {
            disableSaveBtn = false;
        }
        return (
            <div { ...createTestHook(__filename) }>
                <ErrorBanner message={ currentEventTypeInfo.get("error") } />
                <SaveAndCancel
                    disableSaveBtn={ disableSaveBtn }
                    onBtnCancelClick={ this.navigateToPreviousPage }
                    onBtnSaveClick={ this.saveEventType }
                />
                <BreadCrumb
                    previousTitle={ _.t("Data Model Mapping") }
                    title={ _.t("Define Event Type") }
                    onPreviousTitleClick={ this.navigateToPreviousPage }
                    helpLinkKey="step_mapcim_addevent"
                >

                    <EventTypeDetail saveAction={ this.props.saveAction } />
                </BreadCrumb>

            </div>
        );
    }
    navigateToPreviousPage() {
        const { dispatch, saveAction, initialEventTypeInfo } = this.props;
        if (
            saveAction !== "CREATE_EVENTTYPE$" &&
            initialEventTypeInfo.get("sourcetypes").length
        ) {
            dispatch(
                actions.getAction("SET_NAVIGATION", {
                    view: "cim-mapping",
                    action: "detail",
                    params: {
                        eventTypeInfo: initialEventTypeInfo.toJS(),
                        shouldUpdateFields: false
                    }
                })
            );
        } else {
            dispatch(
                actions.getAction("SET_NAVIGATION", {
                    view: "cim-mapping"
                })
            );
        }
    }
    navigateToDetailPage() {
        const { dispatch, currentEventTypeInfo } = this.props;
        dispatch(
            actions.getAction("SET_NAVIGATION", {
                view: "cim-mapping",
                action: "detail",
                params: {
                    eventTypeInfo: {
                        name: currentEventTypeInfo.get("name"),
                        search: currentEventTypeInfo.get("search"),
                        sourcetypes: currentEventTypeInfo.get("sourcetypes")
                    },
                    shouldUpdateFields: true
                }
            })
        );
    }
    saveEventType() {
        const {
            currentEventTypeInfo,
            initialEventTypeInfo,
            sourcetypesFromConf,
            dispatch
        } = this.props;
        let sourcetypes = {};
        const sourcetypesSelected = currentEventTypeInfo.get("sourcetypes");
        _.each(sourcetypesFromConf.get("data"), sourcetype => {
            sourcetypes[sourcetype] = _.includes(
                sourcetypesSelected,
                sourcetype
            );
        });
        let params = {
            name: currentEventTypeInfo.get("name"),
            search: currentEventTypeInfo.get("search"),
            sourcetypes: sourcetypes
        };
        if (initialEventTypeInfo.size && initialEventTypeInfo.get("name")) {
            params.old_name = initialEventTypeInfo.get("name");
        }
        dispatch(actions.getAction(this.props.saveAction, params));
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

export default connect(mapStateToProps)(Root);
