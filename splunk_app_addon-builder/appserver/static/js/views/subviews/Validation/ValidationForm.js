import $ from "jquery";
import _ from "lodash";
import { splunkUtils } from "swc-aob/index";
import ValidatorCollection from "app/collections/ta_validation/ta_validators";
import ValidationStart from "app/models/ta_validation/start_validation";
import ValidationCancel from "app/models/ta_validation/cancel_validation";
import ValidationStatus from "app/models/ta_validation/ta_validation_status";
import ValidationLoad from "app/models/ta_validation/load_validation";
import MultiSelectInputControl
    from "app/components/controls/MultiSelectInputControl";
import * as MessageUtil from "app/utils/MessageUtil";
import * as DialogUtil from "app/utils/DialogUtil";
import * as LocalStorageUtil from "app/utils/LocalStorageUtil";
import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";
import Template from "contrib/text!./ValidationForm.html";
import WaitSpinner from "app/components/WaitSpinner";

const PROGRESS_POOL_INTERVAL = 1000;
export default BaseSubViewComponent.extend({
    className: "ta-validation-form-container pull-left",
    template: Template,
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);

        this.models = {
            jobMeta: new ValidationStart(),
            jobStatus: new ValidationStatus(),
            validators: new ValidatorCollection(),
            jobCancel: new ValidationCancel()
        };
        this.models.jobMeta.set("app_name", this.controller.getAppName());
        this.models.jobStatus.set("app_name", this.controller.getAppName());
        this.listenTo(
            this.models.jobStatus,
            "change:progress",
            this.onProgressChange
        );
        this._validatorMap = {};
        this._isCheckingProcess = false;
        this._isTerminatable = false;
        this.validate_categories = LocalStorageUtil.getValidateCategories();
        LocalStorageUtil.clearValidateCategories();
    },
    getValidatorMap() {
        return this._validatorMap;
    },
    events: {
        "click .validate-button": "onValidateClick"
    },
    onValidateClick(e) {
        if (this._isTerminatable) {
            this.showValidatingMsg();
            this.updateValidatingMsg(_.t("Terminating validation..."));
            this.onValidationTerminated();
            // terminate validation
            this.models.jobCancel
                .fetch({
                    type: "POST",
                    data: {
                        app_name: this.controller.getAppName()
                    }
                })
                .done(() => {
                    this.showValidatingMsg();
                    this.updateValidatingMsg(
                        _.t("The validation has been terminated.")
                    );
                    this.hideProgressImg();
                    this.enableValidate();
                });
        } else {
            // start validation
            if ($(e.currentTarget).attr("disabled")) {
                return;
            }
            let validators = this.model.get("validators");
            if (!validators) {
                DialogUtil.showDialog({
                    el: $("#alert-modal"),
                    type: "alert",
                    title: _.t("Alert"),
                    content: MessageUtil.getFormattedMessage(1)
                });
                return;
            }
            this.children.validationSelector.disable();
            if (this.intervalId) {
                window.clearInterval(this.intervalId);
            }
            let jobMeta = this.models.jobMeta;
            jobMeta.set({
                validators: validators
            });

            this.disableValidate();
            this.checkingProgress = false;
            this.showValidatingMsg();
            this.updateValidatingMsg(_.t("Preparing validation..."));
            jobMeta.save(
                {},
                {
                    success: (model, response) => {
                        if (response.err_code) {
                            var warning = MessageUtil.getFormattedMessage(
                                response.err_code
                            );
                            DialogUtil.showDialog({
                                el: $("#alert-modal"),
                                title: _.t("Alert"),
                                content: warning,
                                btnNoText: _.t("Cancel"),
                                btnYesText: _.t("Update Settings"),
                                yesCallback: function() {
                                    // localstorage save validate category
                                    LocalStorageUtil.setValidateCategories(
                                        validators
                                    );
                                    // goto page
                                    window.location.href =
                                        "tab_home?view=settings";
                                }
                            });
                            this.onValidationFinished(true);
                            this.changeToValidate();
                        } else {
                            this.models.jobStatus.set(response);
                            this.showValidatingMsg();
                            this.startStatusChecking(response.validation_id);
                        }
                    },
                    error: (model, xhr, options) => {
                        this.onValidationFinished(true);
                        console.log(
                            "fail to submit validation job.",
                            model,
                            xhr,
                            options
                        );
                    },
                    'headers': {
                        'X-Splunk-Form-Key': splunkUtils.getFormKey()
                    }
                }
            );
        }
    },
    startStatusChecking(validation_id) {
        this.checkingProgress = true;
        this.model.trigger("startValidation", validation_id);
        this.models.jobStatus.unset("progress");
        this.intervalId = window.setInterval(
            _.bind(this.onProgress, this),
            PROGRESS_POOL_INTERVAL
        );
        this.changeToTerminate();
    },
    onProgress() {
        let jobStatus = this.models.jobStatus;
        jobStatus.unset("error");
        jobStatus.fetch({
            success: (model, response) => {
                if (response.error) {
                    this.onValidationFinished();
                    console.log(
                        "get error when check the validation progress. error:",
                        response.error
                    );
                } else {
                    jobStatus.set("progress", response.progress);
                    if (response.progress < 100) {
                        var d = new Date();
                        console.debug(
                            "Get the job status. response:",
                            response,
                            " @ ",
                            d,
                            d.getMilliseconds()
                        );
                    } else {
                        this.onValidationFinished();
                        console.info(
                            "validation job " +
                                model.get("validation_id") +
                                " is done."
                        );
                    }
                }
            },
            error: model => {
                this.onValidationFinished();
                console.log(
                    "fail to get the status of validation job. validation_id = " +
                        model.get("validation_id")
                );
            }
        });
    },
    onValidationFinished(silent = false, validationId = undefined) {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.children.validationSelector) {
            this.children.validationSelector.enable();
        }
        this.changeToValidate();
        this.hideValidatingMsg();
        this.checkingProgress = false;
        if (!silent) {
            this.model.trigger("finishValidation", validationId);
        }
    },
    onValidationTerminated(validationId = undefined) {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.checkingProgress = false;
        this.changeToValidate(false);
        this.children.validationSelector.enable();
        this.model.trigger("terminateValidation", validationId);
    },
    render() {
        this.$el.html(this.compiledTemplate({}));
        new WaitSpinner({
            el: this.$(".ta-wait-spinner")
        }).render();
        let child = this.createChild(
            "validationSelector",
            MultiSelectInputControl,
            {
                model: this.model,
                modelAttribute: "validators",
                placeholder: _.t("Select a validation category:"),
                items: []
            }
        );
        child.disable();
        this.changeToTerminate();
        this.$(".ta-validation-selector-container").append(child.render().$el);

        // load previous validation results
        this.disableValidate();
        this.updateValidatingMsg(_.t("Loading"));
        var loadValidation = new ValidationLoad();
        loadValidation
            .fetch({
                type: "POST",
                data: {
                    app_name: this.controller.getAppName()
                }
            })
            .done(response => {
                // get backend validators info
                let validators = this.models.validators;
                validators.fetch().done(() => {
                    validators.each(model => {
                        let name = model.get("name");
                        let label = model.get("label");
                        this._validatorMap[name] = label;
                    });
                    if (response.validators) {
                        let validators = response.validators;
                        var currValidators = {};
                        _.each(this._validatorMap, (value, key) => {
                            if (validators.indexOf(key) !== -1)
                                {currValidators[key] = value;}
                        });
                        this.renderValidatorSelection(child, currValidators);
                        this.showValidatingMsg();
                        if (response.status === "job_finished") {
                            this.model.trigger("showDashboard");
                            this.onValidationFinished(
                                false,
                                response.validation_id
                            );
                            this.enableValidate();
                        } else if (response.status === "job_error") {
                            this.model.trigger("showDashboard");
                            this.onValidationTerminated(response.validation_id);
                            this.enableValidate();
                        } else {
                            this.startStatusChecking(response.validation_id);
                        }
                    } else {
                        this.renderValidatorSelection(
                            child,
                            this._validatorMap
                        );
                        this.changeToValidate();
                        this.hideValidatingMsg();
                    }
                    return this;
                });
            });

        return this;
    },
    renderValidatorSelection: function(child, validatorMap) {
        var items = [];
        _.each(this._validatorMap, (value, key) => {
            items.push({
                value: key,
                label: value
            });
        });
        child.setItems(items);
        child.enable();
        this.model.set(
            "validators",
            splunkUtils.fieldListToString(Object.keys(validatorMap))
        );
    },
    onProgressChange: function() {
        var val = +this.models.jobStatus.get("progress");
        if (isNaN(val)) {
            val = 0;
        }
        val = Math.max(0, Math.min(100, val));

        this.updateValidatingMsg(_.t("Validation progress: ") + val + "%");
    },
    changeToTerminate(enableBtn = true) {
        this.$(".validate-button").text(_.t("Stop"));
        if (enableBtn) {
            this.enableValidate();
        } else {
            this.disableValidate();
        }
        this._isTerminatable = true;
    },

    changeToValidate(enableBtn = true) {
        this.$(".validate-button").text(_.t("Validate"));
        if (enableBtn) {
            this.enableValidate();
        } else {
            this.disableValidate();
        }
        this._isTerminatable = false;
    },

    disableValidate() {
        this.disableElement(".validate-button");
    },

    enableValidate() {
        this.enableElement(".validate-button");
    },

    showValidatingMsg() {
        this.$(".ta-validation-progress-msg").show();
    },
    hideValidatingMsg() {
        this.$(".ta-validation-progress-msg").hide();
    },
    updateValidatingMsg(msg) {
        this.showProgressImg();
        this.$(".ta-validation-progress-msg .ta-msg").text(msg);
    },
    hideProgressImg() {
        this.$(".ta-wait-spinner").hide();
    },
    showProgressImg() {
        this.$(".ta-wait-spinner").show();
    }
});
