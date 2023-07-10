import Collapsible from "@splunk/react-ui/CollapsiblePanel";
import React, { Component } from "react";
import ChevronRight from "@splunk/react-icons/ChevronRight";
import ChevronDown from "@splunk/react-icons/ChevronDown";
import style from "./CollapsiblePanelStack.pcssm";
import { createTestHook } from "app/utils/testSupport";
import _ from "lodash";
import PropTypes from "prop-types";

class CollapsiblePanelStack extends Component {
    static propTypes = {
        title: PropTypes.string,
        children: PropTypes.object
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
    handleClick() {
        this.setState({
            active: !this.state.active
        });
    }
    render() {
        const active = this.state.active;
        const title = this.props.title;
        const children = this.props.children;
        return (
            <div
                className={ style["CollapsiblePanel"] }
                { ...createTestHook(__filename) }
            >
                <div className={ style["content"] }>
                    <div className={ style["title"] }>
                        <div
                            onClick={ this.handleClick }
                            className={ style["flexWraper"] }
                        >
                            {!active
                                ? <ChevronRight
                                      className={ style["iconStyle"] }
                                  />
                                : <ChevronDown
                                      className={ style["iconStyle"] }
                                  />}
                            <div
                                ref="path"
                                className={ style["pathContainer"] }
                                title={ _.t(title) }
                            >
                                {title}
                            </div>
                        </div>
                    </div>
                    <Collapsible
                        className={ style["hideButton"] }
                        title=""
                        open={ active }
                    >
                        <div
                            style={ {
                                backgroundColor: "#eee"
                            } }
                        >
                            {children}
                        </div>
                    </Collapsible>
                </div>
            </div>
        );
    }
}

export default CollapsiblePanelStack;
