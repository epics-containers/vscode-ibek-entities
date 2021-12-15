
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
function removeRow(rows: number[]) {

	if (isReadonlyMode) return
	if(rows.length === 0) return

	if (!hot) throw new Error('table was null')

	hot.alter('remove_row', rows[0], rows.length)
}

/**
 * Custom renderer for cells called when table loaded or cell is edited. Applies
 * colour changes for required/invalid cells and fills in default schema values.
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

	//check there isn't float in int cell
	if(cellProperties.cellType === "integer" && !Number.isInteger(Number(args[5]))){
		td.style.backgroundColor = '#f34f38';
		td.style.color = ''
	}

	//check if first cell aka checkbox is checked, if so grey each cell
	if(instance.getDataAtCell(row,0) === true){
		td.style.backgroundColor = "#24363D"
		td.style.color = '#6B90A0'
	}
}

(Handsontable.renderers as any).registerRenderer('customRenderer', customRenderer);

/**
 * Custom renderer for checkbox cells to allow setting of tooltip
 */
function customCheckboxRenderer(instance: Handsontable, td: HTMLTableDataCellElement, row: number, col: number, prop: any, value: string | null, cellProperties: any) {
	const args = arguments;
	//@ts-ignore
	Handsontable.renderers.CheckboxRenderer.apply(this, args);

	//sets up tooltip
	if (td && cellProperties.prop === "entity_disabled") {
		(td as HTMLElement).title = "Disables or enables this row. Check box to disable. Default is enabled."
	}
}

(Handsontable.renderers as any).registerRenderer('customCheckboxRenderer', customCheckboxRenderer);

/**
 * Custom editor to return empty stringed cells as null,
 * otherwise any empty cell double clicked on returns empty string to file
 * Also converts floats to ints for int type cells
 */
class CustomEditor extends Handsontable.editors.TextEditor {
	getValue() {
		return this.TEXTAREA.value === "" ? null : this.TEXTAREA.value;
	}
}

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

}

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
 * Adjusts all container heights to account for horizontal
 * scrollbar space. Needed because handsontable modifies container
 * size upon hot creation so must modify size after hot created in
 * container.
 * @param _el container element to adjust
 * @param _height the existing height of container
 */
function adjustHtmlContainerHeight(_el: string, _height: number){
	let containerEl = document.getElementById(_el)
	if(!containerEl) throw new Error("container to modify doesn't exist")
	containerEl.style.height = _height + 43 + 'px'
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
	let initialTypeList = initialData.tableHeaders
	const tableTypeList = [... new Set(initialTypeList)] //removes duplicate table names
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
function triggerGlobalUndoRedo(fetchStack: any[], pushStack: any[], name: string){
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
			if(name === "undo"){
				hotInstance.undo();
			}
			else if(name === "redo"){
				hotInstance.redo();
			}
		}
	pushStack.push(action); 
	isUndoRedo = false;
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