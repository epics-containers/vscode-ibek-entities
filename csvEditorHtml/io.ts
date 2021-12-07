
/*
 * everything for communication or read / write
 */

/**
 * 
 * @returns {string[][]} the current data in the handson table
 */
function getData(): string[][] {
	//hot.getSourceData() returns the original data (e.g. not sorted...)

	if (!hot) throw new Error('table was null')

	return hot.getData()
}


/**
 * if we have an header row already it is ignored here!!
 */
function getFirstRowWithIndex(skipCommentLines: boolean = true): HeaderRowWithIndex | null {
	if (!hot) return null

	const rowCount = hot.countRows()
	if (rowCount === 0) return null

	let firstDataRow: string[] = []
	let rowIndex = -1

	for (let i = 0; i < rowCount; i++) {
		const row = hot.getDataAtRow(i)
		if (row.length === 0) continue
		
		if (skipCommentLines && isCommentCell(row[0], defaultCsvReadOptions)) continue

		firstDataRow = [...row] //make a copy to not get a reference
		rowIndex = i
		break
	}

	if (rowIndex === -1) {
		return null
	}

	return {
		physicalIndex: rowIndex,
		row: firstDataRow
	}
}

function getFirstRowWithIndexByData(data: string[][], skipCommentLines: boolean = true): HeaderRowWithIndex | null {

	const rowCount = data.length
	if (rowCount === 0) return null

	let firstDataRow: string[] = []
	let rowIndex = -1

	for (let i = 0; i < rowCount; i++) {
		const row = data[i]
		if (row.length === 0) continue
		
		if (skipCommentLines && isCommentCell(row[0], defaultCsvReadOptions)) continue

		firstDataRow = [...row] //make a copy to not get a reference
		rowIndex = i
		break
	}

	if (rowIndex === -1) {
		return null
	}

	return {
		physicalIndex: rowIndex,
		row: firstDataRow
	}
}


/* --- messages back to vs code --- */

/**
 * called to read the source file again
 * @param text 
 */
function postReloadFile() {

	if (!vscode) {
		console.log(`postReloadFile (but in browser)`)
		return
	}

	_postReadyMessage()
}

/**
 * called to display the given text in vs code 
 * @param text 
 */
var postVsInformation = (text: string) => {

	if (!vscode) {
		console.log(`postVsInformation (but in browser)`)
		return
	}

	vscode.postMessage({
		command: 'msgBox',
		type: 'info',
		content: text
	})
}
/**
 * called to display the given text in vs code 
 * @param text 
 */
var postVsWarning = (text: string) => {

	if (!vscode) {
		console.log(`postVsWarning (but in browser)`)
		return
	}

	vscode.postMessage({
		command: 'msgBox',
		type: 'warn',
		content: text
	})
}
/**
 * called to display the given text in vs code 
 * @param text 
 */
var postVsError = (text: string) => {

	if (!vscode) {
		console.log(`postVsError (but in browser)`)
		return
	}

	vscode.postMessage({
		command: 'msgBox',
		type: 'error',
		content: text
	})
}

/**
 * called to copy the text to the clipboard through vs code
 * @param text the text to copy
 */
function postCopyToClipboard(text: string) {

	if (!vscode) {
		console.log(`postCopyToClipboard (but in browser)`)
		navigator.clipboard.writeText(text)
		return
	}

	vscode.postMessage({
		command: 'copyToClipboard',
		text
	})
}

/**
 * called to save the current edit state back to the file
 * @param yamlContent 
 * @param saveSourceFile 
 */
function _postApplyContent(yamlContent: string, saveSourceFile: boolean) {


	if (!vscode) {
		console.log(`_postApplyContent (but in browser)`)
		return
	}

	/*
	vscode.postMessage({
		command: 'apply',
		yamlContent,
		saveSourceFile
	})*/
}

function _postModifyContent(reason: string, modifiedContent: string){

	if (!vscode) {
		console.log(`_postModifyContent (but in browser)`)
		return
	}

	vscode.postMessage({
		command: 'modify',
		changeType: reason,
		changeContent: modifiedContent
	})
}

function _postReadyMessage() {
	if (!vscode) {
		console.log(`_postReadyMessage (but in browser)`)
		return
	}

	startReceiveCsvProgBar()

	vscode.postMessage({
		command: 'ready'
	})
}

function handleVsCodeMessage(event: { data: ReceivedMessageFromVsCode }) {
	const message = event.data

	switch (message.command) {

		case 'yamlUpdate': {
			if (typeof message.yamlContent === 'string') {
				onReceiveYamlObject(message.yamlContent)
				return
			}
			break
		}

		case 'changeFontSizeInPx': {
			changeFontSizeInPx(message.fontSizeInPx)
			break
		}

		case 'sourceFileChanged': {

			if (!isReadonlyMode) {
				//just relaod the file because we have no changes anyway...
				return
			}

			break
		}

		case 'triggerUndo': {
			triggerGlobalUndoRedo(undoStack, redoStack)
			break
		}

		case 'triggerRedo': {
			triggerGlobalUndoRedo(redoStack, undoStack)
			break
		}

		default: {
			_error('received unknown message from vs code')
			notExhaustiveSwitch(message)
			break
		}
	}

}

/**
 * Receives stringified object containing table data
 * and parses back into an object and passing to initialData
 */
function onReceiveYamlObject(yamlObject: string){
	stopReceiveCsvProgBar()
	initialData = JSON.parse(yamlObject)
	startRenderData()
}

/**
 * Performs the last steps to actually show the data (set status, render table, ...)
 * also called on reset data
 */
function startRenderData(){

	statusInfo.innerText = `Rendering table...`

	call_after_DOM_updated(() => {

		resetDataObject(initialData)
		statusInfo.innerText = `Performing last steps...`
		
		//profiling shows that handsontable calls some column resize function which causes the last hang...
		//status display should be cleared after the handsontable operation so enqueue
		if (!defaultCsvReadOptions._hasHeader) { //when we apply header this will reset the status for us
			setTimeout(() => {
				statusInfo.innerText = '';
			}, 0)
		}
		
	})

}


//from https://www.freecodecamp.org/forum/t/how-to-make-js-wait-until-dom-is-updated/122067/2
function call_after_DOM_updated(fn: any) {
	var intermediate = function () { window.requestAnimationFrame(fn) }
	window.requestAnimationFrame(intermediate)
}

function notExhaustiveSwitch(x: never): never {
	throw new Error('not exhaustive switch')
}
