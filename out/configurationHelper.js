"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExtensionConfiguration = void 0;
const vscode = require("vscode");
const extension_1 = require("./extension");
const defaultConfig = {
    lastRowEnterBehavior: 'default',
    lastColumnTabBehavior: 'default',
    doubleClickColumnHandleForcedWith: 200,
    openSourceFileAfterApply: false,
    selectTextAfterBeginEditCell: false,
    enableWrapping: true,
    initialColumnWidth: 0,
    disableBorders: false,
    initiallyFixedColumnsLeft: 0,
    fontSizeInPx: 16,
    insertRowBehavior: 'keepRowKeepColumn',
    initiallyIsInReadonlyMode: false,
};
/**
 * returns the configuration for this extension
 */
function getExtensionConfiguration() {
    const configObj = vscode.workspace.getConfiguration(extension_1.editorUriScheme);
    const copy = Object.assign({}, defaultConfig);
    for (const key in defaultConfig) {
        const optionValue = configObj.get(key);
        if (optionValue === undefined) {
            vscode.window.showWarningMessage(`Could not find option: ${key} in yaml-edit configuration`);
            continue;
        }
        //@ts-ignore
        copy[key] = optionValue;
    }
    return copy;
}
exports.getExtensionConfiguration = getExtensionConfiguration;
//# sourceMappingURL=configurationHelper.js.map