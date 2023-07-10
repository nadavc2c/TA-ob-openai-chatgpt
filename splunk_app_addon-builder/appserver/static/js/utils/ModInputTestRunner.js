import $ from "jquery";
import GenTestID from "app/models/build_mod_input/GenTestId";
import ModInputCodeRun from "app/models/build_mod_input/ModInputCodeRun";
import ModInputCodeKill from "app/models/build_mod_input/ModInputCodeKill";
import ModInputCodeCheckpid
    from "app/models/build_mod_input/ModInputCodeCheckpid";
import { splunkUtils } from "swc-aob/index";

const generateTestID = function(dataInput) {
    let dfd = $.Deferred();
    let idGenerator = new GenTestID();
    idGenerator.save(dataInput, {
        success: (model, response) => {
            if (!response.err_code) {
                dfd.resolve(response);
            } else {
                dfd.reject(response);
            }
        },
        error: (model, response) => {
            dfd.reject(response);
        },
        'headers': {
            'X-Splunk-Form-Key': splunkUtils.getFormKey()
        }
    });
    return dfd;
};

/**
 * test_id should be in the data input
 */
const testModInput = function(dataInput) {
    let dfd = $.Deferred();
    let codeRunner = new ModInputCodeRun();
    codeRunner.save(dataInput, {
        success: (model, response) => {
            if (!response.err_code) {
                dfd.resolve(response);
            } else {
                dfd.reject(response);
            }
        },
        error: (model, response) => {
            dfd.reject(response);
        },
        'headers': {
            'X-Splunk-Form-Key': splunkUtils.getFormKey()
        }
    });
    return dfd;
};

const killRunningTest = function(testID) {
    let dfd = $.Deferred();
    let killer = new ModInputCodeKill();
    killer.kill_pid(testID, {
        success: (model, response) => {
            if (!response.err_code) {
                dfd.resolve(response);
            } else {
                dfd.reject(response);
            }
        },
        error: (model, response) => {
            dfd.reject(response);
        },
        'headers': {
            'X-Splunk-Form-Key': splunkUtils.getFormKey()
        }
    });
    return dfd;
};

const killAllRunningTests = function(inputName) {
    let dfd = $.Deferred();
    let killer = new ModInputCodeKill();
    killer.kill_all(inputName, {
        success: (model, response) => {
            if (!response.err_code) {
                dfd.resolve(response);
            } else {
                dfd.reject(response);
            }
        },
        error: (model, response) => {
            dfd.reject(response);
        },
        'headers': {
            'X-Splunk-Form-Key': splunkUtils.getFormKey()
        }
    });
    return dfd;
};

const checkTestStatus = function(testID) {
    let dfd = $.Deferred();
    let checker = new ModInputCodeCheckpid();
    checker.set("test_id", testID);
    checker.psCheck({
        success: (model, response) => {
            if (!response.err_code) {
                dfd.resolve(response);
            } else {
                dfd.reject(response);
            }
        },
        error: (model, response) => {
            dfd.reject(response);
        },
        'headers': {
            'X-Splunk-Form-Key': splunkUtils.getFormKey()
        }
    });
    return dfd;
};

export {
    generateTestID,
    testModInput,
    killRunningTest,
    killAllRunningTests,
    checkTestStatus
};
