import TableRoot from "app/redux/shared/table.jsx";
import {
    outputTableDataSelector,
    pageInfoSelectror
} from "app/redux/shared/tableReselector";
import { connect } from "react-redux";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader.jsx";
import Link from "@splunk/react-ui/Link";
import { showDialog } from "app/utils/DialogUtil";
import Tooltip from "@splunk/react-ui/Tooltip";
import { getFormattedMessage } from "app/utils/MessageUtil";
import styles from "./Master.pcssm";
import Warning from "@splunk/react-icons/Warning";
import Minus from "@splunk/react-icons/Minus";
import _ from "lodash";
import $ from "jquery";
import React from "react";
import actions from "app/redux/actions/cimMapping";
import classnames from "classnames";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
const ROW_PER_TOOLTIP = 11;
class Root extends React.Component {
    static propTypes = {
        //connect
        isLoading: PropTypes.bool,
        tableConfig: PropTypes.object,
        data: PropTypes.object,
        pageInfo: PropTypes.object,
        filterStr: PropTypes.string,
        isTableLoading: PropTypes.bool,
        sortCondition: PropTypes.object,
        onSortChange: PropTypes.func,
        onPageChange: PropTypes.func,
        onFilterChange: PropTypes.func,
        getEventTypeInfo: PropTypes.func,
        deleteEventtype: PropTypes.func,
        setTableConfig: PropTypes.func,
        getTreeData: PropTypes.func,
        goToRouter: PropTypes.func
    };
    constructor(props, context) {
        super(props, context);
        const edit = (event, model) => {
            event.stopPropagation();
            let modelObj = model.toJS();
            modelObj.model_fullnames = _.reduce(
                modelObj.models,
                (arr, app) => {
                    let names = _.map(app, model => {
                        return model.namespace.join(":");
                    });
                    arr = arr.concat(names);
                    return arr;
                },
                []
            );
            if (!model.get("sourcetypes").size) {
                showDialog({
                    type: "alert",
                    el: $("#alert-modal"),
                    title: "Information",
                    content: getFormattedMessage(5052),
                    btnYesText: _.t("Add"),
                    yesCallback: dialog => {
                        dialog.disableYesBtn();
                        dialog.hideModal();
                        this.props.goToRouter({
                            view: "cim-mapping",
                            action: "edit",
                            params: {
                                eventTypeInfo: {
                                    name: modelObj.name,
                                    search: modelObj.search,
                                    sourcetypes: modelObj.sourcetypes,
                                    model_fullnames: modelObj.model_fullnames,
                                    tags: modelObj.tags,
                                    models: modelObj.models
                                },
                                shouldUpdateFields: true
                            }
                        });
                    }
                });
            } else {
                this.props.goToRouter({
                    view: "cim-mapping",
                    action: "detail",
                    params: {
                        eventTypeInfo: {
                            name: modelObj.name,
                            search: modelObj.search,
                            sourcetypes: modelObj.sourcetypes,
                            model_fullnames: modelObj.model_fullnames,
                            tags: modelObj.tags,
                            models: modelObj.models
                        },
                        shouldUpdateFields: true
                    }
                });
            }
        };

        const del = (event, model) => {
            event.stopPropagation();
            showDialog({
                el: $("#delete-confirm-modal"),
                title: _.t("Deleting an add-on"),
                content: getFormattedMessage(53),
                btnNoText: _.t("Cancel"),
                btnYesText: _.t("Delete"),
                yesCallback: dialog => {
                    dialog.disableYesNo();
                    this.props.deleteEventtype(model.get("name"));
                    dialog.hideModal();
                    return false;
                }
            });
        };
        const cimMappingMapping = [
            {
                sortKey: "name",
                label: _.t("Event Type"),
                expression: function(row) {
                    return (
                        <div className={ styles.content }>{row.get("name")}</div>
                    );
                }
            },
            {
                sortKey: "sourcetypes",
                label: _.t("Source Type"),
                expression: function expression(row) {
                    const sourcetypes = row.get("sourcetypes");
                    const output = sourcetypes.join(",");
                    if (output.length) {
                        return (
                            <div title={ output } className={ styles.content }>
                                {output}
                            </div>
                        );
                    } else {
                        return (
                            <Tooltip content={ _.t(getFormattedMessage(56)) }>
                                <Warning
                                    style={ {
                                        color: "orange"
                                    } }
                                />
                            </Tooltip>
                        );
                    }
                }
            },
            {
                sortKey: "models",
                label: _.t("Data Model Source"),
                expression: function expression(row) {
                    const tags = row.get("tags");
                    const model = row.get("models");
                    const modelNamespace = model.filter(val => {
                        return val.size;
                    });
                    if (tags.size <= 0 && model.size <= 0) {
                        return (
                            <Tooltip content={ _.t(getFormattedMessage(55)) }>
                                <Minus />
                            </Tooltip>
                        );
                    }
                    if (tags.size > 0 && modelNamespace.size <= 0) {
                        return (
                            <Tooltip content={ _.t(getFormattedMessage(5054)) }>
                                <Warning
                                    style={ {
                                        color: "orange"
                                    } }
                                />
                            </Tooltip>
                        );
                    }
                    let modelNamespaceLength = modelNamespace.size;
                    return (
                        <div>
                            {modelNamespace
                                .map((val, key) => {
                                    modelNamespaceLength--;
                                    const len = Math.min(
                                        val.size,
                                        ROW_PER_TOOLTIP
                                    );
                                    val = val
                                        .insert(ROW_PER_TOOLTIP - 1, "...")
                                        .slice(0, len);
                                    return (
                                        <Tooltip
                                            defaultPlacement={ "below" }
                                            key={ modelNamespaceLength }
                                            content={ val.map((val, index) => {
                                                return (
                                                    <div key={ index }>
                                                        {_.isString(val)
                                                            ? val
                                                            : val.get(
                                                                  "display_name"
                                                              )}
                                                    </div>
                                                );
                                            }) }
                                        >
                                            <div
                                                className={ styles["sourceName"] }
                                            >
                                                {key +
                                                    `(${len})${modelNamespaceLength ? "," : ""}`}
                                            </div>
                                        </Tooltip>
                                    );
                                })
                                .toList()}
                        </div>
                    );
                }
            },
            {
                sortKey: "actions",
                label: _.t("Actions"),
                expression: function expression(row) {
                    return (
                        <div className={ styles.actionCell }>
                            <Link
                                onClick={ e => edit(e, row) }
                                className={ styles["actionButton"] }
                            >
                                {_.t("Edit")}
                            </Link>
                            <Link onClick={ e => del(e, row) }>
                                {_.t("Delete")}
                            </Link>
                        </div>
                    );
                }
            }
        ];
        const TableConfig = {
            stripeRows: true
        };
        this.props.setTableConfig({
            map: cimMappingMapping,
            options: TableConfig,
            rowsPerPage: 10,
            style: {
                paginatorStyle: styles["cimMappingPaginator"]
            }
        });
        this.reload();
        this.props.getTreeData();
    }
    reload() {
        this.props.getEventTypeInfo();
    }
    render() {
        const {
            tableConfig,
            data,
            pageInfo,
            filterStr,
            sortCondition,
            onSortChange,
            onPageChange,
            onFilterChange
        } = this.props;
        const { isLoading } = this.props;
        return (
            <div { ...createTestHook(__filename) }>
                <HelpLinkHeader
                    title={ _.t("Data Model Mapping") }
                    helpLinkKey="step_mapcim"
                />
                <div className="clearfix">
                    <button
                        className={ classnames(
                            "btn",
                            "btn-primary",
                            styles.createCimButton
                        ) }
                        onClick={ () =>
                            this.props.goToRouter({
                                view: "cim-mapping",
                                action: "add"
                            }) }
                        disabled={ isLoading }
                        { ...createTestHook(null, {
                            componentName: "ta-btn-new"
                        }) }
                    >
                        {_.t("New Data Model Mapping")}
                    </button>
                </div>
                <TableRoot
                    { ...{
                        tableConfig,
                        data,
                        pageInfo,
                        filterStr,
                        sortCondition,
                        onSortChange,
                        onPageChange,
                        onFilterChange
                    } }
                    isReloadable={ false }
                    isSearchable={ false }
                    isLoading={ isLoading }
                    reload={ this.reload }
                />
            </div>
        );
    }
}

const mapStateToProps = state => {
    const pendings = state.get("pendings");
    return {
        data: outputTableDataSelector(state),
        tableConfig: state.get("tableData").get("tableConfig"),
        sortCondition: state.get("tableData").get("sortCondition"),
        pageInfo: pageInfoSelectror(state),
        filterStr: state.get("tableData").get("filter").get("str"),
        isLoading: actions.isActionPending(pendings, "GET_EVENTTYPE_INFO$") ||
            actions.isActionPending(pendings, "DELETE_EVENTTYPE$")
    };
};
const mapDispatchToProps = dispatch => {
    const tableActions = actions.getSubActions("masterTable");
    return {
        //table action
        setTableConfig: tableConfig =>
            dispatch(tableActions.getAction("TABLE_INIT_MAP", tableConfig)),
        onSortChange: sortKey =>
            dispatch(tableActions.getAction("TABLE_SORT_TAB", { sortKey })),
        onPageChange: currentPage =>
            dispatch(tableActions.getAction("TABLE_SET_PAGE", { currentPage })),
        onFilterChange: value =>
            dispatch(
                tableActions.getAction("TABLE_SET_FILTER", {
                    str: value,
                    fields: new Set(["name"])
                })
            ),
        //cim home
        getEventTypeInfo: () =>
            dispatch(actions.getAction("GET_EVENTTYPE_INFO$")),
        getTreeData: () => dispatch(actions.getAction("GET_TREE_DATA$")),
        deleteEventtype: name =>
            dispatch(actions.getAction("DELETE_EVENTTYPE$", { name })),
        goToRouter: params =>
            dispatch(actions.getAction("SET_NAVIGATION", params))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(Root);
