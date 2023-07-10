import _ from "lodash";
import React from "react";
import { connect } from "react-redux";
import actions from "app/redux/actions/cimMapping";
import Table from "@splunk/react-ui/Table";
import { typeMapToLabel } from "./Util";
import MultiSelectControl from "app/components/controls/MultiSelectControl.jsx";
import Text from "@splunk/react-ui/Text";
import Style from "./Row.pcssm";
import classnames from "classnames";
import Link from "@splunk/react-ui/Link";
import {
    TABLE_MODE,
    INPUT_NORMAL_STYLES,
    INPUT_FOCUSED_STYLES,
    getInputContentKey,
    getInputContent,
    getActionForCreating,
    getPayloadForCreating,
    getInputPlaceholder,
    getOutputPlaceholder
} from "./Util";
import PropTypes from "prop-types";

class Row extends React.Component {
    static propTypes = {
        pendings: PropTypes.object,
        eventTypeInfo: PropTypes.object,
        dispatch: PropTypes.func,
        onKnowledgeObjectSourcetypesChange: PropTypes.func,
        onKnowledgeObjectOutputFieldChange: PropTypes.func,
        onKnowledgeObjectInputContentChange: PropTypes.func,
        onCancelClick: PropTypes.func,
        currentKnowLedgeObjectForCreating: PropTypes.object
    };
    constructor(...args) {
        super(...args);
    }
    componentWillMount() {
        const { dispatch } = this.props;
        dispatch(actions.getAction("CLEAR_ERROR"));
        dispatch(
            actions.getAction("CLEAR_EPIC_STATUS", [
                "CREATE_EVENTTYPE_EVAL$",
                "CREATE_EVENTTYPE_ALIAS$"
            ])
        );
    }
    shouldComponentUpdate(props) {
        const { pendings, dispatch, currentKnowLedgeObjectForCreating } = props;
        if (
            actions.isActionResolved(
                pendings,
                getActionForCreating(currentKnowLedgeObjectForCreating)
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
            eventTypeInfo,
            onKnowledgeObjectSourcetypesChange,
            onKnowledgeObjectOutputFieldChange,
            onCancelClick,
            currentKnowLedgeObjectForCreating
        } = this.props;
        let disabled = false;
        if (
            actions.isActionPending(
                pendings,
                getActionForCreating(currentKnowLedgeObjectForCreating)
            )
        ) {
            disabled = true;
        }
        let disableSaveBtn = true;
        if (
            currentKnowLedgeObjectForCreating.get("sourcetypes").length &&
            currentKnowLedgeObjectForCreating.get("output_field") &&
            getInputContent(currentKnowLedgeObjectForCreating)
        ) {
            disableSaveBtn = false;
        }
        return (
            <Table.Row>
                <Table.Cell style={ { width: 216, maxWidth: 216 } }>
                    <MultiSelectControl
                        value={ currentKnowLedgeObjectForCreating.get(
                            "sourcetypes"
                        ) }
                        onChange={ onKnowledgeObjectSourcetypesChange }
                        disabled={ disabled }
                        items={ _.map(
                            eventTypeInfo.get("sourcetypes"),
                            sourcetype => ({
                                value: sourcetype,
                                label: sourcetype
                            })
                        ) }
                    />
                </Table.Cell>
                <Table.Cell>
                    {
                        typeMapToLabel[
                            currentKnowLedgeObjectForCreating.get("type")
                        ]
                    }
                </Table.Cell>
                <Table.Cell>
                    <Text
                        value={ getInputContent(
                            currentKnowLedgeObjectForCreating
                        ) }
                        placeholder={ getInputPlaceholder(
                            currentKnowLedgeObjectForCreating
                        ) }
                        onChange={ this.onKnowledgeObjectInputContentChange }
                        disabled={ disabled }
                        style={
                            currentKnowLedgeObjectForCreating.get(
                                "highlight_input"
                            )
                                ? INPUT_FOCUSED_STYLES
                                : INPUT_NORMAL_STYLES
                        }
                    />
                </Table.Cell>
                <Table.Cell>
                    <Text
                        value={ currentKnowLedgeObjectForCreating.get(
                            "output_field"
                        ) }
                        placeholder={ getOutputPlaceholder(
                            currentKnowLedgeObjectForCreating
                        ) }
                        onChange={ onKnowledgeObjectOutputFieldChange }
                        disabled={ disabled }
                        style={
                            currentKnowLedgeObjectForCreating.get(
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
            currentKnowLedgeObjectForCreating,
            dispatch
        } = this.props;
        const actionName = getActionForCreating(
            currentKnowLedgeObjectForCreating
        );
        const payload = getPayloadForCreating(
            eventTypeInfo,
            currentKnowLedgeObjectForCreating
        );
        dispatch(actions.getAction(actionName, payload));
    }
    onKnowledgeObjectInputContentChange(event, { value }) {
        const { currentKnowLedgeObjectForCreating, dispatch } = this.props;
        dispatch(
            actions.getAction("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING", {
                [getInputContentKey(currentKnowLedgeObjectForCreating)]: value
            })
        );
    }
}

const mapStateToProps = state => {
    return {
        pendings: state.get("pendings"),
        currentKnowLedgeObjectForCreating: state.get(
            "currentKnowLedgeObjectForCreating"
        )
    };
};
const mapDispatchToProps = dispatch => {
    return {
        onKnowledgeObjectSourcetypesChange: (event, { value }) => {
            dispatch(
                actions.getAction("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING", {
                    sourcetypes: value
                })
            );
        },
        onKnowledgeObjectOutputFieldChange: (event, { value }) => {
            dispatch(
                actions.getAction("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING", {
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
