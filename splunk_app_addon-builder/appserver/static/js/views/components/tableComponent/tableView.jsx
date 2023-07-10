import React, { Component } from "react";
import _ from "lodash";
import PropTypes from "prop-types";
import Table from "@splunk/react-ui/Table";
import Link from "@splunk/react-ui/Link";
import Tooltip from "@splunk/react-ui/Tooltip";
import Button from "@splunk/react-ui/Button";
import Switch from "@splunk/react-ui/Switch";
import Warning from "@splunk/react-icons/Warning";
import Immutable from "immutable";
import style from "./defaultTable.pcssm";
import { DEFAULT_SORT, ROWS_PER_PAGE } from "app/views/subviews/Home/homePageConstant";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import { getFormattedMessage } from "app/utils/MessageUtil";

let tableFactory = function(TableConfig, TableColumnMap, actions = []) {
    class TableTemplate extends Component {
        static propTypes = {
            data: PropTypes.object,
            checkboxStatus: PropTypes.bool,
            deleteCandidate: PropTypes.object,
            actions: PropTypes.object,
            sortKey: PropTypes.string,
            handleSortChoice: PropTypes.object,
            isLoading: PropTypes.object
        };

        static defaultProps = {
            data: Immutable.fromJS([]),
            checkboxStatus: true,
            deleteCandidate: new Set(),
            sortKey: DEFAULT_SORT.sortKey,
            isLoading: { status: false, loadingText: "" }
        };
        constructor(...args) {
            super(...args);
            this.CurrentSortDir = "desc";
        }

        handleSort(e, sortKey) {
            this.CurrentSortDir = this.CurrentSortDir === "asc" ? "desc" : "asc";
            this.props.actions.sortTable(sortKey, this.CurrentSortDir);
            this.props.handleSortChoice.setSortChoice({
                sortKey,
                SortDir: this.CurrentSortDir
            });
        }
        render() {
            if (this.props.handleSortChoice) {
                this.CurrentSortDir = this.props.handleSortChoice.getSortChoice().SortDir;
            }
            let data = this.props.data;
            const isCheckboxHidden = this.props.checkboxStatus;
            let deleteCandidate = this.props.deleteCandidate;
            const action_emitter = this.props.actions;
            const compenstaion = [];
            const compenstaionRow = TableColumnMap.map((elem, index) => (
                <Table.Cell key={ index } style={ { height: "33px" } }>
                    {" "}
                </Table.Cell>
            )).concat([
                actions && (
                    <Table.Cell key="action" style={ { height: "33px" } }>
                        {" "}
                    </Table.Cell>
                )
            ]);

            for (let i = data.size; i < ROWS_PER_PAGE; i++) {
                // generate compenstaion row
                compenstaion.push(<Table.Row key={ i + "row" + i }>{compenstaionRow}</Table.Row>);
            }
            return (
                <Table { ...TableConfig } className={ style["tableDefault"] }>
                    <Table.Head className={ style.tableHeader }>
                        {TableColumnMap.map((headData, index) => (
                            <Table.HeadCell
                                style={ { paddingLeft: index ? 0 : 12 } }
                                key={ headData.sortKey }
                                onSort={ e => this.handleSort(e, headData.sortKey) }
                                sortKey={ this.props.sortKey }
                                sortDir={
                                    headData.sortKey === this.props.sortKey
                                        ? this.CurrentSortDir
                                        : "none"
                                }
                            >
                                {headData.label}
                            </Table.HeadCell>
                        )).concat([
                            actions && (
                                <Table.HeadCell className={ style.tableHeader } key="action">
                                    {"Actions"}
                                </Table.HeadCell>
                            )
                        ])}
                    </Table.Head>
                    <Table.Body>
                        <Table.Row key="loading">
                            <Table.Cell style={ { padding: 0 } }>
                                <LoadingScreen
                                    loadCondition={ this.props.isLoading.status }
                                    loadingStyle={ style["loadingStyle"] }
                                    loadingText={ this.props.isLoading.loadingText }
                                />
                            </Table.Cell>
                        </Table.Row>
                        <Table.Row key="emptyRow" />
                        {data.map((row, rowIndex) => (
                            <Table.Row key={ rowIndex } style={ { height: "25px" } }>
                                {TableColumnMap.map(function(elem, index) {
                                    return (
                                        <Table.Cell
                                            key={ index }
                                            style={ { paddingLeft: index ? 0 : 20 } }
                                        >
                                            {index === 0 && !isCheckboxHidden && (
                                                <Switch
                                                    inline={ true }
                                                    value={ deleteCandidate.has(row.get("id")) }
                                                    onClick={ () =>
                                                        action_emitter.toggleDeleteCandidate(
                                                            row.get("id")
                                                        )
                                                    }
                                                    selected={ deleteCandidate.has(row.get("id")) }
                                                    appearance="checkbox"
                                                />
                                            )}
                                            {row.get("icon") && index === 0 && (
                                                <img
                                                    src={ row.get("icon") }
                                                    style={ {
                                                        width: "24px",
                                                        paddingRight: "5px"
                                                    } }
                                                />
                                            )}
                                            <div className={ style["table-cell"] }>
                                                {!_.isFunction(elem.cellContentGenerator) ? (
                                                    <div
                                                        className={ style["table-cell-content"] }
                                                        title={ row.get(elem.sortKey) }
                                                    >
                                                        {_.t(row.get(elem.sortKey) || "")}
                                                    </div>
                                                ) : (
                                                    elem.cellContentGenerator(
                                                        row.get(elem.sortKey),
                                                        ..._.map(elem.ref || [], elem => {
                                                            return row.get(elem);
                                                        }) // allow access other properties
                                                    )
                                                )}
                                            </div>
                                            {elem.sortKey === "version" &&
                                                isCheckboxHidden &&
                                                !!row.get("create_by_builder") &&
                                                !!row.getIn(["upgrade_info", "err_code"]) && (
                                                    <Tooltip content={ getFormattedMessage(80) }>
                                                        <Button
                                                            appearance="pill"
                                                            icon={
                                                                <Warning
                                                                    screenReaderText={ getFormattedMessage(
                                                                        80
                                                                    ) }
                                                                />
                                                            }
                                                            style={ {
                                                                color: "#F8BE34",
                                                                fontSize: 18,
                                                                padding: 4,
                                                                marginLeft: 5,
                                                                pointerEvents: "none"
                                                            } }
                                                        />
                                                    </Tooltip>
                                                )}
                                        </Table.Cell>
                                    );
                                })}
                                {actions && (
                                    <Table.Cell>
                                        <div className={ style["table-cell-link"] }>
                                            {_.map(actions, (elem, index) => (
                                                <span
                                                    key={ "tableCell" + index }
                                                    className={
                                                        style[
                                                            "table-cell-actions" +
                                                                (index ? "" : "-first")
                                                        ]
                                                    }
                                                >
                                                    <Link
                                                        onClick={ e => {
                                                            if (isCheckboxHidden) {
                                                                elem[1](e, row);
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                            }
                                                        } }
                                                        key={ "tableButton" + index }
                                                    >
                                                        {_.t(elem[0])}
                                                    </Link>
                                                </span>
                                            ))}
                                        </div>
                                    </Table.Cell>
                                )}
                            </Table.Row>
                        ))}
                        {compenstaion}
                    </Table.Body>
                </Table>
            );
        }
    }

    return TableTemplate;
};

export { tableFactory };
