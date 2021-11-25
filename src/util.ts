import * as vscode from 'vscode';

export function debugLog(msg: any) {
	// console.log(msg)
}

/**
 * gets the current view column (e.g. we could have split view)
 */
export function getCurrentViewColumn(): vscode.ViewColumn {
	return vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn
		? vscode.window.activeTextEditor.viewColumn
		: vscode.ViewColumn.One
}

export function limitSingleCharacterString(value: string): string {
	
	if (value.length > 1) {
		//using last char is more user friendly as we can click and press a key to use the new char
		value = value.substring(value.length-1)
	}

	return value
}

//from https://davidwalsh.name/javascript-debounce-function
export function debounce(func: Function, wait: number, immediate = false) {
	var timeout: any;
	return function (this: any) {
		var context = this, args = arguments;
		var later = function () {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
}

//inspired from https://github.com/jjuback/gc-excelviewer/blob/master/src/extension.ts
export function isYamlFile(document: vscode.TextDocument | undefined) {
	if (!document) return false

	let lang = document.languageId.toLowerCase()
	let possible = ['yaml', 'yml']
	const _isYamlFile = possible.find(p => p === lang) && document.uri.scheme !== 'csv-edit'
	if(!_isYamlFile) return false
	return _isYamlFile
}

/**
* function to move entities around in yaml ast
* this is needed because yaml parser only appends new elements onto end of array
* and does not seem to have functionality for moving
* @param arr this is entities array
* @param old_index where node was previously
* @param new_index where node should be
*/
export function moveEntity(arr: any[], oldIndex: number, newIndex: number) {
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
};

/**
 * looks through all entities in the file and returns an array of those
 * matching the type specified with file index for each
 */
export function returnExistingEntities(entities: any, tableName?: string){
	let fileIndexes: number[] = []
	for(let i = 0; i < entities.items.length; i++){
		let entityType = entities.getIn([i, "type"], true)
		if(entityType.value === tableName){
			fileIndexes.push(i)
		}
	}
	return fileIndexes
}