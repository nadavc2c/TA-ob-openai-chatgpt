import React, { Component } from "react";
import CollapsiblePanel
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel/CollapsiblePanelStack.jsx";
import { connect } from "react-redux";
import Field from "app/views/subviews/BuildCIMMapping/shared/Field.jsx";
import { filteredSelectedModel } from "app/redux/reselectors/cimMapping.js";
import actions from "app/redux/actions/cimMapping";
import { TABLE_MODE } from "./MappingTable/Util";
import { getFormattedMessage } from "app/utils/MessageUtil";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
import _ from "lodash";
import Heading from "@splunk/react-ui/Heading";

class SelectedModelPanel extends Component {
    static propTypes = {
        eventTypeKnowledgeObjects: PropTypes.object,
        eventTypeFieldValues: PropTypes.object,
        modelCandidates: PropTypes.object,
        pendings: PropTypes.object,
        eventTypeInfo: PropTypes.object,
        dispatch: PropTypes.func
    };
    constructor(props, context) {
        super(props, context);
        this.isEventtypeNameMatch = {};
    }
    componentWillMount() {
        const { eventTypeInfo, dispatch } = this.props;
        const candidateNameSet = new Set(eventTypeInfo.get("model_fullnames"));
        dispatch(actions.getAction("SET_MODEL_CANDIDATE", candidateNameSet));
        const eventTypeFieldValues = this.props.eventTypeFieldValues.get(
            "data"
        );
        this.isEventtypeNameMatch = {};
        eventTypeFieldValues.forEach(val => {
            this.isEventtypeNameMatch[val.name] = true;
        });
    }
    componentWillUpdate(nextProps) {
        const currentVal = this.props.eventTypeFieldValues.get("data");
        const nextVal = nextProps.eventTypeFieldValues.get("data");
        if (currentVal !== nextVal) {
            this.isEventtypeNameMatch = {};
            nextVal.forEach(val => {
                this.isEventtypeNameMatch[val.name] = true;
            });
        }
    }
    render() {
        const {
            eventTypeKnowledgeObjects,
            modelCandidates,
            dispatch
        } = this.props;
        const mode = eventTypeKnowledgeObjects.get("mode");
        let modelCandidatesStartWithDic = modelCandidates.reduce(
            (dic, model, key) => {
                const firstElem = key.split("/").shift();
                const fields = model.get("fields");
                const modelName = `${ key.split("/").pop() }(${ fields.size })`;
                dic[firstElem]
                    ? dic[firstElem].push({ key: modelName, fields })
                    : (dic[firstElem] = [{ key: modelName, fields }]);
                return dic;
            },
            {}
        );
        let isFieldClickable =
            mode === TABLE_MODE.CREATE || mode === TABLE_MODE.UPDATE;
        return (
            <div
                onMouseOver={ () => {
                    if (!isFieldClickable) {
                        return;
                    }
                    dispatch(
                        actions.getAction(
                            "SET_MAPPING_TABLE_HIGHLIGHT_OUTPUT",
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
                            "SET_MAPPING_TABLE_HIGHLIGHT_OUTPUT",
                            false
                        )
                    );
                } }
                { ...createTestHook(__filename) }
            >
                {_.map(modelCandidatesStartWithDic, (arr, key) => {
                    return (
                        <div key={ key }>
                            <Heading level={ 5 }>{key}</Heading>
                            {_.map(arr, (obj, index) => {
                                const { key, fields } = obj;
                                const matchedFields = fields.filter(( val )=>{
                                    return this
                                        .isEventtypeNameMatch[
                                        val.get("name")
                                    ];
                                });
                                const notMatchedFields = fields.filter(( val )=>{
                                    return !this
                                        .isEventtypeNameMatch[
                                        val.get("name")
                                    ];
                                });
                                const orderedFields = matchedFields.concat(notMatchedFields);
                                return (
                                    <CollapsiblePanel key={ index } title={ key }>
                                        <div>
                                            {orderedFields.map((val, index) => (
                                                <Field
                                                    key={ index }
                                                    isMatched={
                                                        this
                                                            .isEventtypeNameMatch[
                                                            val.get("name")
                                                        ]
                                                    }
                                                    text={ val.get("name") }
                                                    defaultTooltipText= { val.get("description") }
                                                    hasHoveringEffect={
                                                        isFieldClickable
                                                    }
                                                    onClick={ (
                                                        event,
                                                        { value }
                                                    ) => {
                                                        if (!isFieldClickable) {
                                                            return;
                                                        }
                                                        dispatch(
                                                            actions.getAction(
                                                                "APPEND_MAPPING_TABLE_CIM_FIELD",
                                                                value
                                                            )
                                                        );
                                                    } }
                                                    tooltipText={ getFormattedMessage(
                                                        5030
                                                    ) }
                                                />
                                            ))}
                                        </div>
                                    </CollapsiblePanel>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    }
}

const mapStateToProps = state => {
    return {
        eventTypeKnowledgeObjects: state.get("eventTypeKnowledgeObjects"),
        eventTypeFieldValues: state.get("eventTypeFieldValues"),
        modelCandidates: filteredSelectedModel(state),
        pendings: state.get("pendings")
    };
};

export default connect(mapStateToProps)(SelectedModelPanel);
