import React from "react";
import _ from "lodash";
import Styles from "./Layout.pcssm";
import classnames from "classnames";
import { connect } from "react-redux";
import actions from "app/redux/actions/cimMapping";
import ChevronDown from "@splunk/react-icons/ChevronDown";
import Dropdown from "app/views/common/Dropdown";
import Menu from "@splunk/react-ui/Menu";
import MappingTable from "./MappingTable/Master.jsx";
import { TABLE_MODE } from "./MappingTable/Util";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

class MappingTablePanel extends React.Component {
    static propTypes = {
        dispatch: PropTypes.func,
        pendings: PropTypes.object,
        eventTypeInfo: PropTypes.object,
        eventTypeKnowledgeObjects: PropTypes.object
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const {
            pendings,
            eventTypeInfo,
            eventTypeKnowledgeObjects
        } = this.props;

        const mode = eventTypeKnowledgeObjects.get("mode");
        let disable = false;
        if (
            mode === TABLE_MODE.CREATE ||
            mode === TABLE_MODE.UPDATE ||
            actions.isActionPending(pendings, "DELETE_EVENTTYPE_EVAL$") ||
            actions.isActionPending(pendings, "DELETE_EVENTTYPE_ALIAS$")
        ) {
            disable = true;
        }
        const toggle = (
            <button className="btn btn-primary" disabled={ disable }>
                <span>{_.t("New Knowledge Object")}</span>
                <span> </span>
                <ChevronDown />
            </button>
        );
        return (
            <div
                className={ Styles.mappingTablePanel }
                { ...createTestHook(__filename) }
            >
                <div
                    className={ classnames(
                        Styles.mappingTablePanelTopBlock,
                        "clearfix"
                    ) }
                >
                    <h4>{_.t("Data Model Mapping List")}</h4>
                </div>
                <Dropdown
                    toggle={ toggle }
                    className={ classnames(Styles.mappingTablePanelTopButton) }
                >
                    <Menu
                        style={ {
                            width: 120
                        } }
                    >
                        <Menu.Item onClick={ this.onFieldAliasClick }>
                            FIELDALIAS
                        </Menu.Item>
                        <Menu.Item onClick={ this.onEvalClick }>
                            EVAL
                        </Menu.Item>
                    </Menu>
                </Dropdown>
                <MappingTable
                    eventTypeInfo={ eventTypeInfo }
                    disableRow={ disable }
                />
            </div>
        );
    }
    onFieldAliasClick() {
        const { eventTypeInfo, dispatch } = this.props;
        dispatch(
            actions.getAction("CLEAR_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING")
        );
        dispatch(
            actions.getAction("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING", {
                sourcetypes: eventTypeInfo.get("sourcetypes"),
                type: "alias"
            })
        );
        dispatch(
            actions.getAction(
                "SET_EVENTTYPE_MAPPING_TABLE_MODE",
                TABLE_MODE.CREATE
            )
        );
    }
    onEvalClick() {
        const { eventTypeInfo, dispatch } = this.props;
        dispatch(
            actions.getAction("CLEAR_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING")
        );
        dispatch(
            actions.getAction("SET_CURRENT_KNOWLEDGE_OBJECT_FOR_CREATING", {
                sourcetypes: eventTypeInfo.get("sourcetypes"),
                type: "eval"
            })
        );

        dispatch(
            actions.getAction(
                "SET_EVENTTYPE_MAPPING_TABLE_MODE",
                TABLE_MODE.CREATE
            )
        );
    }
}

const mapStateToProps = state => {
    return {
        pendings: state.get("pendings"),
        eventTypeKnowledgeObjects: state.get("eventTypeKnowledgeObjects")
    };
};
export default connect(mapStateToProps)(MappingTablePanel);
