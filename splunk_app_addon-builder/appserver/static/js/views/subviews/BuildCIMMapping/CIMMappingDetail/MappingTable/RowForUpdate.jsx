import _ from "lodash";
import React from "react";
import { connect } from "react-redux";
import actions from "app/redux/actions/cimMapping";
import Table from "@splunk/react-ui/Table";
import { typeMapToLabel } from "./Util";
import Text from "@splunk/react-ui/Text";
import {
    TABLE_MODE,
    INPUT_NORMAL_STYLES,
    INPUT_FOCUSED_STYLES,
    getInputContentKey,
    getInputContent,
    getActionForUpdating,
    getPayloadForUpdating,
    getInputPlaceholder,
    getOutputPlaceholder
} from "./Util";
import PropTypes from "prop-types";
import Style from "./Row.pcssm";
import classnames from "classnames";
import Link from "@splunk/react-ui/Link";

class Row extends React.Component {
    static propTypes = {
        index: PropTypes.number,
        pendings: PropTypes.object,
        initialKnowledgeObjectInfo: PropTypes.object,
        eventTypeInfo: PropTypes.object,
        dispatch: PropTypes.func,
        onKnowledgeObjectOutputFieldChange: PropTypes.func,
        onKnowledgeObjectInputContentChange: PropTypes.func,
        onCancelClick: PropTypes.func,
        currentKnowLedgeObjectForUpdating: PropTypes.object
    };
    constructor(...args) {
        super(...args);
    }
    componentWillMount() {
        const { dispatch } = this.props;
        dispatch(actions.getAction("CLEAR_ERROR"));
        dispatch(
            actions.getAction("CLEAR_EPIC_STATUS", [
                "UPDATE_EVENTTYPE_EVAL$",
                "UPDATE_EVENTTYPE_ALIAS$"
            ])
        );
    }
    shouldComponentUpdate(props) {
        const { pendings, dispatch, currentKnowLedgeObjectForUpdating } = props;
        if (
            actions.isActionResolved(
                pendings,
                getActionForUpdating(currentKnowLedgeObjectForUpdating)
            )
        ) {
            dispatch(
                actions.getAction(
                    "SET_EVENTTYPE_MAPPING_TABLE_MODE",
                    TABLE_MODE.VIEW
                )
            );
            return false;
        }
        return true;
    }
    render() {
        const {
            pendings,
            initialKnowledgeObjectInfo,
            onKnowledgeObjectOutputFieldChange,
            onCancelClick,
            currentKnowLedgeObjectForUpdating
        } = this.props;
        let disabled = false;
        if (
            actions.isActionPending(
                pendings,
                getActionForUpdating(currentKnowLedgeObjectForUpdating)
            )
        ) {
            disabled = true;
        }
        let disableSaveBtn = true;
        if (
            currentKnowLedgeObjectForUpdating.get("output_field") &&
            getInputContent(currentKnowLedgeObjectForUpdating)
        ) {
            disableSaveBtn = false;
        }
        return (
            <Table.Row>
                <Table.Cell>
                    {initialKnowledgeObjectInfo.get("sourcetype")}
                </Table.Cell>
                <Table.Cell>
                    {
                        typeMapToLabel[
                            currentKnowLedgeObjectForUpdating.get("type")
                        ]
                    }
                </Table.Cell>
                <Table.Cell>
                    <Text
                        value={ getInputContent(
                            currentKnowLedgeObjectForUpdating
                        ) }
                        placeholder={ getInputPlaceholder(
                            currentKnowLedgeObjectForUpdating
                        ) }
                        onChange={ this.onKnowledgeObjectInputContentChange }
                        disabled={ disabled }
                        style={
                            currentKnowLedgeObjectForUpdating.get(
                                "highlight_input"
                            )
                                ? INPUT_FOCUSED_STYLES
                                : INPUT_NORMAL_STYLES
                        }
                    />
                </Table.Cell>
                <Table.Cell>
                    <Text
                        value={ currentKnowLedgeObjectForUpdating.get(
                            "output_field"
                        ) }
                        placeholder={ getOutputPlaceholder(
                            currentKnowLedgeObjectForUpdating
                        ) }
                        onChange={ onKnowledgeObjectOutputFieldChange }
                        disabled={ disabled }
                        style={
                            currentKnowLedgeObjectForUpdating.get(
                                "highlight_output"
                            )
                                ? INPUT_FOCUSED_STYLES
                                : INPUT_NORMAL_STYLES
                        }
                    />
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
                                disabled={ disabled || disableSaveBtn }
                                onClick={ this.onSaveClick }>
                                { _.t("OK") }
                            </Link>
                        </span>
                        <span>
                            <Link
                                disabled={ disabled }
                                onClick={ onCancelClick }>
                                { _.t("Cancel") }
                            </Link>
                        </span>
                    </div>
                </Table.Cell>
            </Table.Row>
        );
    }
    onSaveClick() {
        const {
            eventTypeInfo,
            initialKnowledgeObjectInfo,
            currentKnowLedgeObjectForUpdating,
            dispatch,
            index
        } = this.props;
        const actionName = getActionForUpdating(
            currentKnowLedgeObjectForUpdating
        );
        const payload = getPayloadForUpdating(
            eventTypeInfo,
            initialKnowledgeObjectInfo,
            currentKnowLedgeObjectForUpdating
        );
        payload.index = index;
        dispatch(actions.getAction(actionName, payload));
    }
    onKnowledgeObjectInputContentChange(event, { value }) {
        const { currentKnowLedgeObjectForUpdating, dispatch } = this.props;
        dispatch(
            actions.getAction("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_UPDATING", {
                [getInputContentKey(currentKnowLedgeObjectForUpdating)]: value
            })
        );
    }
}

const mapStateToProps = state => {
    return {
        pendings: state.get("pendings"),
        currentKnowLedgeObjectForUpdating: state.get(
            "currentKnowLedgeObjectForUpdating"
        )
    };
};
const mapDispatchToProps = dispatch => {
    return {
        onKnowledgeObjectOutputFieldChange: (event, { value }) => {
            dispatch(
                actions.getAction("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_UPDATING", {
                    output_field: value
                })
            );
        },
        onCancelClick: () => {
            dispatch(
                actions.getAction(
                    "SET_EVENTTYPE_MAPPING_TABLE_MODE",
                    TABLE_MODE.VIEW
                )
            );
        },
        dispatch
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(Row);
