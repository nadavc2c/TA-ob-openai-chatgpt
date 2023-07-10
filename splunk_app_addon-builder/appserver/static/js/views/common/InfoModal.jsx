import React, { Component } from "react";
import Modal from "@splunk/react-ui/Modal";
import _ from "lodash";
import { getFormattedMessage } from "app/utils/MessageUtil";
import style from "./InfoModal.pcssm";
import classnames from "classnames";
import PropTypes from "prop-types";

export default class InfoModal extends Component {
    static propTypes = {
        okCallback: PropTypes.func,
        cancelCallback: PropTypes.func,
        initOpen: PropTypes.bool,
        contentNumber: PropTypes.number
    };
    static defaultProps = {
        okCallback: _.noop,
        cancelCallback: _.noop,
        initOpen: false,
        contentNumber: 0
    };
    constructor(props, context) {
        super(props, context);
        this.state = {
            open: !!this.props.initOpen
        };
    }
    open() {
        this.setState({
            open: true
        });
    }

    closeOk() {
        this.props.okCallback();
        this.setState({
            open: false
        });
    }
    closeCancel() {
        this.props.cancelCallback();
        this.setState({
            open: false
        });
    }

    render() {
        const { open } = this.state;
        return (
            <Modal open={ open }>
                <Modal.Header title={ _.t("Info") } onClose={ this.closeCancel } />
                <Modal.Body>
                    <div className={ style["modalBody"] }>
                        {_.t(getFormattedMessage(this.props.contentNumber))}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    {this.props.cancelCallback !== _.noop &&
                        <button
                            onClick={ this.closeCancel }
                            label="cancel"
                            className={ classnames(
                                style["cancelButton"],
                                "btn",
                                "btn-default"
                            ) }
                        >
                            {_.t("Cancel")}
                        </button>}
                    <button
                        className={ classnames("btn", "btn-primary") }
                        onClick={ this.closeOk }
                        label="ok"
                    >
                        {_.t("Ok")}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
