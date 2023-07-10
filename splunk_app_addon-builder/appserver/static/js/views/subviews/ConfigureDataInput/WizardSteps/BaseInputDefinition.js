import $ from "jquery";
import _ from "lodash";
import ReactDOM from "react-dom";
import BaseStepView
    from "app/views/subviews/ConfigureDataInput/WizardSteps/BaseStepView";
import * as ModInputTestRunner from "app/utils/ModInputTestRunner";
import CreateDataInput from "app/models/create_project/create_data_input";
import EditDataInput from "app/models/create_project/edit_data_input";
import OutputAreaView from "app/views/common/OutputArea";
import Collector from "app/profiles/partyjsCollector";
import { preprocessHightlightLine } from "app/utils/preprocessHightlightLine";
import jsBeautify from "js-beautify";

const isLikeJSON = source => {
    let isJSON = false;
    let tempJson;
    try {
        tempJson = JSON.parse(source);
        isJSON = true;
    } catch (e) {
    } finally {
        return isJSON && _.isObject(tempJson);
    }
};

const isLikeHTML = source => {
    // <foo> - looks like html
    var trimmed = source.replace(/^[ \t\n\r]+/, "");
    return trimmed && trimmed.substring(0, 1) === "<";
};

let defaultProcessCheckInterval = 2000;
const BaseInputDefinition = BaseStepView.extend({
    initialize() {
        BaseStepView.prototype.initialize.apply(this, arguments);
        this.processCheckInterval =
            this.options.processCheckInterval || defaultProcessCheckInterval;
    },
    remove() {
        ReactDOM.unmountComponentAtNode(this.$(".ta-parameters-container")[0]);
        BaseStepView.prototype.remove.apply(this, arguments);
    },
    validate(stepModel, isSteppingNext) {
        this.clearError();
        this.setModelValues();
        if (isSteppingNext) {
            return this.saveModInput(true);
        }
    },
    setModelValues() {
        // To be implemented by children.
    },
    enableAllBtns() {
        this.stepModel.trigger("enableNext");
        this.stepModel.trigger("hideSpin");
        this.enableTestBtn();
        this.enableSaveBtn();
    },
    // if save is triggered by clicking finish button, isStepNext = true
    // if save is triggered by clicking the save button, isStepNext = false
    saveModInput(isStepNext) {
        let currentModel = this.model.clone();
        let originalModel = this.modelCloned
            ? this.modelCloned.clone()
            : currentModel;
        const backList = [
            "global_component",
            "_command",
            "_rest_api_url",
            "_rest_api_method"
        ];
        _.each(backList, val => {
            currentModel.unset(val);
            originalModel.unset(val);
        });
        // this.model should be prepared when calling this.
        // return a promise
        let changed = false || isStepNext; // if clicking finish. always save the input
        // unset reload_input before comparing changes
        currentModel.unset("reload_input", { silent: true });
        if (this.parentView.isEditing() && !changed) {
            changed = !_.isEqual(currentModel.toJSON(), originalModel.toJSON());
        }
        currentModel.set({ reload_input: isStepNext }, { silent: true }); // only reload input when clicking finish
        let result = this.validateModel();
        this.stepModel.trigger("disableNext");
        this.stepModel.trigger("showSpin", _.t("Saving..."));
        this.disableTestBtn();
        this.disableSaveBtn();
        let saveModInputPromise = $.Deferred();
        if (result) {
            let isEditing = this.parentView.isEditing();
            let needSaveInput = !isEditing || changed;
            if (needSaveInput) {
                let request = isEditing
                    ? new EditDataInput()
                    : new CreateDataInput();
                request
                    .save(currentModel.toJSON())
                    .then(
                        (...args) => {
                            if (needSaveInput) {
                                // only handle the result when save is needed.
                                if (args[0].err_code) {
                                    return $.Deferred().reject(args[0]);
                                }
                                let updatedInputMeta = args[0].meta;

                                if (updatedInputMeta) {
                                    if (!isStepNext) {
                                        // if no next page, we should change the mode of wizard
                                        // after saving input, user can not change the input type
                                        this.parentView.setEditing(true);
                                    }
                                    this.modelCloned = this.parentView.makeCloneModel();
                                    this.model.set(
                                        "uuid",
                                        updatedInputMeta.uuid
                                    );
                                    this.parentView.setChanged(true);
                                }
                                if (!isEditing) {
                                    let collectedData = _.omit(
                                        this.model.toJSON(),
                                        [
                                            "global_settings",
                                            "global_component",
                                            "_command",
                                            "_rest_api_url",
                                            "_rest_api_method",
                                            "uuid",
                                            "parameters",
                                            "code"
                                        ]
                                    );
                                    Collector.collect("track_creation", {
                                        type: "modular-input",
                                        data: collectedData
                                    });
                                }
                            }
                            this.showCheckIcon();
                            this.enableAllBtns();
                            if (this.setDirty && _.isFunction(this.setDirty)) {
                                this.setDirty(false);
                            }
                        },
                        arg => {
                            let errValue;
                            if (_.has(arg, "err_code")) {
                                errValue = arg;
                            } else {
                                errValue = {
                                    err_code: this.parentView.isEditing()
                                        ? 3103
                                        : 3104,
                                    err_args: {
                                        name: this.model.get("name")
                                    }
                                };
                            }
                            return $.Deferred().reject(errValue);
                        }
                    )
                    .then(
                        () => {
                            // goto next page, success
                            saveModInputPromise.resolve();
                        },
                        error => {
                            this.showFormattedError(
                                error.err_code,
                                error.err_args
                            );
                            this.enableAllBtns();
                        }
                    );
            } else {
                this.showCheckIcon();
                this.enableAllBtns();
                // No need to save, just resolve the promise
                saveModInputPromise.resolve();
            }
        } else {
            this.enableAllBtns();
            saveModInputPromise.reject();
        }
        return saveModInputPromise.promise();
    },
    validateModel() {
        // should overwrite this to validate the user input data
        return true;
    },
    disableSaveBtn() {
        this.hideCheckIcon();
        return this.disableElement(".ta-btn-save");
    },
    enableSaveBtn() {
        return this.enableElement(".ta-btn-save");
    },
    renderTest() {
        if (!this.$(".ta-sub-view-btn-group")[0]) {
            this.$el.prepend('<div class="ta-sub-view-btn-group"></div>');
        }
        this.$(".ta-sub-view-btn-group").append(
            `<button class="btn btn-primary pull-right ta-btn-test ta-sub-view-btn">${_.t("Test")}</button>`
        );
        return this;
    },
    changeToTerminate() {
        this._isTesting = true;
        this.$(".ta-btn-test").text(_.t("Stop"));
        return this;
    },
    changeToTest() {
        this._isTesting = false;
        this.enableTestBtn();
        this.$(".ta-btn-test").text(_.t("Test"));
        return this;
    },
    isTesting() {
        return !!this._isTesting;
    },
    disableTestBtn() {
        return this.disableElement(".ta-btn-test");
    },
    enableTestBtn() {
        return this.enableElement(".ta-btn-test");
    },

    // the following part are for modinput testing.
    renderOutputArea(element) {
        let child = this.createChild("outputArea", OutputAreaView);
        child.render();
        element.empty().html(child.$el);
        return this;
    },
    onTestError(resp) {
        let eno = resp.err_code || 3101;
        let eopts = resp.err_args || {};
        this.children.outputArea.setNormalMessage("");
        this.children.outputArea.setValue("");
        this.showFormattedError(eno, eopts);
    },
    validateRequiredCustomizedVarAndGlobalVar() {
        // should overwrite this in the children
        // if validate fails, return false.
        return true;
    },
    onTestClicked(e) {
        e.preventDefault();
        if (!this.validateRequiredCustomizedVarAndGlobalVar()) {
            // validate fails, do not begin test
            return;
        }
        this.clearError();
        this.disableTestBtn();
        let outputArea = this.children.outputArea;
        this.$(".ta-test-code-arrows.pull-right i.icon-arrow-left").click();
        if (this.isTesting()) {
            outputArea.setNormalMessage(_.t("Terminating..."));
            if (
                this._testRunnerPromise &&
                this._testRunnerPromise.state() === "pending"
            ) {
                this._testRunnerPromise.reject("manual");
            }
            ModInputTestRunner.killRunningTest(this.testID)
                .then(() => {
                    outputArea.setErrorMessage(_.t("Terminated"));
                    this.onTestFinished();
                })
                .fail(resp => {
                    this.onTestError(resp);
                    this.onTestFinished();
                });
        } else {
            let inputMeta = this.model.toJSON();
            outputArea.setNormalMessage(
                _.t("Preparing testing environment...")
            );
            outputArea.setValue("");
            ModInputTestRunner.generateTestID(inputMeta)
                .then(resp => {
                    this.changeToTerminate(); // change state now!
                    this.testID = resp.test_id;
                    this.testModInput();
                })
                .fail(resp => {
                    this.onTestError(resp);
                    this.onTestFinished();
                });
        }
    },
    onSaveClicked() {
        if (this.isElementDisabled(".ta-btn-save")) {
            return;
        }
        this.clearError();
        this.setModelValues();
        this.saveModInput(false);
    },
    testModInput() {
        let inputMeta = this.model.toJSON();
        inputMeta.test_id = this.testID;
        this._testRunnerPromise = ModInputTestRunner.testModInput(inputMeta);
        this._testRunnerPromise
            .then(resp => {
                let outputArea = this.children.outputArea;
                if (resp.status === "success") {
                    outputArea.setSuccessMessage(_.t("Done"));
                    outputArea.setValue(
                        _.reduce(
                            resp.results,
                            (s, e) => {
                                return s + _.unescape(e) + "\n";
                            },
                            ""
                        )
                    );
                    let isSetJSONMode = false;
                    if (resp.results.length === 1) {
                        isSetJSONMode = isLikeJSON(resp.results[0]);
                    }
                    if (isSetJSONMode) {
                        const inputJson = JSON.parse(resp.results[0]);
                        const {
                            result,
                            resultString
                        } = preprocessHightlightLine(inputJson);
                        this.result = result;
                        this.jsonData = inputJson;
                        outputArea.setValue(resultString[0]);
                        outputArea.setMode("json");
                        this.onTestValueSet();
                    } else {
                        outputArea.setMode("html");
                        let outputValue = outputArea.getValue();
                        if (isLikeHTML(outputValue)) {
                            outputValue = jsBeautify.html(outputValue);
                            outputArea.setValue(outputValue);
                        }
                    }
                } else {
                    outputArea.setErrorMessage(_.t("Fail"));
                    outputArea.setValue(resp.error);
                }
                this.onTestFinished();
            })
            .fail(resp => {
                if (resp === "manual") {
                    return;
                }
                this.onTestError(resp);
                this.onTestFinished();
            });
        this.checkRunningStatus();
    },

    checkRunningStatus() {
        if (!this.isTesting()) {
            return;
        }
        ModInputTestRunner.checkTestStatus(this.testID)
            .then(resp => {
                if (resp.err_code) {
                    this.onTestError(resp);
                } else {
                    if (resp.status) {
                        this.enableTestBtn();
                        this.children.outputArea.setNormalMessage(
                            _.t("Running...")
                        );
                    }
                }
                if (this.isTesting()) {
                    _.delay(
                        _.bind(this.checkRunningStatus, this),
                        this.processCheckInterval
                    );
                }
            })
            .fail(resp => {
                this.onTestError(resp);
                if (this.isTesting()) {
                    _.delay(
                        _.bind(this.checkRunningStatus, this),
                        this.processCheckInterval
                    );
                }
            });
    },

    onTestFinished() {
        this.changeToTest();
        this.testID = undefined;
    },

    onTestValueSet() {
        // To be implemented by children. Now only used by rest input.
    }
});

export default BaseInputDefinition;
