import TableRoot from "app/redux/shared/table.jsx";
import {
    outputTableDataSelector,
    pageInfoSelectror
} from "app/redux/shared/tableReselector";
import { connect } from "react-redux";
import Link from "@splunk/react-ui/Link";
import _ from "lodash";
import React from "react";
import actions from "app/redux/actions/fieldExtraction";

import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
import Styles from "./Master.pcssm";
import HelpLinkHeader from "app/components/controls/HelpLinkHeader.jsx";
import Tooltip from "@splunk/react-ui/Tooltip";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant";
import classnames from "classnames";
import { getURLPrefix } from "app/utils/AppInfo";

import LoadingModal from "app/views/common/LoadingModal.jsx";
import AssistantModal from "./AssistantModal";
import DeleteModal from "./DeleteModal";
import MergeConfModal from "./MergeConfModal.jsx";

import ErrorBanner from "app/views/common/ErrorBanner.jsx";

const { FMT2LABEL, CONF_TYPE } = Constant;

const constructUrl = (appName, sourcetype, type) => {
    const url_prefix = getURLPrefix();
    const ns = `/manager/splunk_app_addon-builder/data/${type}/extractions`;
    const full_url = `${url_prefix}${ns}?ns=${appName}&pwnr=-&search=${sourcetype}&count=25`;
    return full_url;
};

const mapStateToProps = state => {
    const pendings = state.get("pendings");
    return {
        data: outputTableDataSelector(state),
        tableConfig: state.get("tableData").get("tableConfig"),
        sortCondition: state.get("tableData").get("sortCondition"),
        pageInfo: pageInfoSelectror(state),
        loadResult: state.get("getSourcetypeBasicInfo").get("result"),
        isLoadingTable: actions.isActionPending(
            pendings,
            "GET_SOURCETYPE_BASIC_INFO$"
        ),
        readyToNavigate: _.some(
            [
                "LOAD_PARSE_RESULT_FMT_UNSTRUCTURED$",
                "LOAD_PARSE_RESULT_FMT_KV$",
                "LOAD_PARSE_RESULT_FMT_TABLE$",
                "LOAD_PARSE_RESULT_GET_EVENT$"
            ],
            val => actions.isActionResolved(pendings, val)
        ),
        message: state.get("getSourcetypeBasicInfo").get("error")
    };
};
const mapDispatchToProps = dispatch => {
    const tableActions = actions.getSubActions("masterTable");
    return {
        checkFeAvailable: (appName, row) => dispatch(actions.getAction("CHECK_FE_AVAILABLE$", {
            app_name: appName,
            row: row.toJS()
        })),
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
        parseData: (format, sourcetype, appName) => {
            dispatch(
                actions.getAction("GET_PARSE_RESULT", {
                    format,
                    data: {
                        app_name: appName,
                        sourcetype: sourcetype
                    }
                })
            );
        },
        loadData: (format, sourcetype, appName) => {
            dispatch(
                actions.getAction("LOAD_PARSE_RESULT", {
                    format,
                    data: {
                        app_name: appName,
                        sourcetype: sourcetype,
                        isEditMode: true
                    }
                })
            );
        },
        goToRouter: params =>
            dispatch(actions.getAction("SET_NAVIGATION", params)),
        openAssistantModal: row => {
            dispatch(actions.getAction("OPEN_MODAL", row));
        },
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
        isTableLoading: PropTypes.bool,
        sortCondition: PropTypes.object,
        onSortChange: PropTypes.func,
        onPageChange: PropTypes.func,
        onFilterChange: PropTypes.func,
        setTableConfig: PropTypes.func,
        getBasicInfo: PropTypes.func,
        parseData: PropTypes.func,
        loadData: PropTypes.func,
        clearEpic: PropTypes.func,
        readyToNavigate: PropTypes.bool,
        loadResult: PropTypes.object,
        goToRouter: PropTypes.func,
        openAssistantModal: PropTypes.func,
        message: PropTypes.string,
        openDeleteModal: PropTypes.func,
        checkFeAvailable: PropTypes.func,
    };
    constructor(props, context) {
        super(props, context);
        const {
            clearEpic,
            appInfo,
            checkFeAvailable,
            openDeleteModal,
        } = this.props;
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
                sortKey: "event_count",
                label: _.t("Events"),
                expression: row => (
                    <div className={ Styles["tableCell"] }>
                        {
                            row.get("event_count")
                        }
                    </div>
                )
            },
            {
                sortKey: "data_format_sortKey",
                label: _.t("Parsed Format"),
                expression: row => {
                    return (
                        <div className={ Styles["tableCell"] }>
                            {
                                FMT2LABEL[row.get("data_format_sortKey")]
                            }
                        </div>
                    );
                }
            },
            {
                sortKey: "actions",
                label: _.t("Actions"),
                expression: row =>
                    !row.get("is_parsed")
                        ? <div
                              className={ classnames(
                                  Styles["linkButton"],
                                  Styles["tableCell"]
                              ) }
                          >
                              <span className={ Styles["delimiter"] }>
                                  <Link
                                      onClick={ () => {
                                        checkFeAvailable(appInfo.appName, row);
                                      } }
                                      disabled={
                                          row.get("event_count") ? false : true
                                      }
                                  >
                                      { _.t("Assisted Extraction") }
                                  </Link>
                                  {
                                      row.get("event_count")
                                      ? null
                                      : <Tooltip content = { _.t("Assisted mode is disabled when there are no events") } />
                                  }
                              </span>
                              <span className={ Styles["delimiter"] }>
                                  <Link
                                      to={ constructUrl(
                                          appInfo.appName,
                                          row.get("name"),
                                          CONF_TYPE.PROPS
                                      ) }
                                      openInNewContext
                                  >
                                      {_.t("Manual Extraction")}
                                  </Link>
                              </span>
                              <span>
                                  <Link
                                      to={ constructUrl(
                                          appInfo.appName,
                                          row.get("name"),
                                          CONF_TYPE.TRANSFORMS
                                      ) }
                                      openInNewContext
                                  >
                                      {_.t("Manual Transformation")}
                                  </Link>
                              </span>
                          </div>
                        : <div
                              className={ classnames(
                                  Styles["linkButton"],
                                  Styles["tableCell"]
                              ) }
                          >
                              <span className={ Styles["delimiter"] }>
                                  <Link
                                      onClick={ () => {
                                          this.setState({
                                              format: row.get("data_format"),
                                              currentSourceType: row.get(
                                                  "name"
                                              ),
                                              LoadingModalOpen: true
                                          });
                                          this.props.loadData(
                                              row.get("data_format"),
                                              row.get("name"),
                                              appInfo.appName
                                          );
                                      } }
                                  >
                                      {_.t("Edit Assisted Extraction")}
                                  </Link>
                              </span>
                              <span>
                                  <Link
                                      onClick={ () => {
                                          openDeleteModal(row.get("name"));
                                      } }
                                  >
                                      {_.t("Delete Assisted Extraction")}
                                  </Link>
                              </span>
                          </div>
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
    shouldComponentUpdate(nextProps, nextState) {
        if (
            !this.props.readyToNavigate &&
            nextProps.readyToNavigate &&
            nextProps.loadResult
        ) {
            nextProps.goToRouter({
                view: "field-extraction",
                action: nextState.format,
                params: {
                    sourcetype: nextState.currentSourceType,
                    data: nextProps.loadResult.toJS(),
                    isEditMode: true
                }
            });
            return false;
        }
        return true;
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
            message
        } = this.props;
        return (
            <div { ...createTestHook(__filename) }>
                <ErrorBanner message={ message } />
                <HelpLinkHeader
                    title={ _.t("Field Extraction") }
                    helpLinkKey="step_fieldextraction"
                />
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
                <AssistantModal appName={ appInfo.appName } />
                <DeleteModal appName={ appInfo.appName } reload={ this.reload } />
                <LoadingModal open={ this.state.LoadingModalOpen } />
                <MergeConfModal appName={ appInfo.appName } />
            </div>
        );
    }
}
export default connect(mapStateToProps, mapDispatchToProps)(Root);
