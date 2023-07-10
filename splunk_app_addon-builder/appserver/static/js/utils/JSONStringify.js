import _ from "lodash";

/**
* This function convert JSON to beatified string,
* while recording each json path's lines.
* @param obj
* @param space
* @returns {globalLines: "an array of strings, equals to JSON.stringify(obj, null, '\t').split('\n')",
*           globalMap: "dict, mapping from json path to corresponding line numbers"}
* Usage example: obj = {"a": 100, "b": { "c": 200} }, the returned value would be:
{
    globalLines: [
        "{",
        "\t\"a\": 100,",
        "\t\"b\": {",
        "\t\t\"c\": 200",
        "\t}",
        "}"
    ],
    globalMap: {
        "$": [0, 6],
        "$.a": [1, 2],
        "$.b": [2, 5],
        "$.b.c": [3, 4]
    }
}
*/

const stringifyJSON = function(obj, space = "\t") {
    var globalMap = {};
    var lineno = 0;

    var stringify = function(obj, depth = 1, path = "$") {
        var arrOfKeyVals = [];
        var arrVals = [];
        var objKeys = [];
        var indent = Array(depth).join(space);
        var indent2 = Array(depth + 1).join(space);
        globalMap[path] = { start: lineno };

        lineno++; //for [ or { or simple values
        /*********CHECK FOR PRIMITIVE TYPES**********/
        if (_.isNumber(obj) || _.isBoolean(obj) || _.isNull(obj)) {
            return "" + obj;
        } else if (typeof obj === "string") {
            return '"' + obj + '"';
        } else if (Array.isArray(obj)) {
            /*********CHECK FOR ARRAY**********/
            //check for empty array
            if (_.size(obj) === 0) {
                return "[]";
            } else {
                let count = 0;
                _.forEach(obj, function(el) {
                    let arrKey = path + "[" + count + "]";
                    globalMap[arrKey] = { start: lineno };
                    arrVals.push(stringify(el, depth + 1, arrKey));
                    globalMap[arrKey].end = lineno;
                    count++;
                });
                lineno++;
                globalMap[path].end = lineno;
                return (
                    "[\n" +
                    indent2 +
                    arrVals.join(",\n" + indent2) +
                    "\n" +
                    indent +
                    "]"
                );
                //return '[' + arrVals + ']';
            }
        } else if (obj instanceof Object) {
            /*********CHECK FOR OBJECT**********/
            //get object keys
            objKeys = Object.keys(obj);
            //set key output;
            objKeys.forEach(function(key) {
                var keyOut = '"' + key + '": ';
                var keyValOut = obj[key];
                globalMap[path + "." + key] = { start: lineno };
                lineno++;
                //skip functions and undefined properties
                if (
                    keyValOut instanceof Function ||
                    typeof keyValOut === undefined
                ) {
                    arrOfKeyVals.push("");
                } else if (typeof keyValOut === "string") {
                    arrOfKeyVals.push(keyOut + '"' + keyValOut + '"');
                } else if (
                    typeof keyValOut === "boolean" ||
                    typeof keValOut === "number" ||
                    keyValOut === null
                ) {
                    arrOfKeyVals.push(keyOut + keyValOut);
                    //check for nested objects, call recursively until no more objects
                } else if (keyValOut instanceof Object) {
                    lineno--;
                    arrOfKeyVals.push(
                        keyOut +
                            stringify(keyValOut, depth + 1, path + "." + key)
                    );
                }
                globalMap[path + "." + key].end = lineno;
            });
            lineno++;
            globalMap[path].end = lineno;
            return (
                "{\n" +
                indent2 +
                arrOfKeyVals.join(",\n" + indent2) +
                "\n" +
                indent +
                "}"
            );
        }
    };

    let jsonString = stringify(obj);
    return {
        globalLines: jsonString.split("\n"),
        globalMap: globalMap
    };
};

export { stringifyJSON };
