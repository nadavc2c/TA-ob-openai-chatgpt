import React, { Component } from "react";
import _ from "lodash";
import Table from "@splunk/react-ui/Table";
import Paginator from "@splunk/react-ui/Paginator";
import Text from "@splunk/react-ui/Text";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import Style from "./table.pcssm";
import Button from "@splunk/react-ui/Button";
import Rotate from "@splunk/react-icons/Rotate";
import PropTypes from "prop-types";

export default class TableRoot extends Component {
    static defaultProps = {
        isLoading: false,
        reload: _.noop
    };
    static propTypes = {
        isSearchable: PropTypes.bool,
        isReloadable: PropTypes.bool,
        isLoading: PropTypes.bool,
        reload: PropTypes.func,
        tableConfig: PropTypes.object,
        data: PropTypes.object,
        pageInfo: PropTypes.object,
        filterStr: PropTypes.string,
        sortCondition: PropTypes.object,
        onSortChange: PropTypes.func,
        onPageChange: PropTypes.func,
        onFilterChange: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    handleSort(e, { sortKey }) {
        this.props.onSortChange(sortKey);
    }
    handlePageChange(e, { page }) {
        this.props.onPageChange(page);
    }
    handleFilterChange(e, { value }) {
        this.props.onFilterChange(value);
    }
    render() {
        const TableConfig = this.props.tableConfig.get("options").toJS();
        const valueToLabelMap = this.props.tableConfig.get("map").toJS();
        const style = this.props.tableConfig.get("style");
        const { searchStyle, paginatorStyle, headerCellStyle } = style
            ? style.toJS()
            : {};
        const totalPage = this.props.pageInfo.get("totalPage");
        const currentPage = this.props.pageInfo.get("currentPage");
        const tableData = this.props.data;
        const sortKey = this.props.sortCondition.get("sortKey");
        const sortDir = this.props.sortCondition.get("sortDir");
        const compensationCell = new Array(valueToLabelMap.length);
        const compensationRow = new Array(10 - tableData.size);
        const compensationTable = _.fill(
            compensationRow,
            _.fill(compensationCell, " ")
        );
        const isLoading = this.props.isLoading;
        const { isSearchable, isReloadable } = this.props;
        return (
            <div>
                {isSearchable
                    ? <Text
                          className={ searchStyle }
                          inline
                          value={ this.props.filterStr }
                          onChange={ this.handleFilterChange }
                      />
                    : null}
                {isReloadable
                    ? <Button
                          icon={ <Rotate /> }
                          appearance="pill"
                          label={ _.t("Reload Table") }
                          onClick={ this.props.reload }
                          disabled={ this.props.isLoading }
                      />
                    : null}
                <LoadingScreen
                    loadCondition={ isLoading }
                    loadingStyle={ Style["loadingStyle"] }
                    loadingText={ _.t("Loading...") }
                />
                <Table { ...TableConfig } className={ Style["tableDefaultStyle"] }>
                    <Table.Head className={ headerCellStyle }>
                        {valueToLabelMap.map(
                            (headData, index) =>
                                headData.sortKey !== "actions"
                                    ? <Table.HeadCell
                                          key={ index }
                                          style = { { paddingLeft: index ? 0 : 12 } }
                                          width={
                                              headData.width
                                                  ? headData.width
                                                  : null
                                          }
                                          onSort={ this.handleSort }
                                          sortKey={ headData.sortKey }
                                          sortDir={
                                              headData.sortKey === sortKey
                                                  ? sortDir
                                                  : "none"
                                          }
                                      >
                                          {headData.label}
                                      </Table.HeadCell>
                                    : <Table.HeadCell key={ index }>
                                          {headData.label}
                                      </Table.HeadCell>
                        )}
                    </Table.Head>
                    <Table.Body>
                        {tableData.map((row, index) => (
                            <Table.Row key={ index }>
                                {valueToLabelMap.map((cell, index) => (
                                    <Table.Cell
                                        key={ index }
                                        style = { { paddingLeft: index ? 8 : 20 } } >
                                        {cell.expression(row)}
                                    </Table.Cell>
                                ))}
                            </Table.Row>
                        ))}
                        {compensationTable.map((val, index) => (
                            <Table.Row
                                key={ index + "c" }
                                style={ { width: "100%", height: "25px" } }
                            >
                                {val.map((cell, index) => (
                                    <Table.Cell key={ index }>
                                        {cell}
                                    </Table.Cell>
                                ))}
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
                <Paginator
                    className={ paginatorStyle }
                    numPageLinks={ totalPage }
                    onChange={ this.handlePageChange }
                    current={ currentPage }
                    totalPages={ totalPage }
                />
            </div>
        );
    }
}
