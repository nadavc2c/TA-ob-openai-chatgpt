import _ from "lodash";
import $ from "jquery";
import React from "react";
import ReactDOM from "react-dom";
import BaseSubViewWithRedux from "app/views/subviews/BaseSubViewWithRedux";
import CheckCIMAvailable from "app/models/build_cim/check_cim_available";
import MergeConfs from "app/models/build_cim/merge_confs_from_default_to_local";
import { showDialog } from "app/utils/DialogUtil";
import {
    getFormattedMessage
} from "app/utils/MessageUtil";
import store from "app/redux/stores/cimMapping";
import actions from "app/redux/actions/cimMapping";
import Root from "./CIMMMappingHome/Master.jsx";
import styles from "./Master.pcssm";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import { splunkUtils } from "swc-aob/index";

export default BaseSubViewWithRedux.extend({
    initialize() {
        BaseSubViewWithRedux.prototype.initialize.apply(this, arguments);
    },
    getStore() {
        return store;
    },
    getActions() {
        return actions;
    },
    getRootComponent() {
        return Root;
    },
    render() {
        this._renderLoadingScreen();
        new CheckCIMAvailable().save(
            {},
            {
                success: (model, data) => {
                    if (data.data.successful) {
                        BaseSubViewWithRedux.prototype.render.apply(
                            this,
                            arguments
                        );
                    }
                    else{
                        // To collect the error from the server
                        showDialog({
                            el: $("#delete-confirm-modal"),
                            title: _.t("Warning"),
                            content: getFormattedMessage(5203, {
                                names: data.data.conf_names
                            }),
                            btnNoText: _.t("Cancel"),
                            btnYesText: _.t("Merge"),
                            yesCallback: () => {
                                new MergeConfs().save(
                                    {},
                                    {
                                        success: (model, data) => {
                                            if (
                                                data.data &&
                                                data.data.successful
                                            ) {
                                                BaseSubViewWithRedux.prototype.render.apply(
                                                    this,
                                                    arguments
                                                );
                                            }
                                        }
                                    }
                                );
                            },
                            noCallback: () => {
                                this.controller.navigate({
                                    view: "main"
                                });
                            }
                        });
                    }
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
        return this;
    },
    _renderLoadingScreen() {
        ReactDOM.render(
            <LoadingScreen
                loadCondition={ true }
                loadingStyle={ styles["loadingStyle"] }
                loadingText={ _.t("Check Data Models Availability") }
            />,
            this.el
        );
    }
});
