import React from "react";
import _ from "lodash";
import Styles from "./ErrorBanner.pcssm";
import classnames from "classnames";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const STATUS = {
    HIDING: "hiding",
    HIDDEN: "hidden",
    SHOWN: "SHOWN"
};

export default class ErrorBanner extends React.Component {
    static defaultProps = {
        message: "",
        closeCallback: _.noop
    };

    static propTypes = {
        message: PropTypes.string,
        closeCallback: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    componentWillMount() {
        this.status = this.props.message ? STATUS.SHOWN : STATUS.HIDDEN;
    }
    componentWillReceiveProps(nextProps) {
        const message = (this.oldMessage = this.props.message);
        if (this.status === STATUS.SHOWN && message !== nextProps.message) {
            this.hide();
        }
    }

    componentDidUpdate(prevProps) {
        const message = this.props.message;
        if (this.status === STATUS.SHOWN) {
            this.setMessage(message);
        } else if (this.status === STATUS.HIDDEN) {
            this.show(message);
        } else if (this.status === STATUS.HIDING) {
            this.setMessage(prevProps.message);
            _.delay(() => {
                this.show(message);
            }, 500);
        }
        return;
    }
    render() {
        const rootClassName = this.getRootClassName();
        const message = this.oldMessage != null
            ? this.oldMessage
            : this.props.message;
        return (
            <div
                className={ rootClassName }
                ref="node"
                { ...createTestHook(__filename) }
            >
                <i className={ classnames(Styles.icon, "icon-error") } />
                <span className={ Styles.msg } title={ message } ref="message">
                    {message}
                </span>
                <span
                    className={ Styles.close }
                    onClick={ this.onCloseClick }
                    { ...createTestHook(null, {
                        componentName: "ta-link-close"
                    }) }
                >
                    <i className={ classnames(Styles.iconClose, "icon-x") } />
                </span>
            </div>
        );
    }
    getRootClassName() {
        switch (this.status) {
            case STATUS.SHOWN:
                return classnames(Styles.root, Styles.rootShowAnimation);
            case STATUS.HIDING:
                return classnames(Styles.rootClosed, Styles.rootHideAnimation);
            case STATUS.HIDDEN:
                return classnames(Styles.noDisplay);
        }
    }
    setRootClassName() {
        const node = this.refs.node;
        if (node) {
            node.setAttribute("class", this.getRootClassName());
        }
    }
    onCloseClick() {
        this.hide();
        this.props.closeCallback();
    }
    setMessage(message) {
        const node = this.refs.message;
        if (node) {
            node.innerHTML = message;
            node.setAttribute("title", message);
        }
    }
    show(message) {
        this.status = message ? STATUS.SHOWN : STATUS.HIDDEN;
        this.setMessage(message);
        this.setRootClassName();
    }
    hide() {
        if (this.status === STATUS.HIDDEN) {
            return;
        }
        this.status = STATUS.HIDING;
        this.setRootClassName();
        _.delay(() => {
            this.status = STATUS.HIDDEN;
            this.setRootClassName();
        }, 500);
    }
}
