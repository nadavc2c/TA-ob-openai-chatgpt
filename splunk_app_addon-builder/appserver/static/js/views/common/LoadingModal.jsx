import React, { Component } from "react";
import Modal from "@splunk/react-ui/Modal";
import _ from "lodash";
import PropTypes from "prop-types";
import style from "./LoadingModal.pcssm";

export default class LoadingModal extends Component {
    static propTypes = {
        open: PropTypes.bool,
        loadingText: PropTypes.string
    };
    static defaultProps = {
        open: false,
        loadingText: "Loading..."
    };
    constructor(props, context) {
        super(props, context);
    }

    render() {
        const { open, loadingText } = this.props;
        return (
            <Modal open={ open }>
                <Modal.Body className={ style["loadingModal"] }>
                    <div>
                        {_.t(loadingText)}
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
