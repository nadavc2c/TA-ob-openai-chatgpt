import Root from "./Home/Master.jsx";
import BaseSubViewWithRedux from "app/views/subviews/BaseSubViewWithRedux.js";
import store from "app/redux/stores/sourcetype";
import actions from "app/redux/actions/sourcetype";
import _ from 'lodash';
import checkFeAvailableModel
    from "app/models/configure_sourcetype/check_fe_available.js";
import mergeConfModel
    from "app/models/configure_sourcetype/merge_confs_from_default_to_local";
import { showDialog } from "app/utils/DialogUtil";
import {
    getFormattedMessage
} from "app/utils/MessageUtil";
import $ from 'jquery';
import { splunkUtils } from "swc-aob/index";

export default BaseSubViewWithRedux.extend({
    initialize: function() {
        BaseSubViewWithRedux.prototype.initialize.apply(this, arguments);
        const appName = this.getProps().appInfo.appName;
        new checkFeAvailableModel().save(
            { app_name: appName },
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
                            content: getFormattedMessage(5201, {
                                names: data.data.conf_names
                            }),
                            btnNoText: _.t("Cancel"),
                            btnYesText: _.t("Merge"),
                            yesCallback: () => {
                                new mergeConfModel().save(
                                    { app_name: appName },
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
                                        },
                                        'headers': {
                                            'X-Splunk-Form-Key': splunkUtils.getFormKey()
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
    },
    getStore() {
        return store;
    },
    getActions() {
        return actions;
    },
    getRootComponent() {
        return Root;
    }
});
