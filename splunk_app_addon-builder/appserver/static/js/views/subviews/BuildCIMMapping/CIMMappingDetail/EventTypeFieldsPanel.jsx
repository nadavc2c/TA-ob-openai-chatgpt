import React from "react";
import _ from "lodash";
import Styles from "./Layout.pcssm";
import { connect } from "react-redux";
import TitledPanel from "app/views/common/TitledPanel.jsx";
import Button from "@splunk/react-ui/Button";
import EventTypeField from "./EventTypeField.jsx";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import SearchBar from "app/views/common/SearchBar.jsx";
import actions from "app/redux/actions/cimMapping";
import { STATUS } from "app/redux/constant";
import { filteredEventtypeFields } from "app/redux/reselectors/cimMapping.js";

import { TABLE_MODE } from "./MappingTable/Util";
import { createTestHook } from "app/utils/testSupport";
import CollapsiblePanel
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel/CollapsiblePanelStack.jsx";
import PropTypes from "prop-types";

const EventTypeFieldsPanel = ({
    goToEdit,
    eventTypeInfo,
    eventTypeFieldValues,
    pendings,
    applyFilter,
    modelCandidates,
    dispatch,
    eventTypeKnowledgeObjects
}) => {
    const isPending = pendings.some(status => status === STATUS.PENDING);
    modelCandidates = _.toPairs(modelCandidates.toJS());
    let isEventtypeNameMatch = {};
    _.forEach(modelCandidates, modelCandidate => {
        const modelFields = modelCandidate[1].fields;
        _.forEach(modelFields, field => {
            isEventtypeNameMatch[field.name] = true;
        });
    });
    const eventTypeFieldsValueSelected = eventTypeFieldValues.filter(val => {
        return isEventtypeNameMatch[val.name];
    });
    const eventTypeFieldsValueNotSelected = eventTypeFieldValues.filterNot(
        val => {
            return isEventtypeNameMatch[val.name];
        }
    );
    const orderedEventTypeFieldsValue = eventTypeFieldsValueSelected.concat(eventTypeFieldsValueNotSelected);
    const mode = eventTypeKnowledgeObjects.get("mode");
    const isFieldClickable =
        mode === TABLE_MODE.CREATE || mode === TABLE_MODE.UPDATE;
    return (
        <div
            className={ Styles.eventTypeFieldsPanel }
            { ...createTestHook(__filename) }
        >
            <TitledPanel title={ _.t("Event Type Fields") }>
                <div className={ Styles.button }>
                    <Button
                        onClick={ () => {
                            goToEdit({
                                eventTypeInfo: eventTypeInfo.toJS()
                            });
                        } }
                        disabled={ isPending }
                    >
                        {_.t("Edit Event Type...")}
                    </Button>
                </div>
                <div className={ Styles.search }>
                    <SearchBar
                        placeholder={ _.t("Search event type fields") }
                        applyFilter={ applyFilter }
                    />
                </div>
                <div className={ Styles.fields }>
                    <LoadingScreen loadCondition={ isPending }>
                        <div
                            onMouseOver={ () => {
                                if (!isFieldClickable) {
                                    return;
                                }
                                dispatch(
                                    actions.getAction(
                                        "SET_MAPPING_TABLE_HIGHLIGHT_INPUT",
                                        true
                                    )
                                );
                            } }
                            onMouseLeave={ () => {
                                if (!isFieldClickable) {
                                    return;
                                }
                                dispatch(
                                    actions.getAction(
                                        "SET_MAPPING_TABLE_HIGHLIGHT_INPUT",
                                        false
                                    )
                                );
                            } }
                        >
                            <CollapsiblePanel title={ eventTypeInfo.get("name") }>
                                {eventTypeFieldValues.size
                                    ? <div>
                                          {orderedEventTypeFieldsValue
                                              .map((val, index) => (
                                                  <EventTypeField
                                                      key={ index }
                                                      isMatched={
                                                          isEventtypeNameMatch[
                                                              val.name
                                                          ]
                                                      }
                                                      eventTypeField={ val }
                                                  />
                                              ))
                                              .toList()}
                                      </div>
                                    : <div className={ Styles.searchInfo }>
                                          {_.t("No results were found")}
                                      </div>}
                            </CollapsiblePanel>
                        </div>
                    </LoadingScreen>
                </div>
            </TitledPanel>
        </div>
    );
};

EventTypeFieldsPanel.propTypes = {
    dispatch: PropTypes.func,
    eventTypeInfo: PropTypes.object,
    eventTypeFieldValues: PropTypes.object,
    pendings: PropTypes.object,
    applyFilter: PropTypes.func,
    goToEdit: PropTypes.func,
    eventTypeKnowledgeObjects: PropTypes.object,
    modelCandidates: PropTypes.object
};
const mapStateToProps = state => {
    return {
        pendings: state.get("pendings"),
        eventTypeFieldValues: filteredEventtypeFields(state),
        modelCandidates: state.get("cimModelTree").get("combinedModel"),
        eventTypeKnowledgeObjects: state.get("eventTypeKnowledgeObjects")
    };
};
const mapDispatchToProps = dispatch => {
    return {
        applyFilter: searchStr => {
            dispatch(
                actions.getAction("FILTER_EVENTTYPE_FIELD_VALUES", searchStr)
            );
        },
        goToEdit: params => {
            dispatch(
                actions.getAction("SET_NAVIGATION", {
                    view: "cim-mapping",
                    action: "edit",
                    params: params
                })
            );
        },
        dispatch
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(
    EventTypeFieldsPanel
);
