import React from "react";
import _ from "lodash";
import Styles from "./SaveAndCancel.pcssm";
import classnames from "classnames";
//TODO this component should use following component as a child.
import ButtonGroup from "app/views/common/ButtonGroup.jsx";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const SaveAndCancel = ({
    btnSaveText,
    btnCancelText,
    disableSaveBtn,
    disableCancelBtn,
    onBtnSaveClick,
    onBtnCancelClick
}) => {
    return (
        <div className={ Styles.root } { ...createTestHook(__filename) }>
            <button
                { ...(disableSaveBtn ? { disabled: "disabled" } : {}) }
                className={ classnames(Styles.save, "btn", "btn-primary") }
                onClick={ () => {
                    if (disableSaveBtn) {
                        return;
                    }
                    onBtnSaveClick();
                } }
                { ...createTestHook(null, { componentName: "ta-btn-save" }) }
            >
                {btnSaveText}
            </button>
            <button
                { ...(disableCancelBtn ? { disabled: "disabled" } : {}) }
                className={ classnames(Styles.cancel, "btn") }
                onClick={ () => {
                    if (disableCancelBtn) {
                        return;
                    }
                    onBtnCancelClick();
                } }
                { ...createTestHook(null, { componentName: "ta-btn-cancel" }) }
            >
                {btnCancelText}
            </button>
        </div>
    );
};

SaveAndCancel.defaultProps = {
    btnSaveText: _.t("Save"),
    btnCancelText: _.t("Cancel"),
    disableSaveBtn: false,
    disableCancelBtn: false,
    onBtnSaveClick: _.noop,
    onBtnCancelClick: _.noop
};

SaveAndCancel.propTypes = {
    btnSaveText: PropTypes.string,
    btnCancelText: PropTypes.string,
    disableSaveBtn: PropTypes.bool,
    disableCancelBtn: PropTypes.bool,
    onBtnSaveClick: PropTypes.func,
    onBtnCancelClick: PropTypes.func
};

export default SaveAndCancel;
