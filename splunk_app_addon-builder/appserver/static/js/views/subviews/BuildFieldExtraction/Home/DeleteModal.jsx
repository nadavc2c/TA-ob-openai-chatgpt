import React from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import { connect } from "react-redux";
import actions from "app/redux/actions/fieldExtraction";
import { getFormattedMessage } from "app/utils/MessageUtil";
import Modal from "@splunk/react-ui/Modal";
import Button from "@splunk/react-ui/Button";
import P from "@splunk/react-ui/Paragraph";
import style from "./DeleteModal.pcssm";

class DeleteModal extends React.Component {
    static propTypes = {
        appName: PropTypes.string,
        closeModal: PropTypes.func,
        deleteSourceTypeModal: PropTypes.object,
        clearFieldExtraction: PropTypes.func,
        deletePending: PropTypes.bool,
        deleteFail: PropTypes.bool,
        deleteSuccess: PropTypes.bool,
        reload: PropTypes.func
    };

    constructor(...args) {
        super(...args);
    }

    componentWillReceiveProps(nextProps) {
        const { deleteFail, deleteSuccess, reload } = this.props;

        if (!deleteSuccess && nextProps.deleteSuccess) {
            this.onRequestClose();
            reload();
        }
        if (!deleteFail && nextProps.deleteFail) {
            this.onRequestClose();
        }
    }

    onRequestClose() {
        this.props.closeModal();
    }

    onSubmitClick() {
        const {
            appName,
            deleteSourceTypeModal,
            clearFieldExtraction
        } = this.props;
        clearFieldExtraction({
            app_name: appName,
            sourcetype: deleteSourceTypeModal.get("sourcetype")
        });
    }

    render() {
        const { deleteSourceTypeModal, deletePending } = this.props;
        return (
            <Modal
                onRequestClose={ this.onRequestClose }
                open={ deleteSourceTypeModal.get("isOpen") }
                style={ { width: "550px" } }
            >
                <Modal.Header
                    className={ style.noClose }
                    title={ _.t("Clear Field Extraction Results?") }
                />
                <Modal.Body>
                    <P>
                        {getFormattedMessage(
                            4014,
                            deleteSourceTypeModal.get("sourcetype")
                        )}
                    </P>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={ this.onRequestClose }
                        disabled={ deletePending }
                        label={ _.t("No, maybe later") }
                    />
                    <Button
                        appearance="primary"
                        onClick={ this.onSubmitClick }
                        disabled={ deletePending }
                        label={ _.t("Yes, clear now!") }
                    />
                </Modal.Footer>
            </Modal>
        );
    }
}
const mapStateToProps = state => {
    const pendings = state.get("pendings");
    return {
        deleteSourceTypeModal: state.get("deleteSourceTypeModal"),
        deletePending: actions.isActionPending(
            pendings,
            "CLEAR_FIELD_EXTRACTION$"
        ),
        deleteSuccess: actions.isActionResolved(
            pendings,
            "CLEAR_FIELD_EXTRACTION$"
        ),
        deleteFail: actions.isActionRejected(
            pendings,
            "CLEAR_FIELD_EXTRACTION$"
        )
    };
};

const mapDispatchToProps = dispatch => {
    return {
        closeModal: () => {
            dispatch(actions.getAction("CLOSE_DELETE_MODAL"));
        },
        clearFieldExtraction: params => {
            dispatch(actions.getAction("CLEAR_FIELD_EXTRACTION$", params));
        }
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(DeleteModal);
