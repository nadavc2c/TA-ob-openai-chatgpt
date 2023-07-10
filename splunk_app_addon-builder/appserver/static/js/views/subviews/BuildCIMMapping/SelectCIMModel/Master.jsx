import React, { Component } from "react";
import Table from "@splunk/react-ui/Table";
import Link from "@splunk/react-ui/Link";
import _ from "lodash";
import TreeList
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel/TreeList.jsx";
import { connect } from "react-redux";
import SearchBar from "app/views/common/SearchBar.jsx";
import EventTypeColumn
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel/EventTypeColumn.jsx";
import BreadCrumb from "app/views/common/BreadCrumb.jsx";
import style from "./Master.pcssm";
import SelectedModelPanel
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel/SelectedModelPanel.jsx";
import ErrorBanner from "app/views/common/ErrorBanner.jsx";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import actions from "app/redux/actions/cimMapping";
import SaveAndCancel from "app/views/common/SaveAndCancel.jsx";
import Immutable from "immutable";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
import {
    filteredTree,
    filteredSelectedModel
} from "app/redux/reselectors/cimMapping.js";
import {
    unflatString
} from "app/views/subviews/BuildCIMMapping/SelectCIMModel/util";

class Master extends Component {
    static propTypes = {
        eventTypeInfo: PropTypes.object,
        clearTreeStates: PropTypes.func,
        activateAllTreeState: PropTypes.func,
        closeTreeExceptSelected: PropTypes.func,
        cimModelFilter: PropTypes.func,
        eventtypeFilter: PropTypes.func,
        selectedCimModelFilter: PropTypes.func,
        saveSelectedModel: PropTypes.func,
        goToDetail: PropTypes.func,
        clearEpicStatus: PropTypes.func,
        resetModelCandidate: PropTypes.func,

        tableData: PropTypes.object,
        modelCandidates: PropTypes.object,
        modelCandidatesOrigin: PropTypes.object,
        treeData: PropTypes.object,
        pendings: PropTypes.object,
        errorMessage: PropTypes.object
    };

    constructor(props, context) {
        super(props, context);
        this.register = [];
    }
    componentDidUpdate() {
        this.register = _.filter(this.register, func => !func());
    }
    closeAll() {
        this.props.clearTreeStates();
    }
    expandAll() {
        this.props.activateAllTreeState();
    }
    saveSelectedModel() {
        this.register.push(() => {
            const isResolved = actions.isActionResolved(
                this.props.pendings,
                "SAVE_SELECTED_CIM_MODEL$"
            );
            if (isResolved) {
                this.goToDetail();
                this.props.clearEpicStatus("SAVE_SELECTED_CIM_MODEL$");
                return true;
            }
            return false;
        });
        if (
            this.props.modelCandidatesOrigin.equals(this.props.modelCandidates)
        ) {
            this.goToDetail();
            return;
        }
        const selectedModelNamesOrigin = this.props.modelCandidatesOrigin
            .valueSeq()
            .toJS();
        const selectedModelNames = this.props.modelCandidates.valueSeq().toJS();
        this.props.saveSelectedModel({
            eventtype_name: this.props.eventTypeInfo.name,
            new_models: selectedModelNames,
            old_models: selectedModelNamesOrigin
        });
    }
    goToDetail(clear) {
        if (clear) {
            let eventtypeInfo = this.props.eventTypeInfo;
            this.props.resetModelCandidate();
            this.props.goToDetail(eventtypeInfo);
        } else {
            let eventtypeInfo = this.props.eventTypeInfo;
            eventtypeInfo.model_fullnames = _.values(
                this.props.modelCandidates
                    .map(val => val.get("full_name"))
                    .toJS()
            );
            this.props.goToDetail(Immutable.Map(eventtypeInfo));
        }

        return true;
    }
    render() {
        const { pendings } = this.props;
        const isDisabled = actions.isActionPending(
            pendings,
            "SAVE_SELECTED_CIM_MODEL$"
        );
        const isCimSummaryPending = actions.isActionPending(
            pendings,
            "GET_EVENTTYPE_INFO$"
        );
        const isTreeInfoPending = actions.isActionPending(
            pendings,
            "GET_TREE_DATA$"
        );
        const errors = this.props.errorMessage.toList();
        return (
            <div className={ style["root"] } { ...createTestHook(__filename) }>
                {errors.map((val, index) => (
                    <ErrorBanner
                        message={
                            val + ` (error(s) ${index + 1}/${errors.size})`
                        }
                        key={ index }
                    />
                ))}
                <SaveAndCancel
                    btnSaveText={ _.t("Select") }
                    disableSaveBtn={ isDisabled }
                    disableCancelBtn={ isDisabled }
                    onBtnCancelClick={ () => this.goToDetail(true) }
                    onBtnSaveClick={ this.saveSelectedModel }
                />
                <BreadCrumb
                    previousTitle={ _.t("DataModelMapping") }
                    title={ _.t("Select Data Models") }
                    onPreviousTitleClick={ () => this.goToDetail(true) }
                    helpLinkKey="step_mapcim_addmodel"
                >
                    <div className={ style["body"] }>
                        <Table className={ style["fixedLayout"] }>
                            <Table.Head>
                                <Table.HeadCell
                                    className={ style["headerCellSideBar"] }
                                >
                                    {_.t("Event Type Fields")}
                                </Table.HeadCell>
                                <Table.HeadCell
                                    className={ style["headerCellMain"] }
                                >
                                    {_.t("Data Models")}
                                    <span className={ style["tableActionGroup"] }>
                                        <Link
                                            className={ style["actionButton"] }
                                            onClick={ this.expandAll }
                                        >
                                            {_.t("Expand All")}
                                        </Link>
                                        <Link
                                            className={ style["actionButton"] }
                                            onClick={ this.closeAll }
                                        >
                                            {_.t("Close All")}
                                        </Link>
                                        <span className={ style["staticLabel"] }>
                                            {_.t("Select")}
                                        </span>
                                    </span>
                                </Table.HeadCell>
                                <Table.HeadCell
                                    className={ style["headerCellMain"] }
                                >
                                    <div className={ style["flexLableGroup"] }>
                                        <span>
                                            {_.t("Selected Data Models")}
                                        </span>
                                        <span>{_.t("Data Model Fields")}</span>
                                        <span>{_.t("Action")}</span>
                                    </div>
                                </Table.HeadCell>
                            </Table.Head>
                            <Table.Body>
                                <Table.Row key="1">
                                    <Table.Cell
                                        className={ style["sideBarBody"] }
                                    >
                                        <div className={ style["searchBar"] } style = { { marginLeft: 12 } }>
                                            <SearchBar
                                                label="Search Eeventtype values"
                                                placeholder={ _.t(
                                                    "Search event type fields"
                                                ) }
                                                applyFilter={
                                                    this.props.eventtypeFilter
                                                }
                                            />
                                        </div>
                                        <div className={ style.content }>
                                            {!isCimSummaryPending &&
                                                <EventTypeColumn
                                                    selectedEventType={
                                                        this.props.eventTypeInfo
                                                    }
                                                />}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className={ style["mainBody"] }>
                                        <div className={ style["searchBar"] }>
                                            <SearchBar
                                                label="Search CIM Model"
                                                applyFilter={
                                                    this.props.cimModelFilter
                                                }
                                                placeholder={ _.t(
                                                    "Search CIM Model Name"
                                                ) }
                                            />
                                        </div>
                                        <div className={ style.content }>
                                            <TreeList />
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className={ style["mainBody"] }>
                                        <div
                                            className={ style["searchBarEnd"] }
                                        >
                                            <div className={ style["inputBox"] }>
                                                <SearchBar
                                                    label="Search Eeventtype values"
                                                    placeholder={ _.t(
                                                        "Search event type fields"
                                                    ) }
                                                    applyFilter={
                                                        this.props
                                                            .selectedCimModelFilter
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className={ style.content }>
                                            <LoadingScreen
                                                loadCondition={
                                                    isCimSummaryPending ||
                                                        isTreeInfoPending
                                                }
                                            >
                                                <SelectedModelPanel
                                                    selectedEventType={
                                                        this.props.eventTypeInfo
                                                    }
                                                />
                                            </LoadingScreen>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        </Table>
                    </div>
                </BreadCrumb>
            </div>
        );
    }
}
const mapDispatchToProps = dispatch => {
    return {
        goToDetail: eventTypeInfo => {
            dispatch(
                actions.getAction("SET_NAVIGATION", {
                    view: "cim-mapping",
                    action: "detail",
                    params: {
                        eventTypeInfo
                    }
                })
            );
        },
        saveSelectedModel: param => {
            dispatch(actions.getAction("SAVE_SELECTED_CIM_MODEL$", param));
        },
        clearTreeStates: () => {
            dispatch(actions.getAction("CLEAR_TREE_STATE", true));
        },
        activateAllTreeState: () => {
            dispatch(actions.getAction("ACTIVATE_ALL_TREE_STATE"));
        },
        closeTreeExceptSelected: modelCandidates => {
            dispatch(actions.getAction("CLEAR_TREE_STATE", false));
            modelCandidates.forEach((value, key) => {
                let path = {};
                _.assign(path, unflatString(key, "/"));
                Object.keys(path).forEach(key => {
                    dispatch(
                        actions.getAction("SET_TREE_STATE", {
                            key,
                            value: true
                        })
                    );
                });
            });
        },
        cimModelFilter: searchStr => {
            dispatch(actions.getAction("SET_MODEL_FILTER", searchStr));
        },
        eventtypeFilter: searchStr => {
            dispatch(
                actions.getAction("FILTER_EVENTTYPE_FIELD_VALUES", searchStr)
            );
        },
        selectedCimModelFilter: searchStr => {
            dispatch(actions.getAction("FILTER_SELECTED_CIM_MODEL", searchStr));
        },
        resetModelCandidate: () =>
            dispatch(actions.getAction("CLEAR_MODEL_CANDIDATE")),
        clearEpicStatus: () => dispatch(actions.getAction("CLEAR_EPIC_STATUS"))
    };
};
const mapStateToProps = state => {
    return {
        tableData: state.get("tableData"),
        treeData: filteredTree(state),
        modelCandidates: filteredSelectedModel(state),
        modelCandidatesOrigin: state.get("cimModelTree").get("existingModel"),
        pendings: state.get("pendings"),
        errorMessage: state.get("cimModelTreeError")
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Master);
