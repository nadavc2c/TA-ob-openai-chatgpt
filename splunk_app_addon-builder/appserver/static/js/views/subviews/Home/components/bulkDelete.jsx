import React from "react";
import _ from "lodash";
import $ from "jquery";
import AppsDelete from "app/models/home/AppsDelete";
import { showDialog } from "app/utils/DialogUtil";
import { getFormattedMessage } from "app/utils/MessageUtil";
import style from "./homePageComponents.pcssm";
import PropTypes from "prop-types";
import Button from "@splunk/react-ui/Button";
import { splunkUtils } from "swc-aob/index";

class BulkDelete extends React.Component {
    static propTypes = {
        actions: PropTypes.object,
        mapping: PropTypes.array,
        deleteCandidate: PropTypes.object,
        checkboxStatus: PropTypes.bool,
        disabled: PropTypes.bool
    };
    constructor(...args) {
        super(...args);
    }

    modeChange() {
        $(".hideWhenDelete").toggle();
        if (!this.props.checkboxStatus) {
            this.props.actions.resetDeleteCandidate();
        }
        this.props.actions.toggleSelectBox();
    }

    bulkDeleteModal() {
        if (this.props.deleteCandidate.size) {
            showDialog({
                el: $("#delete-confirm-modal"),
                title: _.t("Delete Add-ons"),
                content: _.t(
                    "Are you sure you want to delete selected add-ons?"
                ),
                btnNoText: _.t("Cancel"),
                btnYesText: _.t("Delete"),
                yesCallback: dialog => {
                    dialog.disableYesNo();
                    this.bulkDelete(dialog);
                },
                noCallback: dialog => {
                    dialog.hideModal();
                }
            });
        } else {
            showDialog({
                type: "alert",
                el: $("#delete-confirm-modal"),
                title: _.t("Information"),
                content: _.t("Please select at least one add-on"),
                btnYesText: _.t("OK"),
                yesCallback: function(dialog) {
                    dialog.disableYesBtn();
                    dialog.hideModal();
                }
            });
        }
    }

    bulkDelete() {
        let appsDelete = new AppsDelete();
        let deleteCandidate = this.props.deleteCandidate;
        let actions = this.props.actions;
        actions.toggleLoadingTable(_.t("Deleting Add-on(s)...."));
        appsDelete.save(
            {
                names: Array.from(deleteCandidate)
            },
            {
                success: function(model, response) {
                    actions.toggleLoadingTable();
                    if (response.err_code) {
                        if (_.isEmpty(response.err_args.deleted_apps)) {
                            response.err_args.deleted_app_message = getFormattedMessage(
                                60,
                                {
                                    app: response.err_args.deleted_apps[0]
                                }
                            );
                        } else if (
                            response.err_args.deleted_apps.length === 1
                        ) {
                            response.err_args.deleted_app_message = getFormattedMessage(
                                62,
                                {
                                    app: response.err_args.deleted_apps[0]
                                }
                            );
                        } else {
                            response.err_args.deleted_app_message = getFormattedMessage(
                                63,
                                {
                                    apps: _.join(
                                        response.err_args.deleted_apps,
                                        ", "
                                    )
                                }
                            );
                        }
                        actions.setGeneralMessage(
                            getFormattedMessage(
                                response.err_code,
                                response.err_args
                            )
                        );
                        // reset the deleteCandidate list with the deleted list
                        let deletedAppList = response.deleted_app_list;
                        actions.resetDeleteCandidate();
                        _.forEach(deletedAppList, app => {
                            actions.toggleDeleteCandidate(app);
                        });
                    }
                    actions.bulkDelete();
                    actions.toggleSelectBox();
                },
                error: function() {
                    actions.toggleLoadingTable();
                    actions.setGeneralMessage(getFormattedMessage(1004));
                    return;
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    }

    render() {
        return (
            <span className={ style["home-control-group"] }>
                {this.props.checkboxStatus
                    ? <span>
                          <Button
                              onClick={ this.modeChange }
                              disabled={ this.props.disabled }
                          >
                              {_.t("Delete...")}
                          </Button>
                      </span>
                    : <span>
                          <Button
                              onClick={ this.modeChange }
                              disabled={ this.props.disabled }
                          >
                              {_.t("Cancel")}
                          </Button>
                          <Button
                              appearance="primary"
                              onClick={ this.bulkDeleteModal }
                              disabled={ this.props.disabled }
                          >
                              {_.t(
                                  "Delete (" +
                                      this.props.deleteCandidate.size +
                                      ")"
                              )}
                          </Button>
                      </span>}
            </span>
        );
    }
}

export default BulkDelete;
