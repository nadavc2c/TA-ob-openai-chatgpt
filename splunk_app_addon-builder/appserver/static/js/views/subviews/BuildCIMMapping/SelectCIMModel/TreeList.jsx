import _ from "lodash";
import { connect } from "react-redux";
import React, { Component } from "react";
import TreeNode
    from "app/views/subviews/BuildCIMMapping/SelectCIMModel/TreeNode.jsx";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
import {
    filteredTree,
    filteredSelectedModel
} from "app/redux/reselectors/cimMapping.js";
import actions from "app/redux/actions/cimMapping";
import {
    unflatString
} from "app/views/subviews/BuildCIMMapping/SelectCIMModel/util";

class TreeList extends Component {
    static propTypes = {
        closeTreeExceptSelected: PropTypes.func,
        changeTreeState: PropTypes.func,
        toggleModelCandidate: PropTypes.func,

        modelCandidates: PropTypes.object,
        treeData: PropTypes.object,
        pendings: PropTypes.object,
        active: PropTypes.object
    };

    constructor(props, context) {
        super(props, context);
    }
    componentWillMount() {
        this.props.closeTreeExceptSelected(this.props.modelCandidates);
    }
    render() {
        const {
            changeTreeState,
            toggleModelCandidate,
            treeData,
            active,
            modelCandidates
        } = this.props;
        return (
            <div { ...createTestHook(__filename) }>
                <LoadingScreen
                    loadCondition={ actions.isActionPending(
                        this.props.pendings,
                        "GET_TREE_DATA$"
                    ) }
                >
                    <TreeNode
                        treeData={ treeData }
                        activationStatus={ active }
                        modelCandidates={ modelCandidates }
                        changeTreeState={ changeTreeState }
                        toggleModelCandidate={ toggleModelCandidate }
                    />
                </LoadingScreen>
            </div>
        );
    }
}

const mapStateToProps = state => {
    return {
        treeData: filteredTree(state),
        modelCandidates: filteredSelectedModel(state),
        pendings: state.get("pendings"),
        active: state.get("cimModelTree").get("nodeActivitionStatus")
    };
};

const mapDispatchToProps = dispatch => {
    return {
        closeTreeExceptSelected: modelCandidates => {
            dispatch(actions.getAction("CLEAR_TREE_STATE", false));
            modelCandidates.forEach((value, key) => {
                let path = {};
                _.assign(path, unflatString(key, "/"));
                Object.keys(path).forEach(key => {
                    dispatch(
                        actions.getAction("SET_TREE_STATE", {
                            key,
                            value: true
                        })
                    );
                });
            });
        },
        changeTreeState: key => {
            dispatch(actions.getAction("SET_TREE_STATE", { key }));
        },
        toggleModelCandidate: candidate => {
            dispatch(actions.getAction("TOGGLE_MODEL_CANDIDATE", candidate));
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TreeList);
