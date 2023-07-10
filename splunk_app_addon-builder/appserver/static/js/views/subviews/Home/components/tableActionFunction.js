import UpgradeApp from "app/models/flow_wizard/UpgradeApp";
import { showDialog } from "app/utils/DialogUtil";
import { getFormattedMessage, getMessageFromModel } from "app/utils/MessageUtil";
import BasicInfoDialog from "app/views/subviews/Home/BasicInfoDialog";
import CurrentTa from "app/models/flow_wizard/current_ta";
import _ from "lodash";
import Collector from "app/profiles/partyjsCollector";
import exportProjectModel from "app/models/home/ExportProject";
import AppDelete from "app/models/home/AppDelete";
import $ from "jquery";
import React from "react";
import ReactDOM from "react-dom";
import Modal from "@splunk/react-ui/Modal";
import LoadingScreen from "app/views/common/LoadingScreen.jsx";
import style from "./homePageComponents.pcssm";
import { splunkUtils } from "swc-aob/index";

let tableActionsFac = function(action_emitter) {
    function confirmUpgradeDecorator(callback) {
        return (e, model) => {
            if (!!model.get('create_by_builder') && !!model.getIn(["upgrade_info", "err_code"])) {
                showDialog({
                    el: $("#upgrade-confirm-modal"),
                    title: _.t("Upgrading an add-on"),
                    content: getFormattedMessage(model.getIn(["upgrade_info", "err_code"])),
                    btnNoText: _.t("Cancel"),
                    btnYesText: _.t("Upgrade"),
                    yesCallback: () => {
                        callback(e, model);
                    }
                });
            } else {
                callback(e, model);
            }
        };
    }

    const tag = $("<div></div>");
    function openModal(text) {
        ReactDOM.render(
            <Modal open={ true }>
                <Modal.Body className={ style["loadingModal"] }>
                    <LoadingScreen loadCondition={ true } loadingText={ text } loadingStyle={ style["loadingStyleModal"] } />
                </Modal.Body>
            </Modal>,
            tag[0]
        );
    }
    function openLoadingModal() {
        openModal("Loading add-on......");
    }
    function closeModal() {
        ReactDOM.unmountComponentAtNode(tag[0]);
    }
    function errorCallback(messagesId, param, dialog) {
        action_emitter.setGeneralMessage(getFormattedMessage(messagesId, param));
        dialog && dialog.hideModal();
    }

    function saveCurrentTaSuccess(model, subviewUri) {
        if (subviewUri) {
            window.location.href = "tab_main_flow" + subviewUri;
        } else {
            window.location.href = "tab_main_flow";
        }
    }

    function upgradeSuccess(upgradeModel, projectModel, taSubViewUri = undefined) {
        if(upgradeModel.has('err_code')) {
            action_emitter.setGeneralMessage(getMessageFromModel(upgradeModel));
            closeModal();
        } else {
            var ta = new CurrentTa();
            ta.save(
                {
                    app_name: projectModel.get("id"),
                    app_display_name: projectModel.get("name"),
                    built: projectModel.get("create_by_builder") ? "yes" : "no"
                },
                {
                    success: function() {
                        saveCurrentTaSuccess(projectModel, taSubViewUri);
                    },
                    error: () => {
                        errorCallback(1004);
                        _.delay(() => {
                            closeModal();
                        }, 500);
                    },
                    'headers': {
                        'X-Splunk-Form-Key': splunkUtils.getFormKey()
                    }
                }
            );
        }
    }
    // exposed
    function exportPackage(event, row) {
        let exportLink = $('<a class="ta-project-export-link"></a>');
        const appID = row.get("id");
        var exportModel = new exportProjectModel();
        openModal(getFormattedMessage(72));
        exportModel.save(
            {
                app: appID
            },
            {
                success: (model, response) => {
                    if (response.err_code) {
                        action_emitter.setGeneralMessage(getFormattedMessage(response.err_code, response.err_args));
                        return;
                    }

                    let downloadLink = exportLink;
                    downloadLink.attr("href", model.getDownloadLink());
                    document.body.appendChild(downloadLink[0]);
                    downloadLink[0].click();
                    document.body.removeChild(downloadLink[0]);
                    _.delay(() => {
                        closeModal();
                    }, 1000);
                },
                error: model => {
                    errorCallback(43, { app: model.get("app") });
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    }

    function deleteAddon(e, row) {
        e.stopPropagation();
        let ta_name = row.get("id");
        let appDelete = new AppDelete();

        let successCallback = function(model, dialog) {
            if (model.has("err_code")) {
                errorCallback(model.get("err_code"), model.get("err_args"), dialog);
                return;
            }
            // dialog.enableYesNo();
            Collector.collect("track_deletion", {
                type: "add-on",
                data: {
                    app_name: ta_name
                }
            });
            action_emitter.deleteItem(ta_name);
            dialog.hideModal();
        };

        showDialog({
            el: $("#delete-confirm-modal"),
            title: _.t("Deleting an add-on"),
            content: getFormattedMessage(3, ta_name),
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Delete"),
            yesCallback: dialog => {
                dialog.disableYesNo();
                appDelete.save(
                    {
                        name: ta_name
                    },
                    {
                        success: model => {
                            successCallback(model, dialog);
                        },
                        error: () => errorCallback(1003, ta_name, dialog),
                        'headers': {
                            'X-Splunk-Form-Key': splunkUtils.getFormKey()
                        }
                    }
                );
                return false;
            }
        });
    }

    function goToMainFlow(e, model) {
        openLoadingModal();
        e.stopPropagation();
        var upgrade = new UpgradeApp();
        upgrade.save(
            {
                app_name: model.get("id")
            },
            {
                success: () => {
                    upgradeSuccess(upgrade, model);
                },
                error: () => {
                    errorCallback(19, model.get("name"));
                    closeModal();
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    }

    function modifyInline(e, row) {
        e.stopPropagation();
        var dialog = new BasicInfoDialog({
            el: $("#basic-info-modal"),
            title: _.t("Edit Add-on"),
            rootView: null,
            btnYesText: _.t("Change"),
            btnNoText: _.t("Cancel"),
            actions: action_emitter,
            appName: row.get("id")
        });
        dialog.showModal();
    }

    function goValidation(e, model) {
        openLoadingModal();
        e.stopPropagation();
        var upgrade = new UpgradeApp();
        upgrade.save(
            {
                app_name: model.get("id")
            },
            {
                success: () => {
                    upgradeSuccess(upgrade, model, "?view=validation");
                },
                error: () => {
                    errorCallback(19, model.get("name"));
                    closeModal();
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    }

    function goAlert(e, model) {
        openLoadingModal();
        e.stopPropagation();
        var upgrade = new UpgradeApp();
        upgrade.save(
            {
                app_name: model.get("id")
            },
            {
                success: () => {
                    upgradeSuccess(upgrade, model, "?view=modular-alert");
                },
                error: () => {
                    errorCallback(19, model.get("name"));
                    closeModal();
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    }

    function goExtraction(e, model) {
        openLoadingModal();
        e.stopPropagation();
        var upgrade = new UpgradeApp();
        upgrade.save(
            {
                app_name: model.get("id")
            },
            {
                success: () => {
                    upgradeSuccess(upgrade, model, "?view=field-extraction");

                },
                error: () => {
                    errorCallback(19, model.get("name"));
                    closeModal();
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    }

    function goCim(e, model) {
        openLoadingModal();
        e.stopPropagation();
        var upgrade = new UpgradeApp();
        upgrade.save(
            {
                app_name: model.get("id")
            },
            {
                success: () => {
                    upgradeSuccess(upgrade, model, "?view=cim-mapping");
                },
                error: () => {
                    errorCallback(19, model.get("name"));
                    closeModal();
                },
                'headers': {
                    'X-Splunk-Form-Key': splunkUtils.getFormKey()
                }
            }
        );
    }

    function createNewAddon() {
        var dialog = new BasicInfoDialog({
            el: $("#basic-info-modal"),
            title: _.t("Create Add-on"),
            rootView: null,
            actions: action_emitter,
            btnNoText: _.t("Cancel"),
            btnYesText: _.t("Create")
        });
        dialog.showModal();
    }

    return {
        goToMainFlow: confirmUpgradeDecorator(goToMainFlow),
        modifyInline,
        goValidation: confirmUpgradeDecorator(goValidation),
        goAlert: confirmUpgradeDecorator(goAlert),
        createNewAddon,
        deleteAddon,
        exportPackage,
        goCim: confirmUpgradeDecorator(goCim),
        goExtraction: confirmUpgradeDecorator(goExtraction)
    };
};

export { tableActionsFac };
