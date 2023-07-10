import React, { Component } from "react";
import _ from "lodash";
import { connect } from "react-redux";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import actions from "app/redux/actions/cimMapping";

import { filteredEventtypeFields } from "app/redux/reselectors/cimMapping";
import style from "./EventTypeColumn.pcssm";
import Field from "app/views/subviews/BuildCIMMapping/shared/Field.jsx";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const mapStateToProps = state => {
    return {
        tableData: state.get("tableData"),
        eventTypeFieldsValue: filteredEventtypeFields(state),
        modelCandidatesUnfiltered: state
            .get("cimModelTree")
            .get("combinedModel"),
        pendings: state.get("pendings")
    };
};
class EventTypeColumn extends Component {
    static propTypes = {
        tableData: PropTypes.object,
        eventTypeFieldsValue: PropTypes.object,
        modelCandidatesUnfiltered: PropTypes.object,
        pendings: PropTypes.object
    };

    constructor(props, context) {
        super(props, context);
        this.isEventtypeNameMatch = {};
    }
    componentWillMount() {
        const modelCandidates = _.toPairs(
            this.props.modelCandidatesUnfiltered.toJS()
        );
        _.forEach(modelCandidates, modelCandidate => {
            const modelFields = modelCandidate[1].fields;
            _.forEach(modelFields, field => {
                this.isEventtypeNameMatch[field.name] = true;
            });
        });
    }
    componentWillUpdate(nextProps) {
        const currentVal = this.props.modelCandidatesUnfiltered;
        const nextVal = nextProps.modelCandidatesUnfiltered;
        if (currentVal !== nextVal) {
            this.isEventtypeNameMatch = {};
            const modelCandidates = _.toPairs(nextVal.toJS());
            _.forEach(modelCandidates, modelCandidate => {
                const modelFields = modelCandidate[1].fields;
                _.forEach(modelFields, field => {
                    this.isEventtypeNameMatch[field.name] = true;
                });
            });
        }
    }

    render() {
        const { pendings, eventTypeFieldsValue } = this.props;

        const isPending = actions.isActionPending(
            pendings,
            "GET_EVENTTYPE_FIELD_VALUES$"
        );
        const eventTypeFieldsValueSelected = eventTypeFieldsValue.filter(
            val => {
                return this.isEventtypeNameMatch[val.name];
            }
        );
        const eventTypeFieldsValueNotSelected = eventTypeFieldsValue.filterNot(
            val => {
                return this.isEventtypeNameMatch[val.name];
            }
        );
        return (
            <div { ...createTestHook(__filename) }>
                <LoadingScreen loadCondition={ isPending }>
                    <div className={ style["eventTypeFieldsContent"] }>
                        {eventTypeFieldsValueSelected
                            .map((val, index) => (
                                <Field
                                    key={ index }
                                    isMatched={
                                        this.isEventtypeNameMatch[val.name]
                                    }
                                    text={ val.name }
                                />
                            ))
                            .toList()}
                        {eventTypeFieldsValueNotSelected
                            .map((val, index) => (
                                <Field
                                    key={ index }
                                    isMatched={
                                        this.isEventtypeNameMatch[val.name]
                                    }
                                    text={ val.name }
                                />
                            ))
                            .toList()}
                    </div>
                </LoadingScreen>
            </div>
        );
    }
}

export default connect(mapStateToProps)(EventTypeColumn);
