import _ from "lodash";
import React from "react";
import Styles from "./Master.pcssm";
import { connect } from "react-redux";
import Table from "@splunk/react-ui/Table";
import Row from "./Row.jsx";
import RowForCreate from "./RowForCreate.jsx";
import RowForUpdate from "./RowForUpdate.jsx";
import RowForError from "./RowForError.jsx";
import actions from "app/redux/actions/cimMapping";
import { TABLE_MODE } from "./Util";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

class MappingTable extends React.Component {
    static propTypes = {
        pendings: PropTypes.object,
        eventTypeInfo: PropTypes.object,
        eventTypeKnowledgeObjects: PropTypes.object,
        currentKnowLedgeObjectForCreating: PropTypes.object,
        currentKnowLedgeObjectForUpdating: PropTypes.object
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const {
            pendings,
            eventTypeInfo,
            eventTypeKnowledgeObjects,
            currentKnowLedgeObjectForCreating,
            currentKnowLedgeObjectForUpdating
        } = this.props;
        const mode = eventTypeKnowledgeObjects.get("mode");
        const koData = eventTypeKnowledgeObjects.get("data");
        let disableRow = false;
        if (
            mode === TABLE_MODE.CREATE ||
            mode === TABLE_MODE.UPDATE ||
            actions.isActionPending(pendings, "DELETE_EVENTTYPE_EVAL$") ||
            actions.isActionPending(pendings, "DELETE_EVENTTYPE_ALIAS$")
        ) {
            disableRow = true;
        }
        let rows = [];
        if (mode === TABLE_MODE.CREATE) {
            rows.push(
                <RowForCreate key="create" eventTypeInfo={ eventTypeInfo } />
            );
            rows.push(
                <RowForError
                    key="error"
                    message={ currentKnowLedgeObjectForCreating.get("error") }
                />
            );
        }
        if (mode === TABLE_MODE.VIEW || mode === TABLE_MODE.CREATE) {
            koData.forEach((knowledgeObjectInfo, index) =>
                rows.push(
                    <Row
                        key={ index }
                        index={ index }
                        knowledgeObjectInfo={ knowledgeObjectInfo }
                        eventTypeInfo={ eventTypeInfo }
                        disableRow={ disableRow }
                    />
                )
            );
        }
        if (mode === TABLE_MODE.UPDATE) {
            koData.forEach((knowledgeObjectInfo, index) => {
                if (index === currentKnowLedgeObjectForUpdating.get("index")) {
                    rows.push(
                        <RowForUpdate
                            key="update"
                            index={ index }
                            initialKnowledgeObjectInfo={ knowledgeObjectInfo }
                            eventTypeInfo={ eventTypeInfo }
                        />
                    );
                    rows.push(
                        <RowForError
                            key="error"
                            message={ currentKnowLedgeObjectForUpdating.get(
                                "error"
                            ) }
                        />
                    );
                } else {
                    rows.push(
                        <Row
                            key={ index }
                            index={ index }
                            knowledgeObjectInfo={ knowledgeObjectInfo }
                            eventTypeInfo={ eventTypeInfo }
                            disableRow={ disableRow }
                        />
                    );
                }
            });
        }
        const TableHead = (
            <Table.Head>
                <Table.HeadCell style={ { width: 216, maxWidth: 216 } }>
                    {_.t("Source Type")}
                </Table.HeadCell>
                <Table.HeadCell style={ { width: 100 } }>
                    {_.t("Object Type")}
                </Table.HeadCell>
                <Table.HeadCell>
                    {_.t("Event Type Field or Expression")}
                </Table.HeadCell>
                <Table.HeadCell>{_.t("Data Model Field")}</Table.HeadCell>
                <Table.HeadCell style={ { width: 150, minWidth: 150 } }>
                    {_.t("Actions")}
                </Table.HeadCell>
            </Table.Head>
        );
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                {actions.isActionResolved(
                    pendings,
                    "GET_EVENTTYPE_KNOWLEDGE_OBJECTS$"
                )
                    ? <Table stripeRows={ true } headType="docked">
                          {TableHead}
                          <Table.Body>
                              {rows}
                          </Table.Body>
                      </Table>
                    : <div>
                          <Table>
                              {TableHead}
                          </Table>
                          <div className={ Styles.wait }>
                              <WaitSpinner
                                  size="small"
                                  color="brand"
                                  style={ { marginRight: 5 } }
                              />
                              {_.t("Loading...")}
                          </div>
                      </div>}
            </div>
        );
    }
}

const mapStateToProps = state => {
    return {
        pendings: state.get("pendings"),
        eventTypeKnowledgeObjects: state.get("eventTypeKnowledgeObjects"),
        currentKnowLedgeObjectForCreating: state.get(
            "currentKnowLedgeObjectForCreating"
        ),
        currentKnowLedgeObjectForUpdating: state.get(
            "currentKnowLedgeObjectForUpdating"
        )
    };
};
export default connect(mapStateToProps)(MappingTable);
