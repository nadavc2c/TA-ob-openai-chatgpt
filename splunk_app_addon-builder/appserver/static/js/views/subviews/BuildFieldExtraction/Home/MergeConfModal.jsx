import React from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import { connect } from "react-redux";
import actions from "app/redux/actions/fieldExtraction";
import { getFormattedMessage } from "app/utils/MessageUtil";
import Modal from "@splunk/react-ui/Modal";
import Button from "@splunk/react-ui/Button";
import P from "@splunk/react-ui/Paragraph";

class MergeModal extends React.Component {
    static propTypes = {
        mergeConf: PropTypes.func,
        toggleModal: PropTypes.func,
        isOpen: PropTypes.bool,
        mergePending: PropTypes.bool,
        row: PropTypes.object,
        appName: PropTypes.string,
        confNames: PropTypes.string,
    };

    constructor(...args) {
        super(...args);
    }

    onRequestClose() {
        this.props.toggleModal();
    }

    onSubmitClick() {
        this.props.mergeConf(this.props.row, this.props.appName);
    }

    render() {
        const { isOpen, mergePending, confNames } = this.props;
        return (
            <Modal
                onRequestClose={ this.onRequestClose }
                open={ isOpen }
                style={ { width: "550px" } }
            >
                <Modal.Header
                    title={ _.t("Merge Default And Local Folder") }
                />
                <Modal.Body>
                    <span dangerouslySetInnerHTML={ {
                        __html: getFormattedMessage(5202, {
                            names: confNames
                        })
                    } } />
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={ this.onRequestClose }
                        disabled={ mergePending }
                        label={ _.t("Cancel") }
                    />
                    <Button
                        appearance="primary"
                        onClick={ this.onSubmitClick }
                        disabled={ mergePending }
                        label={ _.t("Merge") }
                    />
                </Modal.Footer>
            </Modal>
        );
    }
}
const mapStateToProps = state => {
    const pendings = state.get("pendings");
    const mergeConfModalModel = state.get('mergeConfModal');
    return {
        confNames: mergeConfModalModel.get("confNames"),
        isOpen: mergeConfModalModel.get("isOpen"),
        error: mergeConfModalModel.get("error"),
        row: mergeConfModalModel.get("currentEditingRow"),
        mergePending: actions.isActionPending(
            pendings,
            "MERGE_CONF$"
        ),
        mergeSuccess: actions.isActionResolved(
            pendings,
            "MERGE_CONF$"
        ),
        mergeFail: actions.isActionRejected(
            pendings,
            "MERGE_CONF$"
        )
    };
};

const mapDispatchToProps = dispatch => {
    return {
        toggleModal: () => {
            dispatch(actions.getAction("TOGGLE_MERGE_MODAL", null));
        },
        mergeConf: (row, app_name) =>{
            dispatch(actions.getAction("MERGE_CONF$", { row, app_name }));
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(MergeModal);
