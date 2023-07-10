import _ from "lodash";
/*
    @param {object} json
    @param {string} pre
    @param {object} result
    @param {number} pos
    @param {array} resultString
    @param {string} preKey
    @param {string} level
    @param {number} currentElementIndex
*/
function getHighLightStartEnd(
    json,
    pre,
    result,
    pos,
    resultString,
    preKey,
    level,
    currentElementIndex = 0
) {
    const prefix = "\t";
    let newPos = pos;
    let start = result["start"];
    let end = result["end"];
    const isArr = _.isArray(json);
    const isObject = _.isPlainObject(json);
    if (isObject) {
        resultString[0] =
            resultString[0] + level + `${preKey + (preKey ? ":" : "")}{\n`;
    }
    if (isArr) {
        resultString[0] =
            resultString[0] + level + `${preKey + (preKey ? ":" : "")}[\n`;
    }
    let elementIndex = _.size(json) - 1;
    _.each(json, (val, key) => {
        newPos++;
        if (isArr) {
            start[pre + `[${key}]`] = newPos;
            if (_.isObject(val)) {
                newPos = getHighLightStartEnd(
                    val,
                    pre + `[${key}]`,
                    result,
                    newPos,
                    resultString,
                    "",
                    level + prefix,
                    elementIndex
                );
            } else {
                newPos += (val + "").split("\n").length - 1;
            }
            end[pre + `[${key}]`] = newPos;
        }
        if (isObject) {
            start[pre + `.${key}`] = newPos;
            if (_.isObject(val)) {
                newPos = getHighLightStartEnd(
                    val,
                    pre + `.${key}`,
                    result,
                    newPos,
                    resultString,
                    `\"${key}\"`,
                    level + prefix,
                    elementIndex
                );
            } else {
                newPos += (val + "").split("\n").length - 1;
            }
            end[pre + `.${key}`] = newPos;
        }
        if (!_.isObject(val)) {
            if (_.isString(val)) {
                val = `\"${val}\"`;
            }
            if (isObject) {
                resultString[0] =
                    resultString[0] + level + prefix + ` \"${key}\":${val}${ elementIndex ? ',' : '' } \n`;
            }
            if (isArr) {
                resultString[0] =
                    resultString[0] + level + prefix + `${val}${ elementIndex ? ',' : '' } \n`;
            }
        }
        elementIndex --;
    });
    newPos++;
    if (isArr) {
        resultString[0] = resultString[0] + level + `]${ currentElementIndex ? ',' : '' }\n`;
    }
    if (isObject) {
        resultString[0] = resultString[0] + level + `}${ currentElementIndex ? ',' : '' }\n`;
    }
    return newPos;
}
function preprocessHightlightLine(inputJson) {
    let result = { start: {}, end: {} };
    let resultString = [""];
    let preKey = "";
    getHighLightStartEnd(inputJson, "", result, 0, resultString, preKey, "");
    return { result, resultString };
}

export { preprocessHightlightLine };
