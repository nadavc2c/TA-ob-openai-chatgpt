import React from "react";
import _ from "lodash";
import Styles from "./ButtonGroup.pcssm";
import classnames from "classnames";
import { connect } from "react-redux";
import actions from "app/redux/actions/cimMapping";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const ButtonGroup = ({ dispatch }) => {
    return (
        <div className={ Styles.root } { ...createTestHook(__filename) }>
            <button
                className={ classnames(Styles.exit, "btn") }
                onClick={ () => {
                    dispatch(
                        actions.getAction("SET_NAVIGATION", {
                            view: "cim-mapping"
                        })
                    );
                } }
            >
                {_.t("Done")}
            </button>
        </div>
    );
};

ButtonGroup.propTypes = {
    dispatch: PropTypes.func
};

export default connect()(ButtonGroup);
