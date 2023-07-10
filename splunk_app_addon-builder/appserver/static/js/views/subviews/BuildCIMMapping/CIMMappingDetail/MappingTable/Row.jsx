import _ from "lodash";
import $ from "jquery";
import React from "react";
import { connect } from "react-redux";
import Table from "@splunk/react-ui/Table";
import Style from "./Row.pcssm";
import classnames from "classnames";
import Link from "@splunk/react-ui/Link";
import {
    TABLE_MODE,
    typeMapToLabel,
    getInputContent,
    getActionForDeleting,
    getPayloadForDeleting
} from "./Util";
import { showDialog } from "app/utils/DialogUtil";
import { getFormattedMessage } from "app/utils/MessageUtil";
import actions from "app/redux/actions/cimMapping";
import PropTypes from "prop-types";

class Row extends React.Component {
    static propTypes = {
        index: PropTypes.number,
        knowledgeObjectInfo: PropTypes.object,
        eventTypeInfo: PropTypes.object,
        disableRow: PropTypes.bool,
        dispatch: PropTypes.func
    };

    constructor(...args) {
        super(...args);
    }
    render() {
        const { knowledgeObjectInfo, disableRow } = this.props;
        return (
            <Table.Row>
                <Table.Cell>
                    <span
                        className={ Style.cell }
                        title={ knowledgeObjectInfo.get("sourcetype") }
                    >
                        {knowledgeObjectInfo.get("sourcetype")}
                    </span>
                </Table.Cell>
                <Table.Cell>
                    <span
                        className={ Style.cell }
                        title={ typeMapToLabel[knowledgeObjectInfo.get("type")] }
                    >
                        {typeMapToLabel[knowledgeObjectInfo.get("type")]}
                    </span>
                </Table.Cell>
                <Table.Cell>
                    <span
                        className={ Style.cell }
                        title={ getInputContent(knowledgeObjectInfo) }
                    >
                        {getInputContent(knowledgeObjectInfo)}
                    </span>
                </Table.Cell>
                <Table.Cell>
                    <span
                        className={ Style.cell }
                        title={ knowledgeObjectInfo.get("output_field") }
                    >
                        {knowledgeObjectInfo.get("output_field")}
                    </span>
                </Table.Cell>
                <Table.Cell>
                    <div
                        className={ classnames(
                            Style["linkButton"],
                            Style["tableCell"]
                        ) }
                    >
                        <span className={ Style["delimiter"] }>
                            <Link
                                disabled={ disableRow }
                                onClick={ this.onEditClick }>
                                { _.t("Edit") }
                            </Link>
                        </span>
                        <span>
                            <Link
                                disabled={ disableRow }
                                onClick={ this.onDeleteClick }>
                                { _.t("Delete") }
                            </Link>
                        </span>
                    </div>
                </Table.Cell>
            </Table.Row>
        );
    }
    onEditClick() {
        const { knowledgeObjectInfo, dispatch, index } = this.props;
        dispatch(
            actions.getAction("CLEAR_CURRENT_KNOWLEDGE_OBJECT_FOR_UPDATING")
        );
        dispatch(
            actions.getAction(
                "SET_CURRENT_KNOWLEDGE_OBJECT_FOR_UPDATING",
                knowledgeObjectInfo.merge({
                    index: index
                })
            )
        );
        dispatch(
            actions.getAction(
                "SET_EVENTTYPE_MAPPING_TABLE_MODE",
                TABLE_MODE.UPDATE
            )
        );
    }
    onDeleteClick() {
        const {
            knowledgeObjectInfo,
            eventTypeInfo,
            dispatch,
            index
        } = this.props;
        showDialog({
            el: $("#delete-confirm-modal"),
            title: _.t("Deleting knowledge object"),
            content: getFormattedMessage(2),
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Delete"),
            yesCallback: function() {
                const actionName = getActionForDeleting(knowledgeObjectInfo);
                let payload = getPayloadForDeleting(
                    eventTypeInfo,
                    knowledgeObjectInfo
                );
                payload.index = index;
                dispatch(actions.getAction(actionName, payload));
            }
        });
    }
}

export default connect()(Row);
