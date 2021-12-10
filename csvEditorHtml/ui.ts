type ContextMenuSettings = import("../thirdParty/handsontable/handsontable").contextMenu.Settings


type GridSettings = import("../thirdParty/handsontable/handsontable").GridSettings

/**
 * NOT USED CURRENTLY (ui is hidden)
 * only in browser version
 */
function setNewLineWrite() {
	const el = _getById('newline-select-write') as HTMLInputElement

	if (el.value === '') {
		defaultCsvWriteOptions.newline = newLineFromInput
	}
	else if (el.value === 'lf') {
		defaultCsvWriteOptions.newline = '\n'
	}
	else if (el.value === 'crlf') {
		defaultCsvWriteOptions.newline = '\r\n'
	}
}

/**
 * renders the hot table again
 */
function reRenderTable(callback?: () => void, hot?: Handsontable | null) {
	if (hot){
		statusInfo.innerText = `Rendering table...`
		call_after_DOM_updated(() => {
			hot!.render()
			setTimeout(() => {
				statusInfo.innerText = ``
		
				if (callback) {
					//use another timeout so we clear the status text first
					setTimeout(() => {
						callback()
					})
				}
		
			}, 0)
		})
	}
	else if (!hot) return


}

/**
 * after resetting data the autoColumnSize plugin is disabled (don't know why)
 * but this is ok as we want our saved column width on reset {@link allColWidths}
 * 
 * but after clicking force resize columns we want to enable it again...
 * resizes all table columns, not just selected instance
 */
function forceResizeColumns() {
	//iterate over every existing hot instance
	for(let i=0; i < HotRegisterer.counter; i++){
		let hot = HotRegisterer.getInstance("table"+i)
		if (hot){
			//note that setting colWidths will disable the auto size column plugin (see Plugin AutoColumnSize.isEnabled)
			//it is enabled if (!colWidths)
			let plugin = hot.getPlugin('autoColumnSize')

			let setColSizeFunc = () => {
				if (!hot) return
				hot.getSettings().manualColumnResize = false //this prevents setting manual col size?
				hot.updateSettings({ colWidths: plugin.widths }, false)
				hot.getSettings().manualColumnResize = true
				hot.updateSettings({}, false) //change to manualColumnResize is only applied after updating setting?
				plugin.enablePlugin()
			}

			if (plugin.widths.length === 0) {
				plugin.enablePlugin()

				reRenderTable(setColSizeFunc, hot)
				// hot.render() //this is needed else calculate will not get widths
				//apparently render sets the column widths in the plugin if it's enabled?
				// plugin.calculateAllColumnsWidth()
				return
			}

			setColSizeFunc()
		}
	}
}


/* --- other --- */

/**
 * display the yaml data objects in several tables.
 * uses json schema information to fill in column metadata
 * @param yamlDataTables an array containing arrays of table datasets
 * @param yamlTableHeaders an array containing the header names for tables
 * @param yamlTableColumns an array containing arrays of column objects for each table
 * @param tableKey unique key id for each hot instance
 * @param container the html div container that houses the table
 */
function displayYamlData(this: any, yamlDataTables: any[][], yamlTableHeaders: string[], yamlTableColumns: any[][]){
	//destroying old table instances and html containers before (re)displaying data
	if(HotRegisterer.counter != 0){
		for(let i=0; i < HotRegisterer.counter; i++){
			let hot = HotRegisterer.getInstance("table"+i)
			let hotContainer = document.getElementById("container"+i)
			if(hot && hotContainer){
				hot.destroy()
				hot = null
				HotRegisterer.removeKey("table"+i)
				deleteHtmlContainer("container"+i)
			}
		}
		HotRegisterer.counter = 0 //counter back to zero because all instances destroyed
		isInitialHotRender = false //default is true
	}

	yamlDataTables.forEach((tableData, index) => {
		let counter: number = HotRegisterer.counter
		let container = createHtmlContainer(counter, yamlTableHeaders[index])
		if (container){
			let tableKey: string = "table" + counter
			let tableIdx: number = getMatchingColumns(yamlTableHeaders[index], yamlTableColumns)
			let columnOptions = setColumnOptions(yamlTableColumns[tableIdx])
			HotRegisterer.register(tableKey, container, tableData, columnOptions, yamlTableColumns[tableIdx])
		}
		else{
			console.log("couldn't find html to create table")
		}
		HotRegisterer.counter = counter+1
	})
}


/**
 * should be called by hot if anything was changed in cell
 */
function onAnyChange(changes?: CellChanges[] | null, reason?: string, _tableName?: string, index?: number) {

	//this is the case on init (because initial data set)
	//also when we reset data (button)
	//when we trim all cells (because this sets the data value via hot.updateSettings)
	if (changes === null && reason && reason.toLowerCase() === 'loaddata') {
		return
	}

	if (reason && reason === 'edit' && changes && changes.length > 0) {

		//handsontable even emits an event if the value stayed the same...
		const hasChanges = changes.some(p => p[2] !== p[3])
		if (!hasChanges) return
	}


	//we need to check the value cache because the user could have cleared the input and then closed the widget
	//but if we have an old search we re-open the old search which is now invalid...
	if (findWidgetInstance.findWidgetInputValueCache !== '') {
		findWidgetInstance.tableHasChangedAfterSearch = true
		findWidgetInstance.showOrHideOutdatedSearchIndicator(true)
	}

	if(changes){
		//if you don't declare types of these arrays here then can't push later because type "never"...
		let columns: any[] = []
		let oldIndexes: number[] = []
		let newIndexes: number[] = []
		let cells: any[] = []

		let changeContent: ReturnChangeObject = {tableName: _tableName, tableIndex: index, columnName: columns, cellValue: cells, oldRowIndex: oldIndexes, newRowIndex: newIndexes}
		
		changes.forEach((change) => {
			//this is messy but otherwise ts thinks arrays are undefined...
			if(!Array.isArray(changeContent.columnName)) return
			changeContent.columnName.push(change[1])

			if(!Array.isArray(changeContent.cellValue)) return
			changeContent.cellValue.push(change[3])
			
			if(!Array.isArray(changeContent.oldRowIndex)) return
			changeContent.oldRowIndex.push(change[0])

			if(!Array.isArray(changeContent.newRowIndex)) return
			changeContent.newRowIndex.push(change[0])
		})

		postModifyContent("valueChange", changeContent)
	}

}

/**
 * should be called if any rows/tables added/deleted/moved
 */
function onTableChange(_tableName: string, _tableIndex: number, _colName: string | undefined, _cellValue: string | number | undefined, _oldRowIndex: number[] | undefined, _newRowIndex: number | undefined, _tableData: any[], reason: string) {
	
	let changeContent: ReturnChangeObject = {tableName: _tableName, tableIndex:  _tableIndex}
	switch(reason){
		case "addRow":
			changeContent.newRowIndex = _newRowIndex
			if(_tableData.length > 0){
				changeContent.tableData = _tableData[0] 
			}
			break

		case "deleteRow":
			changeContent.oldRowIndex = _oldRowIndex
			break

		case "moveRow":
			changeContent.newRowIndex = _newRowIndex
			changeContent.oldRowIndex = _oldRowIndex
			break

		case "addTable":
			changeContent.tableData = _tableData
			break
		
		case "deleteTable":
			//table name is already passed in so do nothing here
			break
	}

	//we need to check the value cache because the user could have cleared the input and then closed the widget
	//but if we have an old search we re-open the old search which is now invalid...
	if (findWidgetInstance.findWidgetInputValueCache !== '') {
		findWidgetInstance.tableHasChangedAfterSearch = true
		findWidgetInstance.showOrHideOutdatedSearchIndicator(true)
	}

	postModifyContent(reason, changeContent)

}

/**
 * updates the handson table to fill available space (will trigger scrollbars)
 */
function onResizeGrid() {

	if (!hot) return

	const widthString = getComputedStyle(csvEditorWrapper).width

	if (!widthString) {
		_error(`could not resize table, width string was null`)
		return
	}

	const width = parseInt(widthString.substring(0, widthString.length - 2)) -10 //takes scrollbar width into account
	
	//need to modify this for several tables
	const heightString = getComputedStyle(csvEditorWrapper).height

	if (!heightString) {
		_error(`could not resize table, height string was null`)
		return
	}

	//iterate over every existing hot instance
	for(let i=0; i < HotRegisterer.counter; i++){
		let hot = HotRegisterer.getInstance("table"+i)
		let _elm = document.getElementById("table"+i)?.getElementsByClassName("ht_master handsontable")[0]
		if (_elm){ //check if the element exists
			//let tableEl = <HTMLElement>_elm.getElementsByClassName("wtHider")[i]
			let tableEl = <HTMLElement>_elm.getElementsByClassName("wtHider")[0]
			if(hot && tableEl){
				hot.updateSettings({
					width: width,
					//height: height,
					height: tableEl.offsetHeight + 10,
				}, false)
				syncColWidths(hot)
			}
		}
	}
}

/**
 * applies the stored col widths to the ui
 */
function applyColWidths() {
	//iterate over every existing hot instance
	for(let j=0; j < HotRegisterer.counter; j++){
		let hot = HotRegisterer.getInstance("table"+j)
		if(hot){
			hot.getSettings().manualColumnResize = false
			let autoSizedWidths = _getColWidths(hot)

			//maybe the user removed columns so we don't have all widths... e.g. remove cols then reset data...
			//we keep the col widths we have and add the auto size ones for the columns where we don't have old sizes...
			//NOTE we don't store the column names so we probably apply the wrong size to the wrong columns, e.g. 2 cols, reset 5 columns -> first 2 columns will get the old size of the old 2 columns
			for (let i = allColWidths[j].length; i < autoSizedWidths.length; i++) {
				const colWidth = autoSizedWidths[i]
				allColWidths[j].push(colWidth)
			}

			//note that setting colWidths will disable the auto size column plugin (see Plugin AutoColumnSize.isEnabled)
			//it is enabled if (!colWidths)
			hot.updateSettings({ colWidths: allColWidths[j] }, false)
			hot.getSettings().manualColumnResize = true
			hot.updateSettings({}, false)
			hot.getPlugin('autoColumnSize').enablePlugin()
		}
	}

}
/**
 * syncs the {@link allColWidths} with the ui/handsonable state
 */
function syncColWidths(hot?: Handsontable) {
	//allColWidths = _getColWidths()
	allColWidths.push(_getColWidths())
	// console.log('col widths synced', allColWidths);

}

function _getColWidths(hot?: Handsontable): number[] {
	if (!hot) return []
	//@ts-ignore
	return hot.getColHeader().map(function (header, index) {
		return hot!.getColWidth(index)
	})
}


/**
 * displays or hides the ask add table modal
 * @param isVisible 
 */
function toggleAskCreateTableModalDiv(isVisible: boolean) {

	if (isVisible) {
		askCreateTableModalDiv.classList.add('is-active')
		return
	}

	askCreateTableModalDiv.classList.remove('is-active')
}

/**
 * displays the given data (yaml)
 * @param _data the initial data object created from the yaml file
 */
function resetDataObject(_data: InitialDataObject) {
	//const _data = parseYaml(content) //here would pass in filename
	displayYamlData(_data.tableArrays, _data.tableHeaders, _data.tableColumns)

	//might be bigger than the current view
	onResizeGrid()
}

function startReceiveProgBar() {
	receivedProgBar.value = 0
	receivedProgBarWrapper.style.display = "block"
}

function intermediateReceiveProgBar() {
	receivedProgBar.attributes.removeNamedItem('value')
}

function stopReceiveProgBar() {
	receivedProgBarWrapper.style.display = "none"
}


/**
 * called from ui
 * @param saveSourceFile 
 */

function postApplyContent(saveSourceFile: boolean) {

	if (isReadonlyMode) return

	//const csvContent = getDataAsCsv(defaultCsvReadOptions, defaultCsvWriteOptions)
	//const returnData: ReturnDataObject = {tablesArray: getYamlData()}

	//used to clear focus... else styles are not properly applied
	//@ts-ignore
	if (document.activeElement !== document.body) document.activeElement.blur();

	//_postApplyContent(csvContent, saveSourceFile)
	//_postApplyContent(JSON.stringify(returnData), saveSourceFile)
}

/**
 * Called from the UI, calls function to post a message back with the changed data
 * @param reason 
 * @param contentChanges 
 */
function postModifyContent(reason: string, contentChanges: ReturnChangeObject){
		changeBuffer.push(contentChanges)
		changeTypeBuffer.push(reason)

		if(changeTimers.has("lastChange")){
			clearTimeout(changeTimers.get("lastChange"));
		}
		changeTimers.set("lastChange", setTimeout(() => {
			changeTimers.delete("lastChange");

			const modifiedContent = JSON.stringify(changeBuffer)
			const modifiedTypes = JSON.stringify(changeTypeBuffer)
			_postModifyContent(modifiedTypes, modifiedContent)
			
			changeBuffer = []
			changeTypeBuffer = []
		}, 500));
}


/**
 * the height for the th element
 * @param rows total number of rows
 */
function getRowHeaderWidth(rows: number) {
	const parentPadding = 5 * 2 //th has 1 border + 4 padding on both sides
	const widthMultiplyFactor = 10 //0-9 are all <10px width (with the current font)
	const iconPadding = 4
	const binIcon = 14
	const hiddenRowIcon = 10
	const len = rows.toString().length * widthMultiplyFactor + binIcon + iconPadding + parentPadding + hiddenRowIcon
	return len
	//or Math.ceil(Math.log10(num + 1)) from https://stackoverflow.com/questions/10952615/length-of-number-in-javascript
}


/**
 * changes to font size via updating the css variable and applying css classes
 * also re renders the table to update the column widths (manually changed column width will stay the same (tested) on rerender)
 */
function changeFontSizeInPx(fontSizeInPx: number) {

	document.documentElement.style.setProperty('--extension-font-size', `${fontSizeInPx.toString()}px`)

	if (fontSizeInPx <= 0) {
		//remove custom font size and use editor font size
		document.body.classList.remove('extension-settings-font-size')
		document.body.classList.add('vs-code-settings-font-size')
	} else {
		document.body.classList.add('extension-settings-font-size')
		document.body.classList.remove('vs-code-settings-font-size')
	}

	reRenderTable()
}

/**
 * applies the fixed rows and cols settings (normally called after a row/col added/removed)
 * ONLY call this if all other hot hooks have run else the data gets out of sync
 *   this is because the manualRowMove (and other) plugins update index mappings and when we call
 *   updateSettings during that the plugins get disabled and enabled and the data gets out of sync (the mapping)
 * ONLY if the {@link defaultCsvReadOptions._hasHeader} is false
 */
function updateFixedRowsCols() {

	hot = getSelectedHot()
	if (!hot) return

	hot.updateSettings({
		fixedRowsTop: Math.max(fixedRowsTop, 0),
		fixedColumnsLeft: Math.max(fixedColumnsLeft, 0),
	}, false)
}

/**
 * increments the {@link fixedColumnsLeft} by 1
 */
function incFixedColsLeft() {
	_changeFixedColsLeft(fixedColumnsLeft + 1)
}
/**
 * decrements the {@link fixedColumnsLeft} by 1
 */
function decFixedColsLeft() {
	_changeFixedColsLeft(fixedColumnsLeft - 1)
}
/**
 * no use this directly in the ui as {@link fixedColumnsLeft} name could change
 * @param newVal 
 */
function _changeFixedColsLeft(newVal: number) {
	fixedColumnsLeft = Math.max(newVal, 0)
	fixedColumnsTopInfoSpan.innerText = fixedColumnsLeft.toString()
	updateFixedRowsCols()
}

function _toggleFixedColumnsText() {

	const isHidden = fixedColumnsTopText.classList.contains('dis-hidden')

	if (isHidden) {
		fixedColumnsTopText.classList.remove('dis-hidden')
	} else {
		fixedColumnsTopText.classList.add('dis-hidden')
	}
}

/**
 * moves selected row up
 */
function moveRowUp(){
	hot = getSelectedHot()
	if (!hot) return

	let selectedRowIndex: number = 0
	let selected = hot.getSelected()
	if(selected){
		selectedRowIndex = selected[0][0]
	}
	_moveRows(selectedRowIndex, selectedRowIndex - 1, hot)
}

/**
 * moves selected row down
 */
function moveRowDown(){
	hot = getSelectedHot()
	if (!hot) return

	let selectedRowIndex: number = 0
	let selected = hot.getSelected()
	if(selected){
		selectedRowIndex = selected[0][0]
	}
	_moveRows(selectedRowIndex, selectedRowIndex + 2, hot)
}

/**
 * does the actual moving of rows
 * @param newRowIdx index we are trying to move our row to
 */
function _moveRows(oldRowIndex: number, newRowIndex: number, hot: Handsontable){
	if(!hot) return
	if(newRowIndex < 0 || newRowIndex > hot.countRows()){
		return
	}
	let plugin = hot.getPlugin('manualRowMove')
	plugin.moveRow(oldRowIndex, newRowIndex)
	hot.render()
	if(oldRowIndex < newRowIndex){
		hot.selectCell(newRowIndex-1, 0)
	}
	else{
		hot.selectCell(newRowIndex, 0)
	}
	
}

function getHandsontableOverlayScrollLeft(): HTMLDivElement | null {
	const overlayWrapper = document.querySelector(`#csv-editor-wrapper .ht_master .wtHolder`)

	if (!overlayWrapper) {
		console.warn(`could not find handsontable overlay wrapper`)
		return null
	}
	return overlayWrapper as HTMLDivElement
}

function setupScrollListeners() {

	let overlayWrapper = getHandsontableOverlayScrollLeft()!
	
	if (_onTableScrollThrottled) {
		overlayWrapper.removeEventListener(`scroll`, _onTableScrollThrottled)
	}
	_onTableScrollThrottled = throttle(_onTableScroll, 100)
	overlayWrapper.addEventListener(`scroll`, _onTableScrollThrottled)
}

function _onTableScroll(e: Event) {

	if (!editHeaderCellTextInputEl) return
	let scrollLeft = (e.target as HTMLElement).scrollLeft
	editHeaderCellTextInputEl.style.left = `${editHeaderCellTextInputLeftOffsetInPx - (scrollLeft - handsontableOverlayScrollLeft)}px`
}


// ------------------------------------------------------

/*maybe this is not needed but it can be dangerous to call hot.updateSettings while indices/mappings are updated
 e.g. when we call {@link updateFixedRowsCols} during afterCreateRow and
	 move row 5 below row 1 then try to add a row below row 1 it is added 2 rows below and row 5 is at is't ols position...

so we only store the events we get and call them after a rerender (which is hopefully are called last)
*/

type RecordedHookAction = 'afterRemoveCol' | 'afterCreateRow'

let recordedHookActions: RecordedHookAction[]

type HookItem = {
	actionName: RecordedHookAction
	action: Function
}

let hook_list: HookItem[] = []

function afterRenderForced(isForced: boolean) {
	if (!isForced) {
		hook_list = []
		recordedHookActions = []
		return
	}

	//hot.alter forced a rerender
	//and we can only run our hooks after hot has updated internal mappings and indices
	//so we kepp track if our hooks were fired and execute them after the rerender

	for (let i = 0; i < hook_list.length; i++) {
		const hookItem = hook_list[i];

		if (!recordedHookActions.includes(hookItem.actionName)) continue

		//prevent infinite loop if we render in action
		hook_list.splice(i, 1)
		hookItem.action()
	}
	hook_list = []
	recordedHookActions = []

	if (!isForced || isInitialHotRender) return
	//e.g. when we edit a cell and the cell must adjust the width because of the content
	//there is no other hook?
	//this is also fired on various other event (e.g. col resize...) but better sync more than miss an event
	syncColWidths()
}

function pre_afterRemoveCol(this: any, visualColIndex: number, amount: number, isFromUndoRedo: boolean) {
	recordedHookActions.push("afterRemoveCol")

	hook_list.push({
		actionName: 'afterRemoveCol',
		action: afterRemoveCol.bind(this, visualColIndex, amount, isFromUndoRedo)
	})
}

function afterRemoveCol(visualColIndex: number, amount: number, isFromUndoRedo: boolean) {
	if (!hot) return

	if (headerRowWithIndex && !isFromUndoRedo) {
		headerRowWithIndex.row.splice(visualColIndex, amount)
		//hot automatically re-renders after this
	}

	const sortConfigs = hot.getPlugin('columnSorting').getSortConfig()

	const sortedColumnIds = sortConfigs.map(p => hot!.toPhysicalColumn(p.column))

	let removedColIds: number[] = []
	for (let i = 0; i < amount; i++) {
		removedColIds.push(hot.toPhysicalColumn(visualColIndex + i))
	}

	//if we removed some col that was sorted then clear sorting...
	if (sortedColumnIds.some(p => removedColIds.includes(p))) {
		hot.getPlugin('columnSorting').clearSort()
	}

	if (columnIsQuoted) {
		// const physicalIndex = hot.toPhysicalColumn(visualColIndex)
		columnIsQuoted.splice(visualColIndex, amount)
	}

	allColWidths.splice(visualColIndex, 1)
	//critical might update settings
	applyColWidths()

	// syncColWidths() //covered by afterRender
	onAnyChange()
	//dont' call this as it corrupts hot index mappings (because all other hooks need to finish first before we update hot settings)
	//also it's not needed as handsontable already handles this internally
	// updateFixedRowsCols()
}

function pre_afterCreateRow(this: any, visualRowIndex: number, amount: number) {
	recordedHookActions.push("afterCreateRow")

	hook_list.push({
		actionName: 'afterCreateRow',
		action: afterCreateRow.bind(this, visualRowIndex, amount)
	})
}

//inspired by https://github.com/handsontable/handsontable/blob/master/src/plugins/hiddenRows/hiddenRows.js
//i absolutely don't understand how handsontable implementation is working... 
//their this.hiddenRows should be physical indices (see https://github.com/handsontable/handsontable/blob/master/src/plugins/hiddenRows/hiddenRows.js#L254)
//but in onAfterCreateRow & onAfterRemoveRow they check against `visualRow` which is actually the physical row (see above)
//and then they increment the physical row via the amount
//however, it works somehow...
function afterCreateRow(visualRowIndex: number, amount: number) {
	if (!hot) throw new Error('table was null')
	//added below
	//critical because we could update hot settings here
	//we need to modify some or all hiddenPhysicalRowIndices...

	for (let i = 0; i < hiddenPhysicalRowIndices.length; i++) {
		const hiddenPhysicalRowIndex = hiddenPhysicalRowIndices[i];

		if (hiddenPhysicalRowIndex >= visualRowIndex) {
			hiddenPhysicalRowIndices[i] += amount
		}
	}

	let newRowData: any[] = []
	newRowData.push(hot.getSourceDataAtRow(visualRowIndex)) 

	let tableName = retrieveTable(hot)

	//@ts-ignore
	let tableKey = hot.rootElement.id
	const matches = tableKey.match(/\d+$/); //finds counter value
	let index = fetchHtmlContainerIndex(matches[0])

	if(isUndoRedo){
		undoneRemoveRowAction = true
	}
	else{
		onTableChange(tableName, index, undefined, undefined, undefined, visualRowIndex, newRowData, "addRow")
	}
}


/**
 * Creates an empty template table of user selected type from schema
 */
function addTable(){
	const selectEl = <HTMLSelectElement>_getById("entities")
	const tableType: string = selectEl.options[selectEl.selectedIndex].value
	if(tableType === "") return //in case no option selected

	const count = HotRegisterer.counter
	const tableKey: string = "table" + count
	createTable(tableType, HotRegisterer.counter, tableKey, [])
	hot = HotRegisterer.getInstance(tableKey)
	if(!hot) return

	let index = fetchHtmlContainerIndex(count)
	onTableChange(tableType, index, undefined, undefined, undefined, undefined, hot.getSourceData(), "addTable")

	if(isUndoRedo === false){	
		undoStack.push({[tableKey]: hot, "reason": "addTable"})
		redoStack = [] //clear redo stack after new changes made?
	}
}

/**
 * Recreates a formerly deleted table again with undo/redo stack preserved. Fetches the last
 * deleted table's information from HotRegisterer.emptyBucket. Called by 
 * triggerGlobalUndoRedo only.
 */
function recoverTable(){
	const oldTable: DeletedTableObject = HotRegisterer.emptyBucket.pop()
	const tableKey: string = "table" + oldTable.keyIndex
	createTable(oldTable.type, oldTable.keyIndex, tableKey, oldTable.latestData)

	moveHtmlContainer("container"+oldTable.keyIndex, oldTable.keyIndex)

	let index = fetchHtmlContainerIndex(oldTable.keyIndex)
	onTableChange(oldTable.type, index, undefined, undefined, undefined, undefined, oldTable.latestData, "addTable")

	//bring back undo/redo stack
	hot = HotRegisterer.getInstance(tableKey)
	let undoPlugin = (hot as any).undoRedo
	undoPlugin.doneActions = oldTable.undoList
	undoPlugin.undoneActions = oldTable.redoList

	return hot
}

/**
 * Does the actual creation of a table.
 * @param type the entity type
 * @param count counter for the table. Either from HotRegisterer or kept as old
 * table counter
 * @param key the table key for adding to the bucket after creation
 * @param _data either an empty dataset or a preserved dataset from an old table
 */
function createTable(type: string, count: number, key: string, _data: any[]){
	//set up columns
	let newTableColumns: any[] = []
	initialData.tableColumns.forEach((table) => { //iterates to find correct schema data
		table.forEach((column) => {
			if(column.name === "type" && column.default === type){
				newTableColumns = table
			}
		})
	})
	const columnOptions = setColumnOptions(newTableColumns)

	//if no data was passed in, create empty set
	if(_data.length === 0){
		let emptyData: {[k: string]: any} = {}
		newTableColumns.forEach((column) => {
			if(column.required === true){
				emptyData[column.name] = null
			}
			else if(column.name === "type"){ //set up type column here
				emptyData[column.name] = type
			}
		})
		_data.push(emptyData)
	}

	const container = createHtmlContainer(count, type)
	if (container){
		HotRegisterer.register(key, container, _data, columnOptions, [])
		HotRegisterer.counter++
		setColumnMetadata(0, newTableColumns)
	}
	else{
		console.log("couldn't find html to create table")
		//TO DO - better error/exception handling here
	}

	onResizeGrid()
}

/**
 * Called when a table is deleted, either manually or by triggerGlobalUndoRedo.
 * Preserves the basic information of the table and stores in hotRegisterer.emptyBucket
 * in case table needs to be recovered.
 * @param oldHot this arg is only passed in when function called by undo/redo
 */
function removeTable(oldHot?: any){

	hot = getSelectedHot()

	if(oldHot){
		hot = oldHot
	}
	if (!hot) throw new Error('table was null')
	//@ts-ignore
	let tableKey = hot.rootElement.id
	let tableName = retrieveTable(hot)
	
	let _container: HTMLElement | null = document.getElementById(tableKey)
	if(hot && _container){
		//before delete table, must keep outline to create again if undone
		const matches = tableKey.match(/\d+$/); //finds counter value
		let undoPlugin = (hot as any).undoRedo
		let _table: DeletedTableObject = {
			type: tableName, 
			keyIndex: matches[0],
			latestData: hot.getSourceData(), 
			undoList: undoPlugin.doneActions, 
			redoList: undoPlugin.undoneActions
		}
		HotRegisterer.emptyBucket.push(_table)
		if(isUndoRedo === false){	
			undoStack.push({[tableKey]: hot, "reason": "deleteTable"})
			redoStack = [] //clear redo stack after new changes made?
		}

		let index = fetchHtmlContainerIndex(matches[0])

		hot.destroy()
		hot = null
		HotRegisterer.removeKey(tableKey)
		deleteHtmlContainer("container"+matches[0])

		onResizeGrid()
		onTableChange(tableName, index, undefined, undefined, undefined, undefined, [], "deleteTable")
	}
}

/**
 * Creates a HOT instance and stores its reference key in a bucket.
 * @param counter keeps track of how many previous instances created in order to
 * continue creating unique IDs
 * @param register used to create a new HOT instance and register it in the bucket
 * @param getInstance used to select a particular table instance
 * @param bucket a bucket to store all the keys to hot instances in
 * @param removeKey removes deleted instances from bucket
 * @param emptyBucket stores outline data on deleted tables in case recreated
 */
let HotRegisterer: HotRegister = {
	counter: 0,
	bucket: {},
	emptyBucket: [],
	register: function(key, container, tableData, columnOpt, tableColumns) {
		//reset header row
		headerRowWithIndex = null

		//enable all find connected stuff
		//we need to setup this first so we get the events before handsontable... e.g. document keydown
		findWidgetInstance.setupFind()
		//checks for existence of current or previous instances
		if (HotRegisterer.counter === 0 && isInitialHotRender === true){
			isInitialHotRender = true 
			deleteHtmlContainer("csv-editor")
		}

		hot = new Handsontable(container, {
			data: tableData,
			readOnly: isReadonlyMode,
			rowHeaders: function (row: number) { //the visual row index
				let text = (row + 1).toString()
				return `${text}`
			} as any,
			renderAllRows: false, //use false and small table size for fast initial render, see https://handsontable.com/docs/7.0.2/Options.html#renderAllRows
			afterChange: function(changes: [number, string | number, any, any][], reason: string){
				//@ts-ignore
				let tableKey = this.rootElement.id
				//push changes to global undo stack but NOT if initial table load
				if(reason !== "loadData" && reason !== "UndoRedo.undo" && reason !== "UndoRedo.redo"){	
					undoStack.push({[tableKey]: this})
					redoStack = [] //clear redo stack after new changes made?
				}

				const matches = tableKey.match(/\d+$/); //finds counter value
				let index = fetchHtmlContainerIndex(matches[0])
				let hot = HotRegisterer.getInstance("table"+matches[0])
				if(!hot) return
				let tableName = retrieveTable(hot)

				//this means the "value change" event called here is actually an "addrow" but handsontable splits it into 2 events
				if(undoneRemoveRowAction){
					let newRow = changes[0][0]
					undoneRemoveRowAction = false
					let newData: any[] = []
					newData.push(hot.getSourceDataAtRow(newRow)) 
					onTableChange(tableName, index, undefined, undefined, undefined, newRow, newData, "addRow")
				}
				//we don't want to call onAnyChange again when cells cleared aka delete last row
				else{
					onAnyChange(changes, reason, tableName, index)
				} 
			}, //only called when cell value changed (e.g. not when row removed/created)
			fillHandle: {
				direction: 'vertical',
				autoInsertRow: false
			},
			undo: true,
					//plugins
			copyPaste: true,
			comments: false,
			search: {
				queryMethod: customSearchMethod,
				searchResultClass: 'search-result-cell',
			} as any, //typing is wrong, see https://handsontable.com/docs/6.2.2/demo-searching.html
			wordWrap: enableWrapping,
			autoColumnSize: initialColumnWidth > 0 ? {
				maxColumnWidth: initialColumnWidth
			} : true,
			manualRowMove: true,
			manualRowResize: false,
			manualColumnMove: false,
			manualColumnResize: true,
			columns: columnOpt,
			currentColClassName: 'foo', //actually used to overwrite highlighting
			currentRowClassName: 'foo', //actually used to overwrite highlighting
			className: 'htCenter',
			contextMenu: {
				items: {
					'row_above': {
						name: "Insert Row Above (Ctrl+I)",
						callback: function () { //key, selection, clickEvent
							insertRowAbove()
						},
						disabled: function() {
							return isReadonlyMode
						}
					},
					'row_below': {
						name: "Insert Row Below (Ctrl+U)",
						callback: function () { //key, selection, clickEvent
							insertRowBelow()
						},
						disabled: function() {
							return isReadonlyMode
						}
					},
					'remove_row': {
						callback: function () { //key, selection, clickEvent
							hot = getSelectedHot()
							if (!hot) throw new Error('table was null')

							let allRowsAreSelected = false
							let _rows = []

							const selection = hot.getSelected()
							if (selection) {
								const selectedRowsCount = Math.abs(selection[0][0] - selection[0][2]) //starts at 0 --> +1
								allRowsAreSelected = hot!.countRows() === selectedRowsCount + 1 //check whether trying to remove all rows

								if(allRowsAreSelected){
									//if all rows selected, delete all but index 0 and then clear row 0
									for(let i = selection[0][0]+1; i <= selection[0][2]; i++){
										_rows.push(i)
									}
									removeRow(_rows)
									const rowSelection = [[0, 0, 0, hot.countCols()]]
									clearCells(hot, rowSelection)
								}
								else{
									for(let i = selection[0][0]; i <= selection[0][2]; i++){
										_rows.push(i)
									}
									removeRow(_rows)
								}
							}
						},
					},
					'---------': {
						name: '---------'
					},
					'cut': {
						name: "Cut (Ctrl+X)",
					},
					'copy': {
						name: "Copy (Ctrl+C)",
					},
					'clear': {
						name: "Clear (Ctrl+D)",
						callback: function (key: any, selection: any, clickevent: any) { //key, selection, clickEvent
							hot = getSelectedHot()
							if(!hot) return
							selection = hot.getSelected()
							clearCells(hot, selection)
						},
					},
					'---------2': {
						name: '---------'
					},
					'fill_increment_cells': {
						name: "Increment Cells (Ctrl+L)",
						callback: function (key: any, selection: any, clickevent: any) { //key, selection, clickEvent
							hot = getSelectedHot()
							if(!hot) return
							selection = hot.getSelected()
							fillAndIncrementCells(hot, selection)
						},
					},
					'---------3': {
						name: '---------'
					},
					'globalUndo': {
						name: "Undo (Ctrl + Z)",
						callback: function () { 
							triggerGlobalUndoRedo(undoStack, redoStack, "undo")
						},
					},
					'globalRedo': {
						name: "Redo (Ctrl + Y)",
						callback: function () { 
							triggerGlobalUndoRedo(redoStack, undoStack, "redo")
						},
					},
					'---------4': {
						name: '---------'
					},
					'remove_table': {
						name: "Delete table",
						callback: function () { //key, selection, clickEvent
							removeTable()
						},
					},
				}
			} as ContextMenuSettings,
			afterOnCellMouseUp: function () {
	
				//we need this because after we click on header edit this event is called and focuses some editor on the hot instance
				if (editHeaderCellTextInputEl) {
					setTimeout(() => {
						editHeaderCellTextInputEl!.focus()
					}, 0)
				}
	
			},
			afterOnCellMouseDown: function (event, coords, th) {
				if (coords.row !== -1) return
	
				lastClickedHeaderCellTh = th
			},
			outsideClickDeselects: function(event){
				//want to preserve select if clicking on button - span, button and i are all elements found on buttons
				if (event.tagName.toLowerCase() === "span" || event.tagName.toLowerCase() === "button" || event.tagName.toLowerCase() === "i" ){
					//span is found on col/row headers of tables so exclude these
					if(event.className === "rowHeader" || event.className === "colHeader"){
						return true
					}
					return false
				}
				//if clicking on anything else
				else{
					return true
				}
			},
			cells: function (row, col) {
				var cellProperties: GridSettings = {};
				//let metadata = this.getCellMeta(row,col)
				//cellProperties.renderer = "customRenderer"
				return cellProperties
			},
			beforeColumnResize: function (oldSize, newSize, isDoubleClick) { //after change but before render

				if (oldSize === newSize) {
					//e.g. we have a large column and the auto size is too large...
					if (initialConfig) {
						return initialConfig.doubleClickColumnHandleForcedWith
					} else {
						console.log(`initialConfig is falsy`)
					}
				}
			},
			afterColumnResize: function () {
				// syncColWidths() //covered by afterRender
			},
			afterPaste: function () {
				//could create new columns
				// syncColWidths() //covered by afterRender
			},
			enterMoves: function (event: KeyboardEvent) {

				hot = getSelectedHot()
				if (!hot) throw new Error('table was null')
	
				lastHandsonMoveWas = 'enter'
	
				const selection = hot.getSelected()
				const _default = {
					row: 1,
					col: 0
				}
	
				if (!initialConfig || initialConfig.lastRowEnterBehavior !== 'createRow') return _default
	
				if (!selection || selection.length === 0) return _default
	
				if (selection.length > 1) return _default
	
				const rowCount = hot.countRows()
	
				//see https://handsontable.com/docs/3.0.0/Core.html#getSelected
				//[startRow, startCol, endRow, endCol].
				const selected = selection[0]
				if (selected[0] !== selected[2] || selected[0] !== rowCount - 1) return _default
	
				if (event.key.toLowerCase() === 'enter' && event.shiftKey === false) {
					addRow(false)
				}
				return _default
			},
			tabMoves: function (event: KeyboardEvent) {
				hot = getSelectedHot()
				if (!hot) throw new Error('table was null')
	
				lastHandsonMoveWas = 'tab'
	
				const selection = hot.getSelected()
				const _default = {
					row: 0,
					col: 1
				}
	
				// console.log(initialConfig.lastColumnTabBehavior);
	
				if (!initialConfig || initialConfig.lastColumnTabBehavior !== 'createColumn') return _default
	
				if (!selection || selection.length === 0) return _default
	
				if (selection.length > 1) return _default
	
				const colCount = hot.countCols()
	
				//see https://handsontable.com/docs/3.0.0/Core.html#getSelected
				//[startRow, startCol, endRow, endCol]
				const selected = selection[0]
				if (selected[1] !== selected[3] || selected[1] !== colCount - 1) return _default
	
				return _default
			},
			afterBeginEditing: function () {

				if (!initialConfig || !initialConfig.selectTextAfterBeginEditCell) return
	
				const textarea = document.getElementsByClassName("handsontableInput")
				if (!textarea || textarea.length === 0 || textarea.length > 1) return
	
				const el = textarea.item(0) as HTMLTextAreaElement | null
				if (!el) return
	
				el.setSelectionRange(0, el.value.length)
			},
			// data -> [[1, 2, 3], [4, 5, 6]]
			//coords -> [{startRow: 0, startCol: 0, endRow: 1, endCol: 2}]
			beforeCopy: function (data, coords) {
				//we could change data to 1 element array containing the finished data? log to console then step until we get to SheetClip.stringify
				// console.log('data');
			},
			beforeUndo: function (_action: EditHeaderCellAction | RemoveColumnAction | InsertColumnAction | any) {

				isUndoRedo = true
				let __action = _action as EditHeaderCellAction | RemoveColumnAction | InsertColumnAction
	
				//when we change has header this is not a prolbem because the undo stack is cleared when we toggle has header
				if (__action.actionType === 'changeHeaderCell' && headerRowWithIndex) {
					let action = __action as EditHeaderCellAction
					let visualColIndex: number = action.change[1]
					let beforeValue = action.change[2]
	
					let undoPlugin = (hot as any).undoRedo
					let undoneStack = undoPlugin.undoneActions as any[]
					undoneStack.push(action)
	
					headerRowWithIndex.row[visualColIndex] = beforeValue
					setTimeout(() => {
						hot!.render()
					}, 0)
					return false
	
				} else if (__action.actionType === 'remove_col' && headerRowWithIndex) {
					// let action = __action as RemoveColumnAction
					
					let lastAction = headerRowWithIndexUndoStack.pop()
					if (lastAction && lastAction.action === "removed") {
		
						headerRowWithIndex.row.splice(lastAction.visualIndex,0, ...lastAction.headerData)
	
						headerRowWithIndexRedoStack.push({
							action: 'removed',
							visualIndex: lastAction.visualIndex,
							headerData: lastAction.headerData
						})
	
					}
	
				} else if (__action.actionType === 'insert_col' && headerRowWithIndex) {
					// let action = __action as InsertColumnAction
					
					let lastAction = headerRowWithIndexUndoStack.pop()
					if (lastAction && lastAction.action === "added") {
		
						headerRowWithIndex.row.splice(lastAction.visualIndex,lastAction.headerData.length)
	
						headerRowWithIndexRedoStack.push({
							action: 'added',
							visualIndex: lastAction.visualIndex,
							headerData: lastAction.headerData
						})
	
					}
				}
	
			},
			afterUndo: function (action: any) {
				//@ts-ignore
				let tableKey = this.rootElement.id
				hot = HotRegisterer.getInstance(tableKey)
				isUndoRedo = true
				if (!hot) throw new Error('table was null')

				let rowMeta = hot.getCellMetaAtRow(0)
				setColumnMetadata(action.index, rowMeta)
				onResizeGrid()
	
				// console.log(`afterUndo`, action)
				// //this is the case when we have a header row -> undo -> then we should have no header row
				// if (headerRowWithIndex && action.actionType === 'remove_row' && action.index === headerRowWithIndex.physicalIndex) {
				// 	//remove header row
	
				// 	//set all settings manually because we don't use much of applyHasHeader
				// 	//because this would insert/remove the header row but this is already done by the undo/redo
				// 	defaultCsvReadOptions._hasHeader = false
				// 	const el = _getById('has-header') as HTMLInputElement
				// 	const elWrite = _getById('has-header-write') as HTMLInputElement
				// 	el.checked = false
				// 	elWrite.checked = false
				// 	headerRowWithIndex = null
	
				// 	applyHasHeader(true, true)
				// }
	
				//could remove columns
				// syncColWidths() //covered by afterRender
			},
			beforeRedo: function (_action: EditHeaderCellAction | RemoveColumnAction | InsertColumnAction | any) {
	
				isUndoRedo = true

				let __action = _action as EditHeaderCellAction | RemoveColumnAction | InsertColumnAction
	
				//when we change has header this is not a prolbem because the undo stack is cleared when we toggle has header
				if (__action.actionType === 'changeHeaderCell' && headerRowWithIndex) {
	
					let action = __action as EditHeaderCellAction
					let visualColIndex: number = action.change[1]
					let afterValue = action.change[3]
	
					let undoPlugin = (hot as any).undoRedo
					let doneStack = undoPlugin.doneActions as any[]
					doneStack.push(action)
	
					headerRowWithIndex.row[visualColIndex] = afterValue
					setTimeout(() => {
						hot!.render()
					}, 0)
					return false
	
				} else if (__action.actionType === 'remove_col' && headerRowWithIndex) {
				// let action = __action as RemoveColumnAction
				
				let lastAction = headerRowWithIndexRedoStack.pop()
				if (lastAction && lastAction.action === "removed") {
	
					headerRowWithIndex.row.splice(lastAction.visualIndex, lastAction.headerData.length)
	
					headerRowWithIndexUndoStack.push({
						action: 'removed',
						visualIndex: lastAction.visualIndex,
						headerData: lastAction.headerData
					})
				}
			} else if (__action.actionType === 'insert_col' && headerRowWithIndex) {
	
				let lastAction = headerRowWithIndexRedoStack.pop()
				if (lastAction && lastAction.action === "added") {
	
					headerRowWithIndex.row.splice(lastAction.visualIndex, 0, ...lastAction.headerData)
	
					headerRowWithIndexUndoStack.push({
						action: 'added',
						visualIndex: lastAction.visualIndex,
						headerData: lastAction.headerData
					})
				}
	
			}
			},
			afterRedo: function(action: any) {
				//@ts-ignore
				let tableKey = this.rootElement.id
				hot = HotRegisterer.getInstance(tableKey)
				isUndoRedo = true
				if (!hot) throw new Error('table was null')

				let rowMeta = hot.getCellMetaAtRow(0)
				setColumnMetadata(action.index, rowMeta)
				onResizeGrid()
			},
			afterRowMove: function (startRow: number, endRow: number) {
				//@ts-ignore
				let tableKey = this.rootElement.id
				if(isUndoRedo === false){
					undoStack.push({[tableKey]: this})
					redoStack = [] //clear redo stack after new changes made?
				}

				//hot = getSelectedHot()
				if (!hot) throw new Error('table was null')
				let tableName = retrieveTable(hot)

				const matches = tableKey.match(/\d+$/); //finds counter value
				let index = fetchHtmlContainerIndex(matches[0])
				//@ts-ignore handsontable insists startRow is a number but it's actually a number array?
				//i don't understand why it does this and how to fix it...
				onTableChange(tableName, index, undefined, undefined, startRow, endRow, [], "moveRow")
			},
			afterCreateRow: function (visualRowIndex, amount) {
				//added below
				//critical because we could update hot settings here
				pre_afterCreateRow(visualRowIndex, amount)

				if(isUndoRedo === false){
					//@ts-ignore
					let tableKey = this.rootElement.id
					undoStack.push({[tableKey]: this})
					redoStack = [] //clear redo stack after new changes made?
				}
	
				//don't do this as we are inside a hook and the next listerners will change the indices and when we call
				//hot.updateSettings (inside this func) the plugin internal states are changed and the indices/mappings are corrupted
				// updateFixedRowsCols()
			},
			afterRemoveRow: function (visualRowIndex, amount) {
				//@ts-ignore
				let tableKey = this.rootElement.id
				if(isUndoRedo === false){
					undoStack.push({[tableKey]: this})
					redoStack = [] //clear redo stack after new changes made?
				}

				//we need to modify some or all hiddenPhysicalRowIndices...
				if (!hot) return
	
				for (let i = 0; i < hiddenPhysicalRowIndices.length; i++) {
					const hiddenPhysicalRowIndex = hiddenPhysicalRowIndices[i];
	
					if (hiddenPhysicalRowIndex >= visualRowIndex) {
						hiddenPhysicalRowIndices[i] -= amount
					}
				}
	
				//when we have a header row and the original index was 10 and now we have only 5 rows... change index to be the last row
				//so that when we disable has header we insert it correctly
				// const physicalIndex = hot.toPhysicalRow(visualRowIndex)
				if (headerRowWithIndex) {
					const lastValidIndex = hot.countRows()
					if (headerRowWithIndex.physicalIndex > lastValidIndex) {
						headerRowWithIndex.physicalIndex = lastValidIndex
					}
				}
	
				let tableName = retrieveTable(hot)
				const matches = tableKey.match(/\d+$/); //finds counter value
				let index = fetchHtmlContainerIndex(matches[0])

				onTableChange(tableName, index, undefined, undefined, [visualRowIndex], undefined, [], "deleteRow")
				onResizeGrid()
				//dont' call this as it corrupts hot index mappings (because all other hooks need to finish first before we update hot settings)
				//also it's not needed as handsontable already handles this internally
				// updateFixedRowsCols()
			},
			beforeKeyDown: function (event: KeyboardEvent) {

				if (event.keyCode === 90 && lastKey === 17){
					event.stopImmediatePropagation()
					//event.preventDefault()
					triggerGlobalUndoRedo(undoStack, redoStack, "undo")
					return false //this is necessary to prevent handsontable default undo being called as well
				}
				else if (event.keyCode === 89 && lastKey === 17){
					event.stopImmediatePropagation()
					//event.preventDefault()
					triggerGlobalUndoRedo(redoStack, undoStack, "redo")
					return false
				}
	
				lastKey = event.keyCode

			} as any,
		})

		//bit hacky but iterates over and sets metadata for all columns
		for(let row =0; row < hot.countRows(); row++){
			setColumnMetadata(row, tableColumns)
		}

		//@ts-ignore
		Handsontable.dom.addEvent(window as any, 'resize', throttle(onResizeGrid, 200))
	
		if (typeof afterHandsontableCreated !== 'undefined') afterHandsontableCreated(hot)
	
		hot.addHook('afterRender', afterRenderForced as any)
	
	
		isInitialHotRender = false
		//modified for multiple tables - possibly buggy but seems to work so far
		if (allColWidths[HotRegisterer.counter] && allColWidths[HotRegisterer.counter].length > 0) {
			//apply old width
			applyColWidths()
		}
	
		//make sure we see something (right size)...
		onResizeGrid()
	
		//because main.ts is loaded before this the first init must be manually...
		afterHandsontableCreated(hot!)
	
		setupScrollListeners()

		this.bucket[key] = hot;  

		for (let key in HotRegisterer.bucket){
			let firstHot = HotRegisterer.bucket[key] //doesn't work, want to get first
			if (firstHot) {
				//select first cell by default so we have always a context
				firstHot.selectCell(0, 0)
			}
			break
		}
 
    },
    getInstance: function(key) {
        let hot: Handsontable | null;
		hot = this.bucket[key];  
		return hot
	},
	removeKey: function(key) {
		delete HotRegisterer.bucket[key]
	}
};

/**
 * Modifies JSON schema information in tableColumns to fit Handsontable metadata requirements and sets up
 * the tables column options in columnOptions. Sets renderer, validator and editor for each cell. Int/float 
 * types utilise Handsontable default numeric cell type.
 * NOTE - here is where id columns (dropdown type populated from another table) would be set up. Set cell
 * type as dropdown and use function to pull source from correct tables column
 * @param tableColumns 
 */
function setColumnOptions(tableColumns: any[]){
	let columnOptions: any[] = []
	tableColumns.forEach((column, idx) => {
		//checking and converting types
		let _type = ""
		let _source: boolean[] = []
		if(column.type === "string"){
			_type = "text"
		}
		else if(column.type === "number"){
			_type = "numeric"	
		}
		else if(column.type === "integer"){
			_type = "numeric"
			}
		else if(column.type === "boolean"){
			_type = "dropdown"
			_source = [true, false]
		}
		if(column.name !== "type"){
			//don't want type to be accepted column
			if(_type === "numeric"){
				let _tmpObj = {data: column.name, title: column.name, type: _type, numericFormat: {pattern: "0", culture: "en-GB"}, editor: CustomEditor, renderer: customRenderer}
				columnOptions.push(_tmpObj)
			}
			else if(column.name === "entity_disabled"){
				let _tmpObj = {data: column.name, title: "&#10005;", type: "checkbox", renderer: customCheckboxRenderer, checkedTemplate: true, uncheckedTemplate: false}
				columnOptions.push(_tmpObj)
			}
			else{
				let _tmpObj = {data: column.name, title: column.name, type: _type, source: _source, editor: CustomEditor, renderer: customRenderer}
				columnOptions.push(_tmpObj)
			}

		}
	})	
	return columnOptions
}
/**
* Iterates over table column arrays to match correct column data to the 
* type of table currently being created.
* @param tableData currently selected table of data
* @param yamlTableColumns full set of array of column arrays
*/
function getMatchingColumns(tableName: string, yamlTableColumns: any[][]){
	let idx: number = 0
	yamlTableColumns.forEach((tableColumns, i) => {
		tableColumns.forEach((column, j) => {
			if(column.default === tableName){
				idx = i
			}
		})
	})
	return idx
}

/**
 * Sets the metadata for each table using tableColumns. This includes the default template values and
 * hover tooltip information
 * @param tableColumns 
 */
function setColumnMetadata(row: number, tableColumns: any[]){
	tableColumns.forEach((column, idx) => {
		if(hot){
			hot.setCellMeta(row, idx, "description", column.description)
			hot.setCellMeta(row, idx, "default", column.default)
			hot.setCellMeta(row, idx, "required", column.required)
			hot.setCellMeta(row, idx, "cellType", column.type)
		}
	})
}