import React, { Component } from "react";
import CollapsiblePanel
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel/CollapsiblePanel.jsx";
import { connect } from "react-redux";
import Field from "app/views/subviews/BuildCIMMapping/shared/Field.jsx";
import style from "./SelectedModelPanel.pcssm";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
import actions from "app/redux/actions/cimMapping";
import {
    filteredTree,
    filteredSelectedModel
} from "app/redux/reselectors/cimMapping.js";

class SelectedModelPanel extends Component {
    static propTypes = {
        setModelCandidate: PropTypes.func,
        resetModelCandidate: PropTypes.func,
        selectedEventType: PropTypes.object,

        tableData: PropTypes.object,
        modelCandidates: PropTypes.object,
        eventTypeFieldsValueUnfiltered: PropTypes.object,
        treeData: PropTypes.object,
        pendings: PropTypes.object
    };

    constructor(props, context) {
        super(props, context);
        this.isEventtypeNameMatch = {};
    }
    componentWillMount() {
        const fields = this.props.selectedEventType;
        this.props.setModelCandidate(new Set(fields.model_fullnames));
        this.props.eventTypeFieldsValueUnfiltered.forEach(val => {
            this.isEventtypeNameMatch[val.name] = true;
        });
    }
    componentWillUpdate(nextProps) {
        const currentVal = this.props.eventTypeFieldsValueUnfiltered;
        const nextVal = nextProps.eventTypeFieldsValueUnfiltered;
        if (currentVal !== nextVal) {
            this.isEventtypeNameMatch = {};
            nextVal.forEach(val => {
                this.isEventtypeNameMatch[val.name] = true;
            });
        }
    }
    render() {
        const { modelCandidates } = this.props;
        return (
            <div { ...createTestHook(__filename) }>
                {modelCandidates
                    .map((subArr, key) => {
                        const fields = subArr.get("fields");
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
                            <div key={ key }>
                                <CollapsiblePanel
                                    title={ key }
                                    fieldsNumber={ orderedFields.size }
                                >
                                    <div
                                        className={
                                            style["collapsiblePanelContent"]
                                        }
                                    >
                                        {orderedFields.map((val, index) => (
                                            <Field
                                                key={ index }
                                                isMatched={
                                                    this.isEventtypeNameMatch[
                                                        val.get("name")
                                                    ]
                                                }
                                                text={ val.get("name") }
                                                isCheckMarkFloatLeft={ false }
                                            />
                                        ))}
                                    </div>
                                </CollapsiblePanel>
                            </div>
                        );
                    })
                    .toList()}
            </div>
        );
    }
}
const mapDispatchToProps = dispatch => {
    return {
        setModelCandidate: candidateNameSet => {
            dispatch(
                actions.getAction("SET_MODEL_CANDIDATE", candidateNameSet)
            );
        },
        applyFilter: searchStr => {
            dispatch(actions.getAction("FILTER_SELECTED_CIM_MODEL", searchStr));
        }
    };
};

const mapStateToProps = state => {
    return {
        tableData: state.get("tableData"),
        eventTypeFieldsValueUnfiltered: state
            .get("eventTypeFieldValues")
            .get("data"),
        treeData: filteredTree(state),
        modelCandidates: filteredSelectedModel(state),
        pendings: state.get("pendings")
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(SelectedModelPanel);
