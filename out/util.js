"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.returnExistingEntities = exports.moveEntity = exports.partitionString = exports.isYamlFile = exports.isCsvFile = exports.debounce = exports.limitSingleCharacterString = exports.getCurrentViewColumn = exports.debugLog = void 0;
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
function isCsvFile(document) {
    if (!document)
        return false;
    let lang = document.languageId.toLowerCase();
    let possible = ['csv', 'tsv', 'plaintext',
        //rainbow csv extension types, see https://github.com/mechatroner/vscode_rainbow_csv
        'csv (semicolon)', 'csv (pipe)', 'csv (whitespace)', 'csv (tilde)', 'csv (caret)', 'csv (colon)', 'csv (double quote)', 'csv (equals)', 'csv (dot)', 'csv (hyphen)'
    ];
    const _isCsvFile = possible.find(p => p === lang) && document.uri.scheme !== 'csv-edit';
    return _isCsvFile;
}
exports.isCsvFile = isCsvFile;
//inspired from https://github.com/jjuback/gc-excelviewer/blob/master/src/extension.ts
function isYamlFile(document) {
    if (!document)
        return false;
    let lang = document.languageId.toLowerCase();
    let possible = ['yaml', 'yml', 'plaintext'];
    const _isYamlFile = possible.find(p => p === lang) && document.uri.scheme !== 'csv-edit';
    return _isYamlFile;
}
exports.isYamlFile = isYamlFile;
function partitionString(text, sliceLength) {
    const slices = [];
    const totalSlices = Math.ceil(text.length / sliceLength);
    for (let i = 0; i < totalSlices; i++) {
        const _part = text.substr(i * sliceLength, sliceLength);
        slices.push({
            text: _part,
            sliceNr: i + 1,
            totalSlices
        });
    }
    return slices;
}
exports.partitionString = partitionString;
/**
* function to move entities around in yaml ast
* this is needed because yaml parser only appends new elements onto end of array
* and does not seem to have functionality for moving
* @param arr this is entities array
* @param old_index where node was previously
* @param new_index where node should be
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
 * looks through all entities in the file and returns an array of those
 * matching the type specified with file index for each
 */
function returnExistingEntities(entities, tableName) {
    let fileIndexes = [];
    for (let i = 0; i < entities.items.length; i++) {
        let entityType = entities.getIn([i, "type"], true);
        if (entityType.value === tableName) {
            fileIndexes.push(i);
        }
    }
    return fileIndexes;
}
exports.returnExistingEntities = returnExistingEntities;
//# sourceMappingURL=util.js.map