import React from "react";
import _ from "lodash";
import Styles from "./Layout.pcssm";
import { connect } from "react-redux";
import TitledPanel from "app/views/common/TitledPanel.jsx";
import CIMModels from "./CIMModels.jsx";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import SearchBar from "app/views/common/SearchBar.jsx";
import actions from "app/redux/actions/cimMapping";
import { STATUS } from "app/redux/constant";
import Button from "@splunk/react-ui/Button";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const CIMModelFieldsPanel = ({
    eventTypeInfo,
    applyFilter,
    goToSelectModel,
    pendings
}) => {
    const isPending = pendings.some(status => status === STATUS.PENDING);
    return (
        <div
            className={ Styles.cimModelFieldsPanel }
            { ...createTestHook(__filename) }
        >
            <TitledPanel title={ _.t("Data Model Fields") }>
                <div className={ Styles.button }>
                    <Button
                        onClick={ () => goToSelectModel(eventTypeInfo.toJS()) }
                        disabled={ isPending }
                    >
                        {_.t("Select Data Model(s)...")}
                    </Button>
                </div>
                <div className={ Styles.search }>
                    <SearchBar
                        placeholder={ _.t("Search model fields") }
                        applyFilter={ applyFilter }
                    />
                </div>
                <div className={ Styles.fields }>
                    <LoadingScreen
                        loadCondition={ actions.isActionPending(
                            pendings,
                            "GET_TREE_DATA$"
                        ) }
                    >
                        <CIMModels eventTypeInfo={ eventTypeInfo } />
                    </LoadingScreen>
                </div>
            </TitledPanel>
        </div>
    );
};

CIMModelFieldsPanel.propTypes = {
    eventTypeInfo: PropTypes.object,
    pendings: PropTypes.object,
    applyFilter: PropTypes.func,
    goToSelectModel: PropTypes.func
};
const mapDispatchToProps = dispatch => {
    return {
        applyFilter: searchStr => {
            dispatch(actions.getAction("FILTER_SELECTED_CIM_MODEL", searchStr));
        },
        goToSelectModel: eventTypeInfo => {
            dispatch(
                actions.getAction("SET_NAVIGATION", {
                    view: "cim-mapping",
                    action: "selectModel",
                    params: {
                        eventTypeInfo
                    }
                })
            );
        }
    };
};
const mapStateToProps = state => {
    return {
        pendings: state.get("pendings")
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(
    CIMModelFieldsPanel
);
