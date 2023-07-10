import _ from "lodash";
import Immutable from "immutable";
import {
    STARTING_ROOT,
    APP,
    MODEL
} from "app/views/subviews/BuildCIMMapping/mapToModelsConstants";
function unflatString(str, deli) {
    const arr = _.split(str, deli);
    let result = {};
    while (arr.length) {
        result[arr.join(deli)] = true;
        arr.pop();
    }
    return result;
}

function findModel(node, nameSet) {
    let results = Immutable.Map({});
    const name = node.get("full_name");
    const path = node.get("path");
    const childrenArr = node.get("children");
    if (nameSet.has(name)) {
        results = results.set(path, node);
    }
    childrenArr.forEach(child => {
        results = results.merge(findModel(child, nameSet));
    });
    return results;
}
function getPathToLeaf(root, result = [], res = []) {
    if (_.isEmpty(root)) {
        res.push(result.join(":"));
        return;
    }
    _.each(root, (val, key) => {
        result.push(key);
        getPathToLeaf(val, result, res);
        result.pop();
    });
    return res;
}

function findLongestUniquePath(arr) {
    const arrSplit = _.map(arr, val => val.split(":"));
    let root = {};
    _.each(arrSplit, val => {
        let result = root;
        _.each(val, elem => {
            result[elem] = result[elem] || {};
            result = result[elem];
        });
    });
    return getPathToLeaf(root);
}

function transformTree(cimTree, prefix) {
    // any filed changes must be done here
    let title = cimTree.get("display_name") || cimTree.get("name");
    let fullName = cimTree.get("namespace")
        ? cimTree.get("namespace").join(":")
        : "";
    let childrenArr = cimTree.get("children") || Immutable.Map([]);
    let tree = Immutable.Map(_.omit(cimTree, ["children"]));
    if (!title) {
        title = STARTING_ROOT;
        tree = tree.set("type", STARTING_ROOT);
    } else {
        cimTree.get("ta_relevant")
            ? (tree = tree.set("type", MODEL))
            : (tree = tree.set("type", APP));
    }
    const error = cimTree.get("error") || Immutable.Map({});
    const path = prefix + title;
    let descentPath = Immutable.List([path]);
    childrenArr = childrenArr.map(val => {
        const child = transformTree(
            val,
            path === STARTING_ROOT ? "" : path + "/"
        );
        descentPath = descentPath.concat(child.get("descentPath"));
        return child;
    });
    return tree
        .set("full_name", fullName)
        .set("children", childrenArr)
        .set("path", path)
        .set("error", error)
        .set("descentPath", descentPath)
        .set("title", title);
}

// cimTree must be transformed before passing in
function selectTreeBranch(cimTree, filterString) {
    const emptyObj = Immutable.Map({});
    const descentPath = cimTree
        .get("descentPath")
        .filter(val => _.includes(val, filterString));
    if (descentPath.size) {
        let childrenArr = cimTree
            .get("children")
            .map(val => {
                return selectTreeBranch(val, filterString);
            })
            .filter(val => {
                return val.size;
            });
        let newTree = cimTree
            .set("children", childrenArr)
            .set("descentPath", descentPath);
        return newTree;
    } else {
        return emptyObj;
    }
}

// cimTree must be transformed before passing in
function openAllNodes(cimTree) {
    const childrenArr = cimTree.get("descentPath");
    const nodeActivitionStatus = childrenArr.reduce((dic, val) => {
        dic[val] = true;
        return dic;
    }, {});
    return Immutable.Map(nodeActivitionStatus);
}

export {
    unflatString,
    openAllNodes,
    findModel,
    findLongestUniquePath,
    transformTree,
    selectTreeBranch
};
