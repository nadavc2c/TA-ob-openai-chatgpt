import _ from "lodash";
import MessageCodeDict from "app/profiles/MessageCodeDict";
import Collector from "app/profiles/partyjsCollector";
/**
 * @param code {Int} a int value.
 * @param ... {Array} arguments to format the message.
 */
const getFormattedMessage = function(code /* , ... , args */) {
    let needSend = true;
    let codeNumber = code;
    if (_.isObject(code)) {
        codeNumber = code.code;
        needSend = code.shouldCollect !== false;
    }
    let msgObj = MessageCodeDict[codeNumber];
    let template = msgObj[0] || MessageCodeDict.__unknown__[0];
    template = _.t(template);
    let args = [].slice.call(arguments, 1);
    template = _.template(template, {
        escape: /\{\{(.+?)\}\}/g
    })({
        args: args
    });

    if (needSend && msgObj[1] === MessageCodeDict.ERROR) {
        Collector.collect("track_error", {
            err_code: codeNumber + "",
            err_args: args,
            message: template
        });
    }
    return template;
};

const getMessageFromModel = function(model) {
    return getFormattedMessage(model.get("err_code"), model.get("err_args", {}));
};

const getMessageFromObject = function(obj) {
    return getFormattedMessage(obj.err_code, obj.err_args);
};

export { getFormattedMessage, getMessageFromModel, getMessageFromObject };
