import React, { Component } from "react";
import Popover from "@splunk/react-ui/Popover";
import style from "./EventTypeField.pcssm";
import _ from "lodash";
import { connect } from "react-redux";
import Field from "app/views/subviews/BuildCIMMapping/shared/Field.jsx";
import { TABLE_MODE } from "./MappingTable/Util";
import actions from "app/redux/actions/cimMapping";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const formatPercentage = percent => {
    return Math.round(percent * 10000) / 100 + "%";
};

class EventTypeField extends Component {
    static propTypes = {
        eventTypeKnowledgeObjects: PropTypes.object,
        eventTypeField: PropTypes.object,
        isMatched: PropTypes.bool,
        dispatch: PropTypes.func
    };
    constructor(props, context) {
        super(props, context);
        this.state = {
            open: false,
            anchor: null
        };
    }
    isFieldClickable() {
        const { eventTypeKnowledgeObjects } = this.props;
        const mode = eventTypeKnowledgeObjects.get("mode");
        return mode === TABLE_MODE.CREATE || mode === TABLE_MODE.UPDATE;
    }
    handleMount(component) {
        this.setState({
            anchor: component
        });
    }
    handleOpen() {
        if (this.isFieldClickable()) {
            return;
        }
        this.setState({
            open: true
        });
    }

    handleClose() {
        this.setState({
            open: false
        });
    }

    render() {
        const { anchor, open } = this.state;
        const { eventTypeField, isMatched, dispatch } = this.props;
        let isFieldClickable = this.isFieldClickable();
        return (
            <div { ...createTestHook(__filename) }>
                <span
                    onMouseEnter={ this.handleOpen }
                    ref={ this.handleMount }
                    onMouseLeave={ this.handleClose }
                >
                    <Field
                        isMatched={ isMatched }
                        text={ eventTypeField.name }
                        hasHoveringEffect={ isFieldClickable }
                        onClick={ (event, { value }) => {
                            if (!isFieldClickable) {
                                return;
                            }
                            dispatch(
                                actions.getAction(
                                    "APPEND_MAPPING_TABLE_EVENT_TYPE_FIELD",
                                    value
                                )
                            );
                        } }
                        tooltipText={ getFormattedMessage(5031) }
                    />
                </span>
                <Popover
                    open={ open }
                    anchor={ anchor }
                    appearance="light"
                    onRequestClose={ this.handleClose }
                    defaultPlacement={ "right" }
                    onMouseEnter={ this.handleOpen }
                    onMouseLeave={ this.handleClose }
                >
                    <div className={ style["tableTitle"] }>
                        <div
                            title={ eventTypeField.name }
                            className={ style["tableTitleContent"] }
                        >
                            {eventTypeField.name}
                        </div>
                    </div>
                    <table className={ style["tableMain"] }>
                        <thead>
                            <tr className={ style["tableRow"] }>
                                <th className={ style["tableHeader"] }>
                                    {_.t("Value")}
                                </th>
                                <th className={ style["tableHeader"] }>
                                    {_.t("Count")}
                                </th>
                                <th className={ style["tableHeader"] }>
                                    {_.t("%")}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {eventTypeField.values.map((val, key) => {
                                return (
                                    <tr className={ style["tableRow"] } key={ key }>
                                        <td className={ style["tableCell"] }>
                                            {val.value}
                                        </td>
                                        <td className={ style["tableCell"] }>
                                            {val.count}
                                        </td>
                                        <td className={ style["tableCell"] }>
                                            {formatPercentage(val.percent)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Popover>
            </div>
        );
    }
}

const mapStateToProps = state => {
    return {
        eventTypeKnowledgeObjects: state.get("eventTypeKnowledgeObjects")
    };
};

export default connect(mapStateToProps)(EventTypeField);
