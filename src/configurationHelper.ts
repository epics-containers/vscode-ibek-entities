import * as vscode from 'vscode';
import { editorUriScheme } from './extension';



const defaultConfig: YamlEditSettings = {
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
}

/**
 * returns the configuration for this extension
 */
export function getExtensionConfiguration(): YamlEditSettings {
	const configObj = vscode.workspace.getConfiguration(editorUriScheme)

	const copy = {
		...defaultConfig
	}

	for (const key in defaultConfig) {
		const optionValue = configObj.get(key)

		if (optionValue === undefined) {
			vscode.window.showWarningMessage(`Could not find option: ${key} in yaml-edit configuration`)
			continue
		}

		//@ts-ignore
		copy[key] = optionValue
	}

	return copy
}