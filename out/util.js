"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.returnExistingEntities = exports.moveEntity = exports.isYamlFile = exports.debounce = exports.limitSingleCharacterString = exports.getCurrentViewColumn = exports.debugLog = void 0;
const vscode = require("vscode");
function debugLog(msg) {
    // console.log(msg)
}
exports.debugLog = debugLog;
/**
 * gets the current view column (e.g. we could have split view)
 */
function getCurrentViewColumn() {
    return vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn
        ? vscode.window.activeTextEditor.viewColumn
        : vscode.ViewColumn.One;
}
exports.getCurrentViewColumn = getCurrentViewColumn;
function limitSingleCharacterString(value) {
    if (value.length > 1) {
        //using last char is more user friendly as we can click and press a key to use the new char
        value = value.substring(value.length - 1);
    }
    return value;
}
exports.limitSingleCharacterString = limitSingleCharacterString;
//from https://davidwalsh.name/javascript-debounce-function
function debounce(func, wait, immediate = false) {
    var timeout;
    return function () {
        var context = this, args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate)
                func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow)
            func.apply(context, args);
    };
}
exports.debounce = debounce;
//inspired from https://github.com/jjuback/gc-excelviewer/blob/master/src/extension.ts
/**
 * Confirms that the current file is a yaml file or not
 */
function isYamlFile(document) {
    if (!document)
        return false;
    let lang = document.languageId.toLowerCase();
    let possible = ['yaml', 'yml'];
    const _isYamlFile = possible.find(p => p === lang) && document.uri.scheme !== 'csv-edit';
    if (!_isYamlFile)
        return false;
    return _isYamlFile;
}
exports.isYamlFile = isYamlFile;
/**
* Moves items in array around. Implemented in order to move
* positions of entities in YAMl file, via moving of nodes in AST
* @param arr array to move items within
* @param old_index current index of item to move
* @param new_index index to move item to
*/
function moveEntity(arr, oldIndex, newIndex) {
    while (oldIndex < 0) {
        oldIndex += arr.length;
    }
    while (newIndex < 0) {
        newIndex += arr.length;
    }
    if (newIndex >= arr.length) {
        var k = newIndex - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
}
exports.moveEntity = moveEntity;
;
/**
 * Parses entities array in yaml file and returns 2D array of all type
 * groupings and their corresponding indices. Each array within the returned
 * array is a "table", and the indices within are the indices of entities that
 * reside in that "table" group.
 */
function returnExistingEntities(entities, tableName) {
    let fileIndexes = [];
    let lastEntityType = "";
    for (let i = 0; i < entities.items.length; i++) {
        let entityType = entities.getIn([i, "type"], true);
        let length = fileIndexes.length;
        let _tempArray = [i];
        //if this is first array
        if (length === 0) {
            fileIndexes.push(_tempArray);
        }
        //check if last found index is 1 less than current aka same group
        else if (lastEntityType === entityType.value) {
            fileIndexes[length - 1].push(i);
        }
        //otherwise, new grouping
        else {
            fileIndexes.push(_tempArray);
        }
        lastEntityType = entityType.value;
        entityType.value = lastEntityType;
    }
    return fileIndexes;
}
exports.returnExistingEntities = returnExistingEntities;
//# sourceMappingURL=util.js.map