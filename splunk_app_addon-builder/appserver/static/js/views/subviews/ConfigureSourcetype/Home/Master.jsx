import TableRoot from "app/redux/shared/table.jsx";
import {
    outputTableDataSelector,
    pageInfoSelectror
} from "app/redux/shared/tableReselector";
import { connect } from "react-redux";
import Link from "@splunk/react-ui/Link";
import _ from "lodash";
import React from "react";
import actions from "app/redux/actions/sourcetype";

import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
import Styles from "./Master.pcssm";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader.jsx";
import Tooltip from "@splunk/react-ui/Tooltip";
import Button from "@splunk/react-ui/Button";
import Dropdown from "app/views/common/Dropdown";
import Menu from "@splunk/react-ui/Menu";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant";
import classnames from "classnames";
import DeleteModal from "./DeleteModal";

import ErrorBanner from "app/views/common/ErrorBanner.jsx";

const { FMT2LABEL } = Constant;

const mapStateToProps = state => {
    const pendings = state.get("pendings");
    return {
        data: outputTableDataSelector(state),
        tableConfig: state.get("tableData").get("tableConfig"),
        sortCondition: state.get("tableData").get("sortCondition"),
        pageInfo: pageInfoSelectror(state),
        isLoadingTable: actions.isActionPending(
            pendings,
            "GET_SOURCETYPE_BASIC_INFO$"
        ),
        message: state.get("getSourcetypeBasicInfo").get("error")
    };
};
const mapDispatchToProps = dispatch => {
    const tableActions = actions.getSubActions("masterTable");
    return {
        clearEpic: () => dispatch(actions.getAction("CLEAR_EPIC_STATUS")),
        getBasicInfo: appName =>
            dispatch(
                actions.getAction("GET_SOURCETYPE_BASIC_INFO$", {
                    app_name: appName
                })
            ),
        //table action
        setTableConfig: tableConfig =>
            dispatch(tableActions.getAction("TABLE_INIT_MAP", tableConfig)),
        onSortChange: sortKey =>
            dispatch(tableActions.getAction("TABLE_SORT_TAB", { sortKey })),
        onPageChange: currentPage =>
            dispatch(tableActions.getAction("TABLE_SET_PAGE", { currentPage })),
        goToRouter: params =>
            dispatch(actions.getAction("SET_NAVIGATION", params)),
        openDeleteModal: sourcetype => {
            dispatch(actions.getAction("OPEN_DELETE_MODAL", sourcetype));
        }
    };
};
class Root extends React.Component {
    static propTypes = {
        appInfo: PropTypes.object,
        //connect
        isLoadingTable: PropTypes.bool,
        tableConfig: PropTypes.object,
        data: PropTypes.object,
        pageInfo: PropTypes.object,
        filterStr: PropTypes.string,
        sortCondition: PropTypes.object,
        onSortChange: PropTypes.func,
        onPageChange: PropTypes.func,
        onFilterChange: PropTypes.func,
        setTableConfig: PropTypes.func,
        getBasicInfo: PropTypes.func,
        clearEpic: PropTypes.func,
        loadResult: PropTypes.object,
        goToRouter: PropTypes.func,
        message: PropTypes.string,
        openDeleteModal: PropTypes.func
    };
    constructor(props, context) {
        super(props, context);
        const { clearEpic, goToRouter, openDeleteModal } = this.props;
        clearEpic();
        this.state = {
            modalOpen: false,
            format: ""
        };
        const fieldExtractionMapping = [
            {
                sortKey: "name",
                label: _.t("Source Type Name"),
                expression: row => (
                    <div className={ Styles["tableCell"] }>{row.get("name")}</div>
                )
            },
            {
                sortKey: "data_input_name_sortKey",
                label: _.t("Input Name"),
                expression: row => (
                    <div className={ Styles["tableCell"] }>
                        {row.get("data_input_name_sortKey")}
                    </div>
                )
            },
            {
                sortKey: "event_count",
                label: _.t("Events"),
                expression: row => (
                    <div className={ Styles["tableCell"] }>
                        {row.get("event_count")}
                    </div>
                )
            },
            {
                sortKey: "data_format",
                label: _.t("Parsed Format"),
                expression: row => {
                    return (
                        <div className={ Styles["tableCell"] }>
                            {FMT2LABEL[row.get("data_format")]}
                        </div>
                    );
                }
            },
            {
                sortKey: "actions",
                label: _.t("Actions"),
                expression: row => (
                    <div
                        className={ classnames(
                            Styles["linkButton"],
                            Styles["tableCell"]
                        ) }
                    >
                        <span className={ Styles["delimiter"] }>
                            <Link
                                onClick={ event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    goToRouter({
                                        view: "upload-sample",
                                        action: "edit",
                                        params: {
                                            sourcetype: row.get("name"),
                                            confData: row
                                                .get("conf_data")
                                                .toJS()
                                        }
                                    });
                                    return false;
                                } }
                            >
                                {_.t("Edit")}
                            </Link>
                        </span>
                        <span>
                            <Link
                                disabled ={ row.get("data_input_name") ? true : false }
                                onClick={ () => {
                                    openDeleteModal(row.get("name"));
                                } } >
                                { _.t("Delete") }
                            </Link>
                            {
                                row.get("data_input_name")
                                ? <Tooltip
                                content={ _.t(
                                      "You cannot delete this source type as it has a data input."
                                  ) }
                                />
                                : null
                            }
                        </span>
                    </div>
                )
            }
        ];
        const TableConfig = {
            stripeRows: true
        };
        this.props.setTableConfig({
            map: fieldExtractionMapping,
            options: TableConfig,
            rowsPerPage: 10,
            style: {
                paginatorStyle: Styles["paginator"],
                headerCellStyle: Styles["tableHeader"]
            }
        });
        this.reload();
    }

    reload() {
        this.props.getBasicInfo(this.props.appInfo.appName);
    }

    render() {
        const {
            tableConfig,
            data,
            pageInfo,
            sortCondition,
            onSortChange,
            onPageChange,
            isLoadingTable,
            appInfo,
            message,
            goToRouter
        } = this.props;
        const toggle = (
            <Button
                label={ _.t("Add") }
                appearance="primary"
                isMenu
            />
        );

        return (
            <div { ...createTestHook(__filename) }>
                <ErrorBanner message={ message } />
                <HelpLinkHeader
                    title={ _.t("Manage Source Types") }
                    helpLinkKey="step_sourcetype"
                />
                <Dropdown
                    toggle={ toggle }
                    style={ { paddingRight: 20, float: "right" } }
                >
                    <Menu style={ { width: 150 } }>
                        <Menu.Item
                            onClick={ event => {
                                event.preventDefault();
                                event.stopPropagation();
                                goToRouter({
                                    view: "upload-sample",
                                    action: "add"
                                });
                                return false;
                            } }
                        >
                        { _.t("New Source Type") }
                        </Menu.Item>
                        <Menu.Item
                            onClick={ event => {
                                event.preventDefault();
                                event.stopPropagation();
                                goToRouter({
                                    view: "upload-sample",
                                    action: "import"
                                });
                                return false;
                            } }
                        >
                        { _.t("Import From Splunk") }
                        </Menu.Item>
                    </Menu>
                </Dropdown>
                <div style={ { paddingTop: "40px" } }>
                    <TableRoot
                        { ...{
                            tableConfig,
                            data,
                            pageInfo,
                            sortCondition,
                            onSortChange,
                            onPageChange
                        } }
                        isReloadable={ false }
                        isSearchable={ false }
                        isLoading={ isLoadingTable }
                        reload={ this.reload }
                    />
                </div>
                <div className={ Styles["tableSummary"] }>
                    {_.t(
                        `${pageInfo.get("totalRecord")} source types in total`
                    )}
                </div>
                <DeleteModal appName={ appInfo.appName } reload={ this.reload } />
            </div>
        );
    }
}
export default connect(mapStateToProps, mapDispatchToProps)(Root);
