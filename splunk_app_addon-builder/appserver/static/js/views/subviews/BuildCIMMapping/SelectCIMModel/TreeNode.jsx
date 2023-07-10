import React, { Component } from "react";
import ChevronRight from "@splunk/react-icons/ChevronRight";
import ChevronDown from "@splunk/react-icons/ChevronDown";
import Switch from "@splunk/react-ui/Switch";
import _ from "lodash";
import style from "./TreeNode.pcssm";
import Button from "@splunk/react-ui/Button";
import { createTestHook } from "app/utils/testSupport";
import Tooltip from "@splunk/react-ui/Tooltip";
import { getMessageFromModel } from "app/utils/MessageUtil";
import {
    STARTING_ROOT
} from "app/views/subviews/BuildCIMMapping/mapToModelsConstants";
import PropTypes from "prop-types";
import Error from '@splunk/react-icons/Error';

class TreeNode extends Component {
    static propTypes = {
        activationStatus: PropTypes.object,
        modelCandidates: PropTypes.object,
        treeData: PropTypes.object,
        changeTreeState: PropTypes.func,
        toggleModelCandidate: PropTypes.func
    };
    constructor(props, context) {
        super(props, context);
    }

    handleClick(e, key) {
        e.stopPropagation();
        this.props.changeTreeState(key);
        return false;
    }

    toggleModelCandidates(e) {
        e.stopPropagation();
        const { treeData } = this.props;
        this.props.toggleModelCandidate({
            level: treeData.get("path"),
            obj: this.props.treeData
        });
        return false;
    }

    shouldComponentUpdate(nextProps) {
        const { treeData, modelCandidates, toggleModelCandidate } = nextProps;
        const path = treeData.get("path");
        if (
            modelCandidates.get(path) &&
            modelCandidates.findKey((val, key) => _.startsWith(key, path + "/"))
        ) {
            toggleModelCandidate({
                level: path,
                obj: this.props.treeData
            });
            return false;
        }
        return true;
    }

    render() {
        const {
            treeData,
            modelCandidates,
            changeTreeState,
            toggleModelCandidate
        } = this.props;
        if (!treeData.size) {
            return null;
        }
        const path = treeData.get("path");
        const error = treeData.get("error").size ? treeData.get("error") : null;
        const title = treeData.get("title");
        const isSelectable = treeData.get("ta_relevant");
        const children = treeData.get("children");
        const isDisabled = !!modelCandidates.findKey((val, key) =>
            _.startsWith(key, path + "/")
        );
        const isCurrentSelected = !!(modelCandidates.get(path) ? true : false);
        const iconStyle = {
            opacity: children.size ? 1 : 0,
            color: `${isSelectable ? "#1e93c6" : "#5c6773"}`,
            width: "9px",
            height: "9px",
            marginRight: "5px"
        };
        const active = this.props.activationStatus.get(path);
        const type = treeData.get("type");
        return (
            <div { ...createTestHook(__filename) }>
                <div
                    className={ style["treeNode"] }
                    style={ type === STARTING_ROOT ? { display: "none" } : {} }
                >
                    <Button
                        style={ { width: "100%" } }
                        appearance="pill"
                        label=""
                        onClick={
                            children.size
                                ? e => this.handleClick(e, path)
                                : _.noop
                        }
                        icon={
                            !active
                                ? <ChevronRight style={ iconStyle } />
                                : <ChevronDown style={ iconStyle } />
                        }
                    >
                        <span>
                            {isSelectable
                                ? <div>
                                      <a
                                          onClick={ this.toggleModelCandidates }
                                          href="#"
                                      >
                                          {_.t(
                                              title +
                                                  (isSelectable
                                                      ? `(${treeData.get("fields").size})`
                                                      : "")
                                          )}
                                      </a>
                                      {error
                                          ? <Tooltip
                                                content={ getMessageFromModel(
                                                    error
                                                ) }
                                            >
                                                <Error style={
                                                    {
                                                        fontSize: '20px',
                                                        color: '#d6563c',
                                                        margin: '0 5px'
                                                    }
                                                } />
                                            </Tooltip>
                                          : null}
                                  </div>
                                : <div className={ style["disabledLink"] }>
                                      {_.t(
                                          title +
                                              (isSelectable
                                                  ? `(${treeData.get("fields").size})`
                                                  : "")
                                      )}
                                      {error
                                          ? <Tooltip
                                                content={ getMessageFromModel(
                                                    error
                                                ) }
                                            >
                                                <Error style={
                                                    {
                                                        fontSize: '20px',
                                                        color: '#d6563c',
                                                        margin: '0 5px'
                                                    }
                                                } />
                                            </Tooltip>
                                          : null}
                                  </div>}
                        </span>
                        <span style={ { width: "100%" } } />
                    </Button>
                    {isSelectable &&
                        <div className={ style["linkCheckbox"] }>
                            <Switch
                                value={ isCurrentSelected }
                                selected={ isCurrentSelected }
                                appearance="checkbox"
                                onClick={ this.toggleModelCandidates }
                                inline
                                disabled={ isDisabled }
                            />
                        </div>}
                </div>
                {active &&
                    <div
                        className={
                            type === STARTING_ROOT ? "" : style["content"]
                        }
                    >
                        {children.size
                            ? children.map((node, index) => (
                                  <TreeNode
                                      key={ index }
                                      treeData={ node }
                                      activationStatus={
                                          this.props.activationStatus
                                      }
                                      modelCandidates={
                                          this.props.modelCandidates
                                      }
                                      changeTreeState={ changeTreeState }
                                      toggleModelCandidate={
                                          toggleModelCandidate
                                      }
                                  />
                              ))
                            : null}
                    </div>}
            </div>
        );
    }
}

export default TreeNode;
