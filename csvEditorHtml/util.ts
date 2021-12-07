
/**
 * returns the html element with the given id
 * if not found throws and returns null
 * @param id 
 */
function _getById(id: string): HTMLElement {
	const el = document.getElementById(id)

	if (!el) {
		_error(`could not find element with id '${id}'`)
		return null as any
	}

	return el
}

function ensuredSingleCharacterString(el: HTMLInputElement) {
	
	if (el.value.length > 1) {
		//using last char is more user friendly as we can click and press a key to use the new char
		el.value = el.value.substring(el.value.length-1)
	}

}

/**
 * checks if a given cell value is a comment with the given configuration
 * @param value
 * @param csvReadConfig
 */
function isCommentCell(value: string | null, csvReadConfig: CsvReadOptions) {

	if (value === null) return false

	if (typeof csvReadConfig.comments === 'string' && csvReadConfig.comments !== '') {
		return value.trimLeft().startsWith(csvReadConfig.comments)
	}

	return false
}

/**
 * Adds a new row at the end of selected table
 * @param {boolean} selectNewRow true: scrolls to the  new row
 */
function addRow(selectNewRow = true) {
	hot = getSelectedHot()
	if (!hot) return

	//fetch metadata from selected row
	let rowMeta = hot.getCellMetaAtRow(0)

	// const headerCells = hot.getColHeader()
	const numRows = hot.countRows()
	hot.alter('insert_row', numRows) //inserted data contains null but papaparse correctly unparses it as ''
	// hot.populateFromArray(numRows, 0, [headerCells.map(p => '')])

	//set new row metadata
	setColumnMetadata(numRows, rowMeta)

	if (selectNewRow) {
		hot.selectCell(numRows, 0)
	}

	onResizeGrid()
}

/**
 * returns the visual start row index of the first selection range
 * the index is the visual one seen in the ui (e.g. changed when we reorder rows)
 */
function _getSelectedVisualRowIndex(): number | null {

	hot = getSelectedHot()
	if (!hot) throw new Error('table was null')	

	const selections = hot.getSelected()
	if (!selections?.length) return null

	const firstSelection = selections[0]
	const rowIndex = firstSelection[0] //start row
	return rowIndex
}

/**
 * returns the visual start col index of the first selection range
 * the index is the visual one seen in the ui (e.g. changed when we reorder rows)
 */
function _getSelectedVisualColIndex(): number | null {

	hot = getSelectedHot()
	if (!hot) throw new Error('table was null')

	const selections = hot.getSelected()
	if (!selections?.length) return null

	const firstSelection = selections[0]
	const rowIndex = firstSelection[1] //start row
	return rowIndex
}

/**
 * adds a new row above the current row
 */
function insertRowAbove() {

	if (isReadonlyMode) return

	_insertRowInternal(false)
}
/**
 * adds a new row below the current row
 */
function insertRowBelow() {

	if (isReadonlyMode) return

	_insertRowInternal(true)
}

function _insertRowInternal(belowCurrRow: boolean) {
	hot = getSelectedHot()
	if (!hot) return

	const currRowIndex = _getSelectedVisualRowIndex()
	const currColIndex = _getSelectedVisualColIndex()
	if (currRowIndex === null || currColIndex === null) return

	//fetch metadata from selected row
	let rowMeta = hot.getCellMetaAtRow(currRowIndex)

	const targetRowIndex = currRowIndex + (belowCurrRow ? 1 : 0)
	// const test = hot.toPhysicalRow(targetRowIndex) //also not working when rows are reordered...
	hot.alter('insert_row', targetRowIndex)

	//set new row metadata
	setColumnMetadata(targetRowIndex, rowMeta)

	//undefined should not happen but just in case
	const focusBehavior = initialConfig?.insertRowBehavior ?? 'focusFirstCellNewRow'

	switch (focusBehavior) {
		case 'focusFirstCellNewRow': {
			//new row, first cell
			hot.selectCell(targetRowIndex, 0)
			break;
		}
		case 'keepRowKeepColumn': {
			//before insert row, same column
			hot.selectCell(targetRowIndex + (belowCurrRow ? -1 : 1), currColIndex)
			break;
		}
		default: notExhaustiveSwitch(focusBehavior)
	}

	//checkAutoApplyHasHeader()
	onResizeGrid()
}

/**
 * Removes a row by index from selected table
 * @param {number} index 0 based
 */
function removeRow(index: number) {

	if (isReadonlyMode) return

	if (!hot) throw new Error('table was null')

	hot.alter('remove_row', index)
	//checkIfHasHeaderReadOptionIsAvailable(false)
}

/**
 * removes a column by index
 * @param {number} index the visual column index
 */
function removeColumn(index: number) {

	if (isReadonlyMode) return

	if (!hot) throw new Error('table was null')

	hot.alter('remove_col', index)

	//keep header in sync with the number of columns
	//this is done in the hooks

	//we could get 0 cols...
	//checkIfHasHeaderReadOptionIsAvailable(false)

}

/**
 * called on every render...
 * so we only need to add the css rule and never remove it
 * @param instance 
 * @param td 
 * @param row 
 * @param col 
 * @param prop 
 * @param value 
 * @param cellProperties 
 */
function commentValueRenderer(instance: Handsontable, td: HTMLTableDataCellElement, row: number, col: number, prop: any, value: string | null, cellProperties: any) {
	//@ts-ignore
	Handsontable.renderers.TextRenderer.apply(this, arguments);

	// console.log(value)

	if (value !== null && col === 0 && isCommentCell(value, defaultCsvReadOptions)) {
		// td.classList.add('comment-row')
		if (td && td.nextSibling) {
			(td.nextSibling as HTMLElement).title = warningTooltipTextWhenCommentRowNotFirstCellIsUsed;
		}

		//make the whole row a comment
		if (td && td.parentElement) {
			td.parentElement.classList.add('comment-row')
		}
	}

	// if (cellProperties._isComment) {
	// 	td.classList.add('comment-row')
	// } else {
	// 	// td.style.backgroundColor = ''
	// }

}

(Handsontable.renderers as any).registerRenderer('commentValueRenderer', commentValueRenderer);

/**
 * custom rendering for cells, fills in default values and changes background colours
 * @param instance 
 * @param td 
 * @param row 
 * @param column 
 * @param prop 
 * @param value 
 * @param cellProperties 
 */
function customRenderer(instance: Handsontable, td: HTMLTableDataCellElement, row: number, col: number, prop: any, value: string | null, cellProperties: any) {
	const args = arguments;
	//@ts-ignore
	Handsontable.renderers.TextRenderer.apply(this, args);

	//sets up tooltip
	if (td) {
		(td as HTMLElement).title = cellProperties.description + " <type '" + cellProperties.cellType + "'>";
	}

	//checks if cell is empty, fills in default value
	if(args[5] === null || args[5] === ""){
		td.style.backgroundColor = '44474C';
		td.style.color = '#888E8E';
		if(cellProperties.default == ""){
			td.innerText = '" "';
			td.style.textAlign = "center"
		}
		else if(!cellProperties.default){
			td.innerText = "None"
			if(cellProperties.required){
				td.innerText = "(Required)"
			}
		}
		else{
			td.innerText = cellProperties.default;
		}
	}
	else{
		td.style.color = '';
	}
	
	//checks column requirement
	if(cellProperties.required && args[5]){
		td.style.backgroundColor = '#45474a';
	}
	else if(cellProperties.required && args[5] !== null){
		td.style.backgroundColor = '#f34f38';
		td.style.color = '';
	}
	else if(cellProperties.required && !args[5] && !instance.isEmptyRow(row)){
		(td as HTMLElement).title += "\nA value is required for this cell."
		td.style.backgroundColor = '#f34f38';
		td.style.color = ''
	}
}

(Handsontable.renderers as any).registerRenderer('customRenderer', customRenderer);

/**
 * defining custom editor to return empty stringed cells as null
 * otherwise any empty cell double clicked on returns empty string to file
 * also converts floats to ints
 */
class CustomEditor extends Handsontable.editors.TextEditor {
	getValue() {
		//@ts-ignore
		if(this.cellProperties.cellType === "integer" && !isNaN(Number(this.TEXTAREA.value)) && this.TEXTAREA.value){
			return Math.round(Number(this.TEXTAREA.value)) 
		}
		return this.TEXTAREA.value === "" ? null : this.TEXTAREA.value;
	}
}

// function invisiblesCellValueRenderer(instance: Handsontable, td: HTMLTableDataCellElement, row: number, col: number, prop: any, value: string | null, cellProperties: any) {
// 	//@ts-ignore
// 	const val = Handsontable.helper.stringify(value);

// 	console.log(value)

// 	td.innerText = val.replace(/\ /g, '·').replace(/\	/g, '⇥')

// 	return td
// }

// (Handsontable.renderers as any).registerRenderer('invisiblesCellValueRenderer', invisiblesCellValueRenderer);

/**
 * overwrites a single option
 * warns and returns if the an option name is not found in targetOptions or options
 * @param {*} targetOptions the target options obj
 * @param {*} options the option to take the value from
 * @param {*} optionName the option name
 */
function _setOption<T extends {}>(targetOptions: T, options: T, optionName: keyof T) {

	if (options.hasOwnProperty(optionName)) {

		if (targetOptions.hasOwnProperty(optionName) === false) {
			_error(`target options object has not property '${optionName}'`)
			return
		}

		targetOptions[optionName] = options[optionName]
	} else {
		_error(`options object has not property '${optionName}'`)
	}
}

/**
 * overwrites the current read options with the given options
 * also updates the ui to display the new options
 * @param {*} options 
 */
function setCsvReadOptionsInitial(options: CsvReadOptions) {

	const keys = Object.keys(defaultCsvReadOptions)

	for (const key of keys) {
		_setOption(defaultCsvReadOptions, options, key as keyof CsvReadOptions)
	}

	//set ui from (maybe updated) options
	const el1 = _getById('delimiter-string') as HTMLInputElement
	el1.value = defaultCsvReadOptions.delimiter


	//disabled
	// const el2 = _getById('skip-empty-lines')
	// if (el2) {
	// 	//currently disabled...
	// 	el2.checked = csvReadOptions.skipEmptyLines
	// }

	const el3 = _getById('has-header') as HTMLInputElement
	el3.checked = defaultCsvReadOptions._hasHeader

	const el4 = _getById('comment-string') as HTMLInputElement
	el4.value = defaultCsvReadOptions.comments === false ? '' : defaultCsvReadOptions.comments

	const el5 = _getById('quote-char-string') as HTMLInputElement
	el5.value = defaultCsvReadOptions.quoteChar

	const el6 = _getById('escape-char-string') as HTMLInputElement
	el6.value = defaultCsvReadOptions.escapeChar
}

/**
 * overwrites the current write options with the given options
 * also updates the ui to display the new options
 * @param {*} options 
 */
function setCsvWriteOptionsInitial(options: CsvWriteOptions) {

	const keys = Object.keys(defaultCsvWriteOptions)

	for (const key of keys) {
		_setOption(defaultCsvWriteOptions, options, key as keyof CsvWriteOptions)
	}

	//set ui from (maybe updated) options
	const el1 = _getById('has-header-write') as HTMLInputElement
	el1.checked = defaultCsvWriteOptions.header

	const el2 = _getById('delimiter-string-write') as HTMLInputElement
	el2.value = defaultCsvWriteOptions.delimiter

	const el3 = _getById('comment-string-write') as HTMLInputElement
	el3.value = defaultCsvWriteOptions.comments === false ? '' : defaultCsvWriteOptions.comments

	const el4 = _getById('quote-char-string-write') as HTMLInputElement
	el4.value = defaultCsvWriteOptions.quoteChar

	const el5 = _getById('escape-char-string-write') as HTMLInputElement
	el5.value = defaultCsvWriteOptions.quoteChar

	const el6 = _getById('quote-all-fields-write') as HTMLInputElement
	el6.checked = defaultCsvWriteOptions.quoteAllFields
}

/**
 * checks if the has header read option must be disabled or not
 * and sets the needed state
 * 
 * if has header option is available (when we have enough data rows) we also check 
 * {@link headerRowWithIndex} if we have only comment rows
 * 
 * see https://forum.handsontable.com/t/table-with-only-header-row/2915 and
 * and https://github.com/handsontable/handsontable/issues/735
 * seems like with default headers it's not possible to only have headers?
 * @returns false: force changes (settings want headers but is not possible with data), true: all ok
 */
/*
function checkIfHasHeaderReadOptionIsAvailable(isInitialRender: boolean): boolean {

	const data = getData() //this also includes header rows

	const el = hasHeaderReadOptionInput

	let canSetOption = false

	if (isInitialRender) {
		canSetOption = data.length > 1
	}
	else {
		if (defaultCsvReadOptions._hasHeader) {
			canSetOption = data.length >= 1 //we already stored the header row so we have data + 1 rows...
		} else {
			canSetOption = data.length > 1 //no header ... to enable header we need 2 rows
		}
	}

	if (canSetOption) {
		//but we could have only comments --> no header available
		const firstRow = getFirstRowWithIndex()
		if (firstRow === null && !el.checked) { //if el.checked is true then we already have a header row...
			canSetOption = false
		}
	}

	if (canSetOption) {
		// el.removeAttribute('disabled')

	} else {
		// el.setAttribute('disabled', '')

		defaultCsvReadOptions._hasHeader = false
		el.checked = false
		return false
	}

	return true
}*/

//from https://stackoverflow.com/questions/27078285/simple-throttle-in-js ... from underscore
function throttle(func: Function, wait: number) {
	var context: any, args: any, result: any;
	var timeout: any = null;
	var previous = 0;
	var later = function () {
		previous = Date.now();
		timeout = null;
		result = func.apply(context, args);
		if (!timeout) context = args = null;
	};
	return function (this: any) {
		var now = Date.now();
		var remaining = wait - (now - previous);
		context = this;
		args = arguments;
		if (remaining <= 0 || remaining > wait) {
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			previous = now;
			result = func.apply(context, args);
			if (!timeout) context = args = null;
		} else if (!timeout) {
			timeout = setTimeout(later, remaining);
		}
		return result
	}
}

//from https://davidwalsh.name/javascript-debounce-function
function debounce(func: Function, wait: number, immediate = false) {
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

function _error(text: string) {
	postVsError(text)
	throw new Error(text)
}

/**
 * apply the first part of the settings from initialConfig, called before parsing data
 * some options have impact e.g. on how to parse the data...
 * some options depend on the state after parse ... e.g. has before/after comments?
 */

function setupAndApplyInitialConfigPart1(initialConfig: CsvEditSettings | undefined, initialVars: InitialVars) {

	if (initialConfig === undefined) {

		//probably in browser here...

		return
	}

	highlightCsvComments = initialConfig.highlightCsvComments
	enableWrapping = initialConfig.enableWrapping
	initialColumnWidth = initialConfig.initialColumnWidth
	newColumnQuoteInformationIsQuoted = initialConfig.newColumnQuoteInformationIsQuoted
	fixedRowsTop = Math.max(initialConfig.initiallyFixedRowsTop, 0)
	fixedColumnsLeft = Math.max(initialConfig.initiallyFixedColumnsLeft, 0)
	disableBorders = initialConfig.disableBorders

	if (disableBorders) {
		const style = document.createElement('style');
		style.type = 'text/css';
		style.innerHTML = `.vscode-dark td, th { border: 0px !important; }`;
		document.getElementsByTagName('head')[0].appendChild(style);
	}

	changeFontSizeInPx(initialConfig.fontSizeInPx)

	//--- other options
	fixedColumnsTopInfoSpan.innerText = fixedColumnsLeft + ''

	isReadonlyMode = initialConfig.initiallyIsInReadonlyMode
}


/* - maybe we get the collapse states and store them across sessions see
CsvEditSettings
 .readOptionsAppearance: remember option
 .writeOptionsAppearance: remember option
 .previewOptionsAppearance: remember option
 --- */

function _getVsState(): VsState {
	if (!vscode) return _createDefaultVsState()
	const state = vscode.getState()

	if (!state) return _createDefaultVsState()

	return state
}
function _createDefaultVsState(): VsState {
	return {
		previewIsCollapsed: true,
		readOptionIsCollapsed: true,
		writeOptionIsCollapsed: true
	}
}

function _setReadOptionCollapsedVsState(isCollapsed: boolean) {
	if (vscode) {
		// const lastState = _getVsState()
		// const newState = {
		// 	...lastState,
		// 	readOptionIsCollapsed: isCollapsed
		// }
		// console.log(JSON.stringify(newState));
		// vscode.setState(newState)
	}
}

function _setWriteOptionCollapsedVsState(isCollapsed: boolean) {
	if (vscode) {
		// const lastState = _getVsState()
		// const newState: VsState = {
		// 	...lastState,
		// 	writeOptionIsCollapsed: isCollapsed
		// }
		// vscode.setState(newState)
	}
}

function _setPreviewCollapsedVsState(isCollapsed: boolean) {
	if (vscode) {
		// const lastState = _getVsState()
		// const newState: VsState = {
		// 	...lastState,
		// 	previewIsCollapsed: isCollapsed
		// }
		// vscode.setState(newState)
	}
}

/**
 * a custom search method for the table
 * @param query 
 * @param value 
 */
function customSearchMethod(query: string | undefined | null, value: string | undefined | null): boolean {

	if (query === null || query === undefined || value === null || value === undefined) return false

	if (query === '') return false


	if (!findWidgetInstance.findOptionMatchCaseCache) {
		value = value.toLowerCase()
		query = query.toLowerCase()
	}

	if (findWidgetInstance.findOptionTrimCellCache) {
		value = value.trim()
	}

	if (findWidgetInstance.findOptionUseRegexCache) {

		if (findWidgetInstance.findWidgetCurrRegex === null) {
			throw new Error('should not happen...')
		}

		//this is needed when we use the global flag and we call exec on the same regex instance
		// findWidgetInstance.findWidgetCurrRegex.lastIndex = 0
		let result = findWidgetInstance.findWidgetCurrRegex.exec(value)

		if (findWidgetInstance.findOptionMatchWholeCellCache) {
			if (result !== null && result.length > 0) {
				return result[0] === value
			}
		}

		return result !== null

	} else {

		if (findWidgetInstance.findOptionMatchWholeCellCache) {
			return value === query
		}

		return value.indexOf(query) !== -1
	}
}

//taken from https://github.com/MikeMcl/big.js/blob/master/big.js
// const numberRegex = /-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?/
function afterHandsontableCreated(hot: Handsontable) {

	/**
	 * @param row Selection start visual row index.
	 * @param column Selection start visual column index.
	 * @param row2 Selection end visual row index.
	 * @param column2 Selection end visual column index.
	 */
	const afterSelectionHandler = (row: number, column: number, row2: number, column2: number) => {

		//need to make sure it has correct hot instance
		for(let key in HotRegisterer.bucket){
			let _hot = HotRegisterer.bucket[key]
			const selections = _hot.getSelected()
			if (selections){
				//this is the hot instance that is currently selected
				hot = _hot
			}
		}


		//if (getIsSidePanelCollapsed()) {
			//not update stats (might be costly and we don't display stats anyway)
		//} else {
			//calculateStats(row, column, row2, column2)
		//}
	}

	hot.addHook('afterSelection', afterSelectionHandler as any)

	const afterRowOrColsCountChangeHandler = () => {
		//statRowsCount.innerText = `${hot.countRows()}`
		//statColsCount.innerText = `${hot.countCols()}`
	}

	hot.addHook('afterRemoveRow', afterRowOrColsCountChangeHandler)
	hot.addHook('afterCreateRow', afterRowOrColsCountChangeHandler)
	hot.addHook('afterCreateCol', afterRowOrColsCountChangeHandler)
	hot.addHook('afterRemoveCol', afterRowOrColsCountChangeHandler)

	//statSelectedRows.innerText = `${0}`
	//statSelectedCols.innerText = `${0}`
	//statSelectedNotEmptyCells.innerText = `${0}`
	//statSumOfNumbers.innerText = `${0}`
	//statSelectedCellsCount.innerText = `${0}`
	//statRowsCount.innerText = `${hot.countRows()}`
	//statColsCount.innerText = `${hot.countCols()}`
}

/**
 * recalculates the stats (even if they are not visible)
 */
/*
function recalculateStats() {
	const selectedRanges = hot!.getSelected()

	if (!selectedRanges) return

	const firstRange = selectedRanges[0]

	calculateStats(...firstRange)
}*/

/**
 * the stats calculation func
 * @param row 
 * @param column 
 * @param row2 
 * @param column2 
 */
/*
function _calculateStats(row: number, column: number, row2: number, column2: number) {

	let numbersStyleToUse = getNumbersStyleFromUi()
	let rowsCount = Math.abs(row2 - row) + 1
	let colsCount = Math.abs(column2 - column) + 1
	statSelectedRows.innerText = `${rowsCount}`
	// statSelectedNotEmptyRows
	statSelectedCols.innerText = `${colsCount}`
	// statSelectedNotEmptyCols
	statSelectedCellsCount.innerText = `${rowsCount * colsCount}`

	//could be improved when we iterate over cols when we have less cols than rows??
	let notEmptyCount = 0
	let numbersSum = Big(0)
	let containsInvalidNumbers = false
	let minR = Math.min(row, row2)
	let maxR = Math.max(row, row2)
	for (let index = minR; index <= maxR; index++) {
		const data = hot!.getDataAtRow(index)

		let minC = Math.min(column, column2)
		let maxC = Math.max(column, column2)

		for (let i = minC; i <= maxC; i++) {
			const el = data[i]

			if (el !== '' && el !== null) {
				notEmptyCount++

				if (!containsInvalidNumbers) {

					const firstCanonicalNumberStringInCell = getFirstCanonicalNumberStringInCell(el, numbersStyleToUse)

					if (firstCanonicalNumberStringInCell === null) continue

					try {
						let _num = Big(firstCanonicalNumberStringInCell)
						numbersSum = numbersSum.plus(_num)
					} catch (error) {
						console.warn(`could not create or add number to statSumOfNumbers at row: ${index}, col: ${i}`, error)
						containsInvalidNumbers = true
					}
				}
			}
		}
	}

	statSelectedNotEmptyCells.innerText = `${notEmptyCount}`
	statSumOfNumbers.innerText = containsInvalidNumbers
		? `Some invalid num`
		: `${formatBigJsNumber(numbersSum, numbersStyleToUse)}`

}

const calculateStats = throttle(_calculateStats, 300) as typeof _calculateStats
*/


/**
 * returns the first number string in the cell value
 */
function getFirstCanonicalNumberStringInCell(cellValue: string, numbersStyle: NumbersStyle): string | null {

	// let thousandSeparatorsMatches = numbersStyle.thousandSeparatorReplaceRegex.exec(cellValue)

	let cellContent = cellValue

	let thousandSeparatorsMatches
	while (thousandSeparatorsMatches = numbersStyle.thousandSeparatorReplaceRegex.exec(cellValue)) {

		let replaceContent = thousandSeparatorsMatches[0].replace(numbersStyle.thousandSeparator, '')
		cellContent = cellContent.replace(thousandSeparatorsMatches[0], replaceContent)
	}

	let numberRegexRes = numbersStyle.regex.exec(cellContent)

	if (!numberRegexRes || numberRegexRes.length === 0) return null

	//this not longer has thousand separators...
	//big js only accepts numbers in en format (3.14)
	return numberRegexRes[0].replace(/\,/gm, '.')
}

const knownNumberStylesMap: KnownNumberStylesMap = {
	"en": {
		key: 'en',
		/**
		 * this allows:
		 * 0(000)
		 * 0(000).0(000)
		 * .0(000)
		 * all repeated with - in front (negative numbers)
		 * all repeated with e0(000) | e+0(000) | e-0(000)
		 */
		regex: /-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?/,
		thousandSeparator: /(\,| )/gm,
		thousandSeparatorReplaceRegex: /((\,| )\d{3})+/gm
	},
	"non-en": {
		key: 'non-en',
		/**
		 * this allows:
		 * 0(000)
		 * 0(000),0(000)
		 * ,0(000)
		 * all repeated with - in front (negative numbers)
		 * all repeated with e0(000) | e+0(000) | e-0(000)
		 */
		regex: /-?(\d+(\,\d*)?|\,\d+)(e[+-]?\d+)?/,
		thousandSeparator: /(\.| )/gm,
		thousandSeparatorReplaceRegex: /((\.| )\d{3})+/gm
	}
}

/**
 * sets the number style ui from the given nubmer style
 */
/*
function setNumbersStyleUi(numbersStyleToUse: CsvEditSettings["initialNumbersStyle"]) {

	numbersStyleEnRadio.checked = false
	numbersStyleNonEnRadio.checked = false

	switch (numbersStyleToUse) {
		case 'en': {
			numbersStyleEnRadio.checked = true
			break
		}

		case 'non-en': {
			numbersStyleNonEnRadio.checked = true
			break
		}

		default:
			notExhaustiveSwitch(numbersStyleToUse)
	}
}*/

/**
 * returns the number style from the ui
 */
/*
function getNumbersStyleFromUi(): NumbersStyle {


	if (numbersStyleEnRadio.checked) return knownNumberStylesMap['en']

	if (numbersStyleNonEnRadio.checked) return knownNumberStylesMap['non-en']

	postVsWarning(`Got unknown numbers style from ui, defaulting to 'en'`)

	return knownNumberStylesMap['en']
}*/

//don't know how to type this properly without typeof ...
const b = new Big(1)
function formatBigJsNumber(bigJsNumber: typeof b, numbersStyleToUse: NumbersStyle): string {

	switch (numbersStyleToUse.key) {
		case 'en': {

			//@ts-ignore
			bigJsNumber.format = {
				decimalSeparator: '.',
				groupSeparator: '', //TODO or maybe whitespace?
			}
			break
		}
		case 'non-en': {
			//@ts-ignore
			bigJsNumber.format = {
				decimalSeparator: ',',
				groupSeparator: '', //TODO or maybe whitespace?
			}
			break
		}

		default:
			notExhaustiveSwitch(numbersStyleToUse.key)
	}

	//@ts-ignore
	return bigJsNumber.toFormat()
}

/**
 * this creates html elements for table, header and container.
 * it is called every time a new handsontable is created
 * @param counter keeps track of the index of the containers
 * @param tableHeader the name of the table displayed above it
 */
function createHtmlContainer(counter: number, tableHeader: string){
	//container div
	let _containerEl: HTMLElement = document.createElement("div")
	_containerEl.className = "class"+counter
	_containerEl.id = "container"+counter
	_containerEl.draggable = true

	//header div
	let _headerEl: HTMLElement = document.createElement("h1")
	_headerEl.id = "header"+counter
	//_headerEl.className = "class"+counter
	_headerEl.innerText = tableHeader

	//table div
	let _tableEl: HTMLElement = document.createElement("div")
	_tableEl.id = "table" + counter
	//_tableEl.className = "class"+counter

	let parentNode = document.getElementById("csv-editor-wrapper")
	if (parentNode) {
		parentNode.appendChild(_containerEl)
	}
	else{
		_error(`could not find parent element`)
	}
	let containerNode = document.getElementById("container"+counter)
	if (parentNode && containerNode ) {
		containerNode.appendChild(_headerEl)
		containerNode.appendChild(_tableEl)
	}
	else{
		_error(`could not find container elements`)
	}
	return document.getElementById("table"+counter)

	//TO DO: if first element aka counter =0, then append to existing container
	// otherwise, append to counter-1 container
}

/**
 * called upon deletion of table, or on initial hot render to remove csv-editor container
 * @param elementId unique id of the table element/container to be deleted
 */
function deleteHtmlContainer(elementId: string){
	let el = document.getElementById(elementId)
	if(el && el.parentNode){
		el.parentNode.removeChild(el)
	}
	else{
		console.log("couldn't delete html element, doesn't exist")
	}

}

/**
 * Used to move handsontable instances around.
 * @param elementId container with table we want to move
 * @param newIndex the index we are moving the container to
 */
function moveHtmlContainer(elementId: string, newIndex: number){
	let currentEl = document.getElementById(elementId)
	if(currentEl && currentEl.parentNode){
		let elementsList = currentEl.parentNode.children
		currentEl.parentNode.insertBefore(currentEl, elementsList[newIndex])
	}
	else{
		console.log("Couldn't find HTML container with that ID.")
	}
}

/**
 * Returns the visual index of the html container, for a given table
 * key. Based on visual ordering rather than container key index.
 * @param elementId the name of the table element we want to find the index
 * of
 */
function fetchHtmlContainerIndex(elementId: number){
	let tableIndex: number = 0

	let currentEl = document.getElementById("container"+elementId)
	if(!currentEl) throw new Error ("Could not find HTML container with that ID.")
	if(!currentEl.parentNode) throw new Error ("Could not find parent HTML container for that ID.")
	let elementsList = Array.from(currentEl.parentNode.children);
	elementsList.forEach((element: Element, index: number) => {
		if (element.id === "container"+elementId){
			tableIndex = index
		}
	})
	return tableIndex
}

/**
 * returns the hot instance which is currently selected
 */
function getSelectedHot(){
	let hot: Handsontable | null = null
	//need to make sure it has correct hot instance
	for(let key in HotRegisterer.bucket){
		let _hot = HotRegisterer.bucket[key]
		const _selections = _hot.getSelected()
		if (_selections){
			//this is the hot instance that is currently selected
			hot = _hot
		}
	}
	return hot
}

/**
 * returns the type of the table selected
 */
function retrieveTable(hot: Handsontable){
	//@ts-ignore
	let tableKey: string = hot.rootElement.id
	let tableEl = _getById('header'+tableKey.slice(5))
	const tableName = tableEl.innerText
	return tableName
}

/**
 * clears selected cells content
 */
function clearCells(hot: Handsontable, selection: any){
	let cellChanges = []
	for(let cols = 0; (cols + selection[0][1]) <= selection[0][3]; cols++){
		for(let rows = 0; (rows + selection[0][0]) <= selection[0][2]; rows++){
			let _cellChange = [selection[0][0]+ rows, selection[0][1] + cols, null]
			cellChanges.push(_cellChange)
		}
	}
	//@ts-ignore
	hot.setDataAtCell(cellChanges)
}

/**
 * called by context menu or keyboard shortcut.
 * fills selected cells with incremented values
 */
function fillAndIncrementCells(hot: Handsontable, selection: any){
	let cellChanges = []
	for(let cols = 0; (cols + selection[0][1]) <= selection[0][3]; cols++){
		const sourceText = hot.getDataAtCell(selection[0][0], selection[0][1] + cols)
		let increments = getIncrementedValues(sourceText, (selection[0][2] - selection[0][0]))
		for(let i: number = 0; i < increments.length; i++){
			let _cellChange = [selection[0][0]+ i+1, selection[0][1] + cols, increments[i]]
			cellChanges.push(_cellChange)
		}
	}
	//@ts-ignore
	hot.setDataAtCell(cellChanges)
}

/**
 * returns an array of the new, incremented cell values to fill.
 * this is needlessly complicated TO DO - simplify?
 * @param sourceText the cell value to be incremented
 */
function getIncrementedValues(sourceText: any, num: number){
	let newText: string[] = []
	//use regex to find what we are incrementing
	let re = new RegExp(/[^\d]*(\d+)[^\d]*$/, "g")
	let match = re.exec(sourceText)
	if(match){
		//do regex again to find index 
		const search = match[1] //this is the last positive integer we increment
		//all we have in our cell is a number so increment that
		if(search.length === sourceText.toString().length){
			//then we don't want to iterate etc, just change value directly
			for(let i: number = 0; i < num; i++){
				let strLength = search.length
				let increment: string = (Number(search) + i+1).toString()
				if(increment.length < strLength){
					//this means we lost trailing 0s somewhere
					for(let j: number = 0; j < strLength-1; j++){
						increment = "0" + increment
					}
				}
				newText.push(increment)
			}
		}
		else{
			const indexes: any[] = [...sourceText.matchAll(new RegExp(search, 'gi'))].map(a => a.index);
			//probably a less messy way of doing this
			const start: number = indexes.slice(-1)[0]
			const end: number = indexes.slice(-1)[0] + search.length
	
			let beforeStr: string = sourceText.slice(0, start)
			let afterStr: string = sourceText.slice(end)
	
			for(let i: number = 0; i < num; i++){
				let strLength = search.length
				let increment: string = (Number(search) + i+1).toString()
				if(increment.length < strLength){
					//this means we lost a trailing 0 somewhere
					for(let j: number = 0; j < strLength-1; j++){
						increment = "0" + increment
					}
				}
				let newStr: string = beforeStr + increment + afterStr
				newText.push(newStr)
			}
		}
	}
	return newText
}

/**
 * returns a list of all entity types in the schema and populates
 * a dropdown in the add table modal for selection
 */
function returnTableTypeList(){
	const tableTypeList = initialData.tableHeaders
	let dropdownOptions = '<option value="" disabled selected>Select</option>'
    for (const idx in tableTypeList) {
        dropdownOptions += "<option>" + tableTypeList[idx] + "</option>";
	}
	let _dropdownEl = _getById("entities")
	_dropdownEl.innerHTML = dropdownOptions;
	toggleAskCreateTableModalDiv(true)
}

/**
 * Implements a global undo or redo. custom handling for table actions
 * that are not covered by handsontable's own undo/redo.
 * @param fetchStack the stack we are pulling from
 * @param the stack our change gets pushed to after enacted
 */
function triggerGlobalUndoRedo(fetchStack: any[], pushStack: any[]){
    if (fetchStack.length <= 0) return
		
	let action = fetchStack.splice(-1)[0];
	let reason = action["reason"]
	delete action["reason"] //prevents it being looped over
	Object.keys(action).forEach((key) => {
		let tableAction = isTableActionUndoRedo(key, action, fetchStack, reason)

		if(tableAction !== false){
			action[key] = tableAction
			fetchStack.forEach((item) => {
				Object.keys(item).forEach((itemKey) =>{
					if (itemKey === key){
						item[itemKey] = tableAction
					}
				})
			})
		}
		else if (tableAction === false){
			let hotInstance = action[key]
			hotInstance.undo();
		}
	pushStack.push(action); 
	isUndoRedo = false
	})
}

/**
 * Determines whether the next item in the undo stack is the
 * creation or deletion of a table, and enacts this action.
 * Called by global undo and redo trigger functions. Returns 
 * false if action is not table creation or deletion
 * @param key reference to hot container for instance
 * @param hotInstance the instance the next undo/redo occurs on
 * @param stack undo or redo stack, depending on which was called
 * @param reason informs whether table action was delete or add
 */
function isTableActionUndoRedo(key: string, action: any, stack: any[], reason: string){
	let hotInstance = action[key]
	isUndoRedo = true
	
	if(hotInstance.isDestroyed && reason === "deleteTable"){
		hotInstance = recoverTable()
		action["reason"] = "addTable" //re-add and swap so re/undo know what to do
		return hotInstance
	}
	else if(reason === "addTable"){
		removeTable(hotInstance)
		action["reason"] = "deleteTable" //re-add and swap so re/undo know what to do
		return hotInstance
	}
	else{
		return false
	}
}