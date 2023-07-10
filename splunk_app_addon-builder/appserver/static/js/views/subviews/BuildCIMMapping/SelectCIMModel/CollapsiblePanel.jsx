import _ from "lodash";
import Collapsible from "@splunk/react-ui/CollapsiblePanel";
import React, { Component } from "react";
import ChevronRight from "@splunk/react-icons/ChevronRight";
import ChevronDown from "@splunk/react-icons/ChevronDown";
import Trash from "@splunk/react-icons/Trash";
import { connect } from "react-redux";
import style from "./CollapsiblePanel.pcssm";
import actions from "app/redux/actions/cimMapping";
import {
    unflatString
} from "app/views/subviews/BuildCIMMapping/SelectCIMModel/util";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";
class CollapsiblePanel extends Component {
    static propTypes = {
        title: PropTypes.string,
        children: PropTypes.object,
        goToNode: PropTypes.func,
        fieldsNumber: PropTypes.number,
        toggleModelCandidate: PropTypes.func
    };
    constructor(props, context) {
        super(props, context);
    }
    componentWillMount() {
        this.state = {
            active: false
        };
    }
    componentDidMount() {
        this.setState({ active: !this.state.active });
    }
    handleClick(e) {
        e.stopPropagation();
        this.setState({ active: !this.state.active });
    }
    toggleModelCandidates() {
        this.props.toggleModelCandidate({
            level: this.props.title,
            obj: {}
        });
    }
    render() {
        const active = this.state.active;
        const title = this.props.title;
        const children = this.props.children;
        let titleArr = title.split("/");
        const firstElem = titleArr.shift();
        const lastElem = titleArr.pop();
        return (
            <div
                className={ style["CollapsiblePanel"] }
                { ...createTestHook(__filename) }
            >
                <div>
                    <div
                        onClick={ this.handleClick }
                        className={ style["collapsiblePanelButton"] }
                    >
                        {active
                            ? <ChevronDown className={ style["iconStyle"] } />
                            : <ChevronRight className={ style["iconStyle"] } />}
                        <div ref="path" className={ style["pathContainer"] }>
                            <div className={ style["firstAndLastPath"] }>
                                {firstElem + (titleArr.length ? "/" : "")}
                            </div>
                            <div className={ style["path"] }>
                                {titleArr.join("/")}
                            </div>
                            <div
                                className={ style["firstAndLastPath"] }
                                style = { { fontWeight: 'bold' } }>
                                {lastElem
                                    ? `/${lastElem}(${this.props.fieldsNumber})`
                                    : ""}
                            </div>
                        </div>
                        <Trash
                            style={ { color: 'grey', fontSize: '20px' } }
                            onClick={ this.toggleModelCandidates }
                            className= { style['deleteButton'] }
                        />
                    </div>
                </div>
                <Collapsible
                    className={ style["CollapsiblePanelContent"] }
                    title=""
                    open={ active }
                >
                    <div>
                        {children}
                    </div>
                </Collapsible>
            </div>
        );
    }
}

const mapDispatchToProps = dispatch => {
    return {
        goToNode: key => {
            let path = {};
            _.assign(path, unflatString(key, "/"));
            Object.keys(path).forEach(key => {
                dispatch(
                    actions.getAction("SET_TREE_STATE", { key, value: true })
                );
            });
        },
        toggleModelCandidate: candidate => {
            dispatch(actions.getAction("TOGGLE_MODEL_CANDIDATE", candidate));
        }
    };
};

export default connect(() => ({}), mapDispatchToProps)(CollapsiblePanel);
