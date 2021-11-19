type ContextMenuSettings = import("../thirdParty/handsontable/handsontable").contextMenu.Settings


type GridSettings = import("../thirdParty/handsontable/handsontable").GridSettings

/* --- common helpers --- */

/*
function setDelimiterString() {
	const el = _getById('delimiter-string') as HTMLInputElement
	defaultCsvReadOptions.delimiter = el.value
}

function setCommentString() {
	const el = _getById('comment-string') as HTMLInputElement
	defaultCsvReadOptions.comments = el.value === '' ? false : el.value
}

function setQuoteCharString() {
	const el = _getById('quote-char-string') as HTMLInputElement

	ensuredSingleCharacterString(el)

	defaultCsvReadOptions.quoteChar = el.value
}

function setEscapeCharString() {
	const el = _getById('escape-char-string') as HTMLInputElement

	ensuredSingleCharacterString(el)

	defaultCsvReadOptions.escapeChar = el.value
}*/

/**
 * @deprecated not longer supported
 */
function setSkipEmptyLines() {
	// const el = _getById('skip-empty-lines')
	// if (el) {
	// 	//currently disabled...
	// 	csvReadOptions.skipEmptyLines = el.checked
	// }
}

/**
 * sets the read delimiter programmatically
 * @param {string} delimiter 
 */
function setReadDelimiter(delimiter: string) {
	const el = _getById('delimiter-string') as HTMLInputElement
	el.value = delimiter
	defaultCsvReadOptions.delimiter = delimiter
}

/* --- write options --- */


function setHasHeaderWrite() {
	const el = _getById('has-header-write') as HTMLInputElement
	defaultCsvWriteOptions.header = el.checked
}

function setDelimiterStringWrite() {
	const el = _getById('delimiter-string-write') as HTMLInputElement
	defaultCsvWriteOptions.delimiter = el.value
}

function setCommentStringWrite() {
	const el = _getById('comment-string-write') as HTMLInputElement
	defaultCsvWriteOptions.comments = el.value === '' ? false : el.value
}

function setQuoteCharStringWrite() {
	const el = _getById('quote-char-string-write') as HTMLInputElement

	ensuredSingleCharacterString(el)

	defaultCsvWriteOptions.quoteChar = el.value
}

function setEscapeCharStringWrite() {
	const el = _getById('escape-char-string-write') as HTMLInputElement

	ensuredSingleCharacterString(el)

	defaultCsvWriteOptions.escapeChar = el.value
}

function setQuoteAllFieldsWrite() {
	const el = _getById('quote-all-fields-write') as HTMLInputElement
	defaultCsvWriteOptions.quoteAllFields = el.checked
}

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
 * sets the write delimiter programmatically
 * @param {string} delimiter 
 */
function setWriteDelimiter(delimiter: string) {
	const el = _getById('delimiter-string-write') as HTMLInputElement
	el.value = delimiter
	defaultCsvWriteOptions.delimiter = delimiter
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
 * display the given data in the handson table
 * if we have rows this sets the 
 * @see headerRow and enables the has header option
 * if we have data we convert it to match a rectangle (every row must have the same number of columns / cells)
 * @param {string[][]} csvParseResult array with the rows or null to just destroy the old table
 */
/*
function displayData(this: any, csvParseResult: ExtendedCsvParseResult | null, csvReadConfig: CsvReadOptions) {

	if (csvParseResult === null) {
		if (hot) {
			hot.getInstance().destroy()
			hot = null
		}
		return
	}

	//this will also expand comment rows but we only use the first column value...
	_normalizeDataArray(csvParseResult, csvReadConfig)
	columnIsQuoted = csvParseResult.columnIsQuoted

	//reset header row
	headerRowWithIndex = null

	// if (data.length > 0) {
	// 	headerRowWithIndex = getFirstRowWithIndexByData(data)
	// }

	const container = csvEditorDiv

	if (hot) {
		hot.destroy()
		hot = null
	}

	const initiallyHideComments = initialConfig ? initialConfig.initiallyHideComments : false

	if (initiallyHideComments && typeof csvReadConfig.comments === 'string') {
		hiddenPhysicalRowIndices = _getCommentIndices(csvParseResult.data, csvReadConfig)
	}

	//enable all find connected stuff
	//we need to setup this first so we get the events before handsontable... e.g. document keydown
	findWidgetInstance.setupFind()

	const showColumnHeaderNamesWithLettersLikeExcel = initialConfig?.showColumnHeaderNamesWithLettersLikeExcel ?? false

	let defaultColHeaderFuncBound = defaultColHeaderFunc.bind(this, showColumnHeaderNamesWithLettersLikeExcel)

	isInitialHotRender = true

	hot = new Handsontable(container, {
		data: csvParseResult.data,
		readOnly: isReadonlyMode,
		trimWhitespace: false,
		rowHeaderWidth: getRowHeaderWidth(csvParseResult.data.length),
		//false to enable virtual rendering
		renderAllRows: false, //use false and small table size for fast initial render, see https://handsontable.com/docs/7.0.2/Options.html#renderAllRows
		rowHeaders: function (row: number) { //the visual row index
			let text = (row + 1).toString()

			if (csvParseResult.data.length === 1 || isReadonlyMode) {
				return `${text} <span class="remove-row clickable" onclick="removeRow(${row})" style="visibility: hidden"><i class="fas fa-trash"></i></span>`
			}

			return `${text} <span class="remove-row clickable" onclick="removeRow(${row})"><i class="fas fa-trash"></i></span>`
			//why we would always disallow to remove first row?
			// return row !== 0
			// 	? `${text} <span class="remove-row clickable" onclick="removeRow(${row})"><i class="fas fa-trash"></i></span>`
			// 	: `${text} <span class="remove-row clickable" onclick="removeRow(${row})" style="visibility: hidden"><i class="fas fa-trash"></i></span>`
		} as any,
		afterChange: onAnyChange, //only called when cell value changed (e.g. not when col/row removed)
		fillHandle: {
			direction: 'vertical',
			autoInsertRow: false
		},
		undo: true,
		colHeaders: defaultColHeaderFuncBound as any,
		currentColClassName: 'foo', //actually used to overwrite highlighting
		currentRowClassName: 'foo', //actually used to overwrite highlighting
		//plugins
		comments: false,
		search: {
			queryMethod: customSearchMethod,
			searchResultClass: 'search-result-cell',
		} as any, //typing is wrong, see https://handsontable.com/docs/6.2.2/demo-searching.html
		wordWrap: enableWrapping,
		autoColumnSize: initialColumnWidth > 0 ? {
			maxColumnWidth: initialColumnWidth
		} : true,
		//keep this undefined/disabled because else performance is very very very bad for large files 
		//(for every row the height is calculated even if not rendered, on plugin startup and when a col is resized?)
		//i also don't understand the benefit of it... maybe for non text content?
		// autoRowSize: true, 
		manualRowMove: true,
		manualRowResize: true,
		manualColumnMove: true,
		manualColumnResize: true,
		columnSorting: true,
		fixedRowsTop: fixedRowsTop,
		fixedColumnsLeft: fixedColumnsLeft,
		//see https://handsontable.com/docs/7.1.0/demo-context-menu.html
		contextMenu: {
			items: {
				'row_above': {
					callback: function () { //key, selection, clickEvent
						insertRowAbove()
					},
					disabled: function() {
						return isReadonlyMode
					}
				},
				'row_below': {
					callback: function () { //key, selection, clickEvent
						insertRowBelow()
					},
					disabled: function() {
						return isReadonlyMode
					}
				},
				'---------': {
					name: '---------'
				},
				'col_left': {
					callback: function () { //key, selection, clickEvent
						insertColLeft()
					},
					disabled: function() {
						return isReadonlyMode
					}
				},
				'col_right': {
					callback: function () { //key, selection, clickEvent
						insertColRight()
					},
					disabled: function() {
						return isReadonlyMode
					}
				},
				'---------2': {
					name: '---------'
				},
				'remove_row': {
					disabled: function () {

						if (isReadonlyMode) return true

						const selection = hot!.getSelected()
						let allRowsAreSelected = false
						if (selection) {
							const selectedRowsCount = Math.abs(selection[0][0] - selection[0][2]) //starts at 0 --> +1
							allRowsAreSelected = hot!.countRows() === selectedRowsCount + 1
						}

						return hot!.countRows() === 1 || allRowsAreSelected
					},
				},
				'remove_col': {
					disabled: function () {

						if (isReadonlyMode) return true

						const selection = hot!.getSelected()
						let allColsAreSelected = false
						if (selection) {
							const selectedColsCount = Math.abs(selection[0][1] - selection[0][3]) //starts at 0 --> +1
							allColsAreSelected = hot!.countCols() === selectedColsCount + 1
						}

						return hot!.countCols() === 1 || allColsAreSelected
					}
				},
				'---------3': {
					name: '---------'
				},
				'alignment': {},
				'edit_header_cell': {
					name: 'Edit header cell',
					hidden: function () {
						//there is no selection for header cells...
						let selectedRanges = hot!.getSelected()

						//only one range is selected
						if (selectedRanges?.length !== 1) return true

						//only one column is selected
						if (selectedRanges[0][1] !== selectedRanges[0][3]) return true

						//the whole col must be selected then we clicked the header cell
						let maxRowIndex = hot!.countRows() - 1
						if (selectedRanges[0][0] !== 0 || selectedRanges[0][2] !== maxRowIndex) return true

						//must have custom header cells
						if (!defaultCsvReadOptions._hasHeader) return true

						if (!headerRowWithIndex) return true

						return false
					},
					callback: function (key: string, selection: Array<{ start: { col: number, row: number }, end: { col: number, row: number } }>, clickEvent: Event) {
						if (!headerRowWithIndex) return
						if (selection.length > 1) return

						let targetCol = selection[0].start.col

						showColHeaderNameEditor(targetCol)
					},
					disabled: function() {
						return isReadonlyMode
					}
				}
			}
		} as ContextMenuSettings,
		beforeColumnSort: function(currentSortConfig, destinationSortConfigs) {

			//we cannot use the setting columnSorting because this would remove the hidden indicators, this would change the coulmn width...
			if (isReadonlyMode) return false

			return
		},
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
		outsideClickDeselects: false, //keep selection

		cells: highlightCsvComments
			? function (row, col) {
				var cellProperties: GridSettings = {};
				cellProperties.renderer = 'commentValueRenderer' //is registered in util
				// cellProperties.renderer = 'invisiblesCellValueRenderer' //is registered in util

				// if (row === undefined || row === null) return cellProperties
				// if (col === undefined || col === null) return cellProperties

				//@ts-ignore
				// const _hot = this.instance as Handsontable
				// const tableData = _hot.getData() //this is slooooooow, getDataAtCell is much faster

				//we should always have 1 col
				// const visualRowIndex = _hot.toVisualRow(row); //this is toooooo slow for e.g. 100.000 rows (takes ~3.3 mins vs 12s with just cell renderer)
				// const firstCellVal = _hot.getDataAtCell(row, 0) //tableData[row][0]

				// if (firstCellVal === null) return cellProperties

				// if (typeof csvReadConfig.comments === 'string' && firstCellVal.trim().startsWith(csvReadConfig.comments)) {
				// 	//@ts-ignore
				// 	cellProperties._isComment = true
				// } else {
				// 	//@ts-ignore
				// 	cellProperties._isComment = false
				// }

				return cellProperties
			}
			: undefined,

		//not fully working... we would handle already comment cells
		// beforeChange: function (changes) {

		// 	if (!changes || changes.length !== 1) return

		// 	console.log(changes)

		// 	const rowIndex = changes[0][0]
		// 	const colIndex = changes[0][1] as number
		// 	const oldVal = changes[0][2]
		// 	const newVal = changes[0][3]

		// 	if (oldVal === newVal) return //user only started editing then canceled

		// 	if (typeof csvReadConfig.comments === 'string' && colIndex === 0 && newVal.trim().startsWith(csvReadConfig.comments)) {
		// 		//this is now a merged comment row
		// 		const _tmp = transformIntoCommentRow(rowIndex, csvReadConfig)
		// 		changes[0][3] =  _tmp
		// 		console.log(_tmp)
		// 	}

		// },

		//see https://github.com/handsontable/handsontable/issues/3328
		//ONLY working because first argument is actually the old size, which is a bug
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

			// if (headerRowWithIndex && action.actionType === 'remove_row' && action.index === headerRowWithIndex.physicalIndex) { //first row cannot be removed normally so it must be the header row option
			// 	//we re insert header row

			// 	defaultCsvReadOptions._hasHeader = true
			// 	const el = _getById('has-header') as HTMLInputElement
			// 	const elWrite = _getById('has-header-write') as HTMLInputElement
			// 	el.checked = true
			// 	elWrite.checked = true

			// 	applyHasHeader(true, true)
			// }
		},
		/**
		 * isForced: Is true if rendering was triggered by a change of settings or data; or 
		 * false if rendering was triggered by scrolling or moving selection.
		 * 
		 * WE now do this in an additional hook
		 */
		// afterRender: function (isForced: boolean) {
		// 	if (!isForced || isInitialHotRender) return
		// 	//e.g. when we edit a cell and the cell must adjust the width because of the content
		// 	//there is no other hook?
		// 	//this is also fired on various other event (e.g. col resize...) but better sync more than miss an event
		// 	syncColWidths()
		// },
		/**
		 * this is an array if we e.g. move consecutive columns (2,3)
		 *   but maybe there is a way... this func should handle this anyway
		 * endColVisualIndex: the column is inserted left to this index
		 */
		/*
		afterColumnMove: (function (startColVisualIndices: number[], endColVisualIndex: number) {

			if (!hot) throw new Error('table was null')

			//DO not update settings while we are in some hooks!
			//else the index mapping might get corrupted
			// hot.updateSettings({
			// 	colHeaders: defaultColHeaderFunc as any
			// }, false)

			//clear all undo redo because handsontable do not undo the col moves but the edits... which leads to wrong data!
			headerRowWithIndexUndoStack.splice(0)
			headerRowWithIndexRedoStack.splice(0)
			let undoPlugin = (hot as any).undoRedo
			undoPlugin.clear()

			//dirty copy of below!!!
			if (headerRowWithIndex !== null) {
				//same as in columnIsQuoted... see below for docs
				let temp = headerRowWithIndex

				const headerRowTexts: (string | null)[] = startColVisualIndices.map(p => temp.row[p]) //for some reason we need tmp here else can be null??

				let headerRowCopy: Array<string | null> = []

				for (let i = 0; i <= headerRowWithIndex.row.length; i++) {
					const colText = i < headerRowWithIndex.row.length ? headerRowWithIndex.row[i] : null;

					let startIndex = startColVisualIndices.indexOf(i)

					if (startIndex !== -1) {
						continue
					}

					if (i === endColVisualIndex) {
						headerRowCopy.push(...headerRowTexts)
					}

					if (i >= headerRowWithIndex.row.length) continue

					headerRowCopy.push(colText)
				}

				headerRowWithIndex.row = headerRowCopy
			}

			if (columnIsQuoted) {
				//we can use visual indices here because we keep {@link columnIsQuoted} up-to-date
				//so after e.g. col 3 is moved to 0 columnIsQuoted[0] will contain the data from the old columnIsQuoted[3]

				const startQuoteInformation: boolean[] = startColVisualIndices.map(p => columnIsQuoted[p])

				//we could calculate with the indices and mutate them...
				//i guess it's easier to just create a new array...

				let quoteCopy: boolean[] = []

				//endColVisualIndex can be columnIsQuoted.length
				//e.g. when we move the first col behind the last we need to iterate to columnIsQuoted.length
				//else we won't insert the quote information from the first field
				for (let i = 0; i <= columnIsQuoted.length; i++) {
					const quoteInfo = i < columnIsQuoted.length ? columnIsQuoted[i] : false;

					let startIndex = startColVisualIndices.indexOf(i)

					if (startIndex !== -1) {
						continue
					}

					if (i === endColVisualIndex) {
						//insert all moved
						quoteCopy.push(...startQuoteInformation)
					}

					//we iterate more than we have columnIsQuoted information
					//e.g. when we move the first col behind the last we need to iterate to columnIsQuoted.length
					if (i >= columnIsQuoted.length) continue

					quoteCopy.push(quoteInfo)
				}

				columnIsQuoted = quoteCopy
			}

			// syncColWidths() //covered by afterRender
			onAnyChange()
		} as any),
		afterRowMove: function (startRow: number, endRow: number) {
			if (!hot) throw new Error('table was null')
			onAnyChange()
		},
		afterGetRowHeader: function (visualRowIndex: number, th: any) {
			const tr = th.parentNode as HTMLTableRowElement

			if (!tr || !hot) return

			//is row hidden?
			let physicalIndex = hot.toPhysicalRow(visualRowIndex)

			if (hiddenPhysicalRowIndices.indexOf(physicalIndex) === -1) {
				tr.classList.remove('hidden-row')

				if (tr.previousElementSibling) {
					tr.previousElementSibling.classList.remove('hidden-row-previous-row')
				}

			} else {
				tr.classList.add('hidden-row')

				//css cannot select previous elements...add a separate class
				if (tr.previousElementSibling) {
					tr.previousElementSibling.classList.add('hidden-row-previous-row')
				}
			}
		},
		afterCreateCol: function (visualColIndex, amount, source?: string) {

			if (!hot) return

			if (headerRowWithIndex) {
				// const physicalIndex = hot.toPhysicalColumn(visualColIndex)

				if (source !== `UndoRedo.undo` && source !== `UndoRedo.redo`) { //undo redo is already handled
					headerRowWithIndexUndoStack.push({
						action: 'added',
						visualIndex: visualColIndex,
						headerData: [...Array(amount).fill(null)],
					})

					headerRowWithIndex.row.splice(visualColIndex, 0, ...Array(amount).fill(null))
				} 
			}

			if (columnIsQuoted) {
				// const physicalIndex = hot.toPhysicalColumn(visualColIndex)
				columnIsQuoted.splice(visualColIndex, 0, ...Array(amount).fill(newColumnQuoteInformationIsQuoted))
			}

			// syncColWidths() //covered by afterRender
			onAnyChange()
			//dont' call this as it corrupts hot index mappings (because all other hooks need to finish first before we update hot settings)
			//also it's not needed as handsontable already handles this internally
			// updateFixedRowsCols()
		},
		afterRemoveCol: function (visualColIndex, amount, someting?: any, source?: string) {

			let isFromUndoRedo = (source === `UndoRedo.undo` || source === `UndoRedo.redo`)
			if (headerRowWithIndex && !isFromUndoRedo) { //undo redo is already handled
				headerRowWithIndexUndoStack.push({
					action: 'removed',
					visualIndex: visualColIndex,
					headerData: [headerRowWithIndex.row[visualColIndex]]
				})
			}

			//added below
			//critical because we could update hot settings here
			pre_afterRemoveCol(visualColIndex, amount, isFromUndoRedo)
		},
		//inspired by https://github.com/handsontable/handsontable/blob/master/src/plugins/hiddenRows/hiddenRows.js
		//i absolutely don't understand how handsontable implementation is working... 
		//their this.hiddenRows should be physical indices (see https://github.com/handsontable/handsontable/blob/master/src/plugins/hiddenRows/hiddenRows.js#L254)
		//but in onAfterCreateRow & onAfterRemoveRow they check against `visualRow` which is actually the physical row (see above)
		//and then they increment the physical row via the amount
		//however, it works somehow...
		afterCreateRow: function (visualRowIndex, amount) {
			//added below
			//critical because we could update hot settings here
			pre_afterCreateRow(visualRowIndex, amount)

			//don't do this as we are inside a hook and the next listerners will change the indices and when we call
			//hot.updateSettings (inside this func) the plugin internal states are changed and the indices/mappings are corrupted
			// updateFixedRowsCols()
		},
		afterRemoveRow: function (visualRowIndex, amount) {
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

			onAnyChange()
			//dont' call this as it corrupts hot index mappings (because all other hooks need to finish first before we update hot settings)
			//also it's not needed as handsontable already handles this internally
			// updateFixedRowsCols()
		},
		//called when we select a row via row header
		beforeSetRangeStartOnly: function (coords) {
		},
		beforeSetRangeStart: function (coords) {

			if (!hot) return

			if (hiddenPhysicalRowIndices.length === 0) return

			const lastPossibleRowIndex = hot.countRows() - 1
			const lastPossibleColIndex = hot.countCols() - 1
			const actualSelection = hot.getSelectedLast()
			let columnIndexModifier = 0
			const isLastOrFirstRowHidden = hiddenPhysicalRowIndices.indexOf(lastPossibleRowIndex) !== -1
				|| hiddenPhysicalRowIndices.indexOf(0) !== -1

			let direction = 1 // or -1

			if (actualSelection) {
				const actualPhysicalIndex = hot.toPhysicalRow(actualSelection[0])
				direction = actualPhysicalIndex < coords.row ? 1 : -1

				//direction is invalid if actualPhysicalIndex === 0 && coords.row === lastPossibleRowIndex 
				//this is because the last row is hidden...

				//move up but last row is hidden
				if (isLastOrFirstRowHidden && coords.row === lastPossibleRowIndex && actualPhysicalIndex === 0) { //
					direction = -1
				}
				//move down on last row but first row is hidden
				else if (isLastOrFirstRowHidden && coords.row === 0 && actualPhysicalIndex === lastPossibleRowIndex) {
					direction = 1
				}
			}

			const getNextRow: (a: number) => number = (visualRowIndex: number) => {

				let visualRow = visualRowIndex;
				//@ts-ignore
				let physicalIndex = hot.toPhysicalRow(visualRowIndex)

				if (visualRow > lastPossibleRowIndex) { //moved under the last row
					columnIndexModifier = 1
					return getNextRow(0)
				}

				if (visualRow < 0) { //we moved above row 0
					columnIndexModifier = -1
					return getNextRow(lastPossibleRowIndex)
				}

				if (hiddenPhysicalRowIndices.indexOf(physicalIndex) !== -1) {
					//row is hidden
					return getNextRow(visualRow + direction)
				}

				return visualRow
			}


			coords.row = getNextRow(coords.row)

			if (lastHandsonMoveWas !== 'tab') {
				coords.col = coords.col + (isLastOrFirstRowHidden ? columnIndexModifier : 0)
			}

			if (coords.col > lastPossibleColIndex) {
				coords.col = 0
			}
			else if (coords.col < 0) {
				coords.col = lastPossibleColIndex
			}

			lastHandsonMoveWas = null
		},
		//called multiple times when we move mouse while selecting...
		beforeSetRangeEnd: function () {
		},

		rowHeights: function (visualRowIndex: number) {

			//see https://handsontable.com/docs/6.2.2/Options.html#rowHeights
			let defaultHeight = 23

			if (!hot) return defaultHeight

			const actualPhysicalIndex = hot.toPhysicalRow(visualRowIndex)

			//some hack so that the renderer still respects the row... (also see http://embed.plnkr.co/lBmuxU/)
			//this is needed else we render all hidden rows as blank spaces (we see a scrollbar but not rows/cells)
			//but this means we will lose performance because hidden rows are still managed and rendered (even if not visible)
			if (hiddenPhysicalRowIndices.includes(actualPhysicalIndex)) {
				//sub 1 height is treated by the virtual renderer as height 0??
				//we better add some more zeros
				return 0.000001
			}

			return defaultHeight
		} as any,

		beforeKeyDown: function (event: KeyboardEvent) {

			//we need this because when editing header cell the hot instance thinks some editor is active and would pass the inputs to the next cell...
			if (editHeaderCellTextInputEl) {
				event.stopImmediatePropagation()
				return
			}

			//NOTE that this can prevent all vs code shortcuts... e.g. cmd+p (on mac)!!!
			if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowDown') {
				event.stopImmediatePropagation()
				insertRowBelow()
			} else if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowUp') {
				event.stopImmediatePropagation()
				insertRowAbove()
			} else if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowLeft') {
				event.stopImmediatePropagation()
				insertColLeft()
			} else if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowRight') {
				event.stopImmediatePropagation()
				insertColRight()
			}

		} as any,

	})

	//@ts-ignore
	Handsontable.dom.addEvent(window as any, 'resize', throttle(onResizeGrid, 200))

	if (typeof afterHandsontableCreated !== 'undefined') afterHandsontableCreated(hot)

	hot.addHook('afterRender', afterRenderForced as any)

	/*
	const oldShouldApplyHeaderReadOption = defaultCsvReadOptions._hasHeader
	const settingsApplied = checkIfHasHeaderReadOptionIsAvailable(true)

	//if we have only 1 row and header is enabled by default...this would be an error (we cannot display something)

	if (oldShouldApplyHeaderReadOption === true) {

		if (settingsApplied === true) { //this must be applied else we get duplicate first row

			_applyHasHeader(true, false)

			updateFixedRowsCols()
		} else {
			//head cannot be applied (because only 1 or 0 rows) ... but settings say user want to has header...
			//set auto enable if we have enough rows
			setShouldAutpApplyHasHeader(true)
		}
	}*/

	/*
	isInitialHotRender = false
	if (allColWidths && allColWidths.length > 0) {
		//apply old width
		applyColWidths()
	}

	//make sure we see something (right size)...
	onResizeGrid()

	//because main.ts is loaded before this the first init must be manually...
	afterHandsontableCreated(hot!)

	setupScrollListeners()

	if (hot) {
		//select first cell by default so we have always a context
		hot.selectCell(0, 0)
	}
}*/

/**
 * should be called by hot if anything was changed in cell
 */
function onAnyChange(changes?: CellChanges[] | null, reason?: string, _tableName?: string) {

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

		let changeContent: ReturnChangeObject = {tableName: _tableName, columnName: columns, cellValue: cells, oldRowIndex: oldIndexes, newRowIndex: newIndexes}
		
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
 * moved
 */
function onTableChange(_tableName: string, _colName: string | undefined, _cellValue: string | number | undefined, _oldRowIndex: number[] | undefined, _newRowIndex: number | undefined, _tableData: any[], reason: string) {
	
	let changeContent: ReturnChangeObject = {tableName: _tableName}
	switch(reason){
		case "addRow":
			changeContent.newRowIndex = _newRowIndex
			if(_tableData.length > 0){
				changeContent.tableData = _tableData[0] 
			}
			break
			//this fetches table name, row index and row data and sends it over
		case "deleteRow":
			changeContent.oldRowIndex = _oldRowIndex
			break
			//pass in row index (old = new)
		case "moveRow":
			changeContent.newRowIndex = _newRowIndex
			changeContent.oldRowIndex = _oldRowIndex
			break
			//pass in old row index and new row index
		case "addTable":
			changeContent.tableData = _tableData
			break
			//pass tabledata in
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

	/*
	if (!hot) return

	//this is a bit messy but it works...??
	// console.log(`col widths applies`, allColWidths)
	//snatched from https://github.com/YaroslavOvdii/fliplet-widget-data-source/blob/master/js/spreadsheet.js
	hot.getSettings().manualColumnResize = false
	let autoSizedWidths = _getColWidths()

	//maybe the user removed columns so we don't have all widths... e.g. remove cols then reset data...
	//we keep the col widths we have and add the auto size ones for the columns where we don't have old sizes...
	//NOTE we don't store the column names so we probably apply the wrong size to the wrong columns, e.g. 2 cols, reset 5 columns -> first 2 columns will get the old size of the old 2 columns
	for (let i = allColWidths.length; i < autoSizedWidths.length; i++) {
		const colWidth = autoSizedWidths[i]
		allColWidths.push(colWidth)
	}

	//note that setting colWidths will disable the auto size column plugin (see Plugin AutoColumnSize.isEnabled)
	//it is enabled if (!colWidths)
	hot.updateSettings({ colWidths: allColWidths }, false)
	hot.getSettings().manualColumnResize = true
	hot.updateSettings({}, false)
	hot.getPlugin('autoColumnSize').enablePlugin()
	*/
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
 * generates the default html wrapper code for the given column name OR uses {@link headerRowWithIndex}
 * we add a delete icon
 * @param {number} colIndex the physical column index (user could have moved cols so visual first col is not the physical second) use https://handsontable.com/docs/6.2.2/RecordTranslator.html to translate
 * 	call like hot.toVisualColumn(colIndex)
 * @param {string | undefined | null} colName 
 * @param useLettersAsColumnNames true: use excel like letters for column names, false: use the index BUT an explicit colName will take precedence over this setting
 */
function defaultColHeaderFunc(useLettersAsColumnNames: boolean, colIndex: number, colName: string | undefined | null) {

	let text = useLettersAsColumnNames
		? spreadsheetColumnLetterLabel(colIndex)
		: getSpreadsheetColumnLabel(colIndex)

	if (headerRowWithIndex !== null && colIndex < headerRowWithIndex.row.length) {
		let visualIndex = colIndex
		if (hot) {
			visualIndex = hot.toVisualColumn(colIndex) //use visual column because we keep headerRowWithIndex up-to-date
			//when adding/removing/moving columns
		}
		const data = headerRowWithIndex.row[visualIndex]

		//however, after opening the cell editor null becomes the empty string (after committing the value)...
		if (data !== null) {
			text = data
		}
	}

	//null can also happen if we enable header, add column, disable header, enable header (then the new column have null values)
	if (colName !== undefined && colName !== null) {
		text = colName
	}

	let visualIndex = colIndex

	if (!hot) return ``
	// if (!hot) {
	// 	return `${text} <span class="remove-col clickable" onclick="removeColumn(${visualIndex})" style="visibility: hidden"><i class="fas fa-trash"></i></span>`
	// }

	visualIndex = hot.toVisualColumn(colIndex)

	if (hot.countCols() === 1 || isReadonlyMode) {
		return `${text} <span class="remove-col clickable" onclick="removeColumn(${visualIndex})" style="visibility: hidden"><i class="fas fa-trash"></i></span>`
	}

	return `${text} <span class="remove-col clickable" onclick="removeColumn(${visualIndex})"><i class="fas fa-trash"></i></span>`
}


/**
 * displays or hides the ask delete table modal
 * @param isVisible 
 */
function toggleAskDeleteTableModalDiv(isVisible: boolean) {

	if (isVisible) {
		askDeleteTableModalDiv.classList.add('is-active')
		return
	}

	askDeleteTableModalDiv.classList.remove('is-active')
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
	displayYamlData(_data.tablesArray, _data.tableHeaders, _data.tableColumns)

	//might be bigger than the current view
	onResizeGrid()
}

function startReceiveCsvProgBar() {
	receivedCsvProgBar.value = 0
	receivedCsvProgBarWrapper.style.display = "block"
}

function intermediateReceiveCsvProgBar() {
	receivedCsvProgBar.attributes.removeNamedItem('value')
}

function stopReceiveCsvProgBar() {
	receivedCsvProgBarWrapper.style.display = "none"
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
 * 
 * @param reason 
 * @param contentChanges 
 */
function postModifyContent(reason: string, contentChanges: ReturnChangeObject){
		const modifiedContent = JSON.stringify(contentChanges)
		_postModifyContent(reason, modifiedContent)
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

function trimAllCells() {

	if (!hot) throw new Error('table was null')

	const numRows = hot.countRows()
	const numCols = hot.countCols()
	const allData = getData()
	let data: string = ''
	let hasAnyChanges = false

	for (let row = 0; row < numRows; row++) {
		for (let col = 0; col < numCols; col++) {
			data = allData[row][col]

			if (typeof data !== "string") {
				// console.log(`${row}, ${col} no string`)
				continue
			}

			allData[row][col] = data.trim()

			if (allData[row][col] !== data) {
				hasAnyChanges = true
			}
			//tooo slow for large tables
			// hot.setDataAtCell(row, col, data.trim())
		}
	}

	if (headerRowWithIndex) {
		for (let col = 0; col < headerRowWithIndex.row.length; col++) {
			const data = headerRowWithIndex.row[col]

			if (typeof data !== "string") {
				continue
			}

			headerRowWithIndex.row[col] = data.trim();

			if (headerRowWithIndex.row[col] !== data) {
				hasAnyChanges = true
			}
		}
	}

	hot.updateSettings({
		data: allData
	}, false)

	//hot.updateSettings reloads data and thus afterChange hook is triggered
	//BUT the change reason is loadData and thus we ignore it...
	if (hasAnyChanges) {
		onAnyChange()
	}

	// const afterData = getData()

	// for (let row = 0; row < numRows; row++) {
	// 	for (let col = 0; col < numCols; col++) {

	// 		if (afterData[row][col] !== allData[row][col]) {
	// 			console.log(`${row}, ${col}`)
	// 		}
	// 	}
	// }

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

const minSidebarWidthInPx = 150
const collapseSidePanelThreshold = 60 //if we drag the handle e.g. between left: [0, 80] we collapse the side panel, so this is the left space to the left window border
/**
 * setsup the sidedbar resize handle events
 */
/*
function setupSideBarResizeHandle() {

	let downX: number | null = null
	let _style = window.getComputedStyle(sidePanel)
	let downWidth: number = minSidebarWidthInPx

	sideBarResizeHandle.addEventListener(`mousedown`, (e) => {
		downX = e.clientX
		_style = window.getComputedStyle(sidePanel)
		downWidth = parseInt(_style.width.substring(0, _style.width.length - 2))
		if (isNaN(downWidth)) downWidth = minSidebarWidthInPx
	})


	document.addEventListener(`mousemove`, throttle((e: MouseEvent) => {
		if (downX === null) return

		const delta = e.clientX - downX

		sidePanel.style.width = `${Math.max(downWidth + delta, minSidebarWidthInPx)}px`
		sidePanel.style.maxWidth = `${Math.max(downWidth + delta, minSidebarWidthInPx)}px`

		if (vscode) {

			const isSidePanelCollapsed = getIsSidePanelCollapsed()

			if (e.clientX <= collapseSidePanelThreshold) {
				//we want to collapse the side panel
				if (!isSidePanelCollapsed) toggleSidePanel(true)
			} else {
				//this is not really possible because we cannot drag the collapsed panel...
				//ensude the side panel is not collapsed (expanded)
				if (isSidePanelCollapsed) toggleSidePanel(false)
			}
		}

		onResizeGrid()
	}, 200))

	document.addEventListener(`mouseup`, (e) => {
		downX = null
	})

}
*/

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

/**
 * gets if the side panel is collapsed (true) or not (false)
 */
/*
function getIsSidePanelCollapsed(): boolean {

	//only in vs code
	if (vscode) {
		return window.getComputedStyle(leftPanelToggleIconExpand).display === 'block'
	}

	//panel cannot be collapsed in browser
	return false
}*/

/**
 * toggles the side panel
 */
/*
function toggleSidePanel(shouldCollapse?: boolean) {

	//only in extension (not in browser)
	if (vscode && shouldCollapse === undefined) {
		const isSidePanelCollapsed = getIsSidePanelCollapsed()
		if (isSidePanelCollapsed) {
			shouldCollapse = false
		} else {
			shouldCollapse = true
		}
	}

	document.documentElement.style
		.setProperty('--extension-side-panel-display', shouldCollapse ? `none` : `flex`)

	document.documentElement.style
		.setProperty('--extension-side-panel-expand-icon-display', shouldCollapse ? `block` : `none`)

	document.documentElement.style
		.setProperty('--extension-side-panel-collapse-icon-display', shouldCollapse ? `none` : `block`)

	onResizeGrid()

	if (shouldCollapse) {
		//will be hidden
	} else {
		//we now display the stats ... calculate it
		recalculateStats()
	}

}*/

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

	onTableChange(tableName, undefined, undefined, undefined, visualRowIndex, newRowData, "addRow")
	//dont' call this as it corrupts hot index mappings (because all other hooks need to finish first before we update hot settings)
	//also it's not needed as handsontable already handles this internally
	// updateFixedRowsCols()

	//checkAutoApplyHasHeader()
}

function showColHeaderNameEditor(visualColIndex: number) {

	if (!headerRowWithIndex) return
	if (!lastClickedHeaderCellTh) return

	//see https://stackoverflow.com/questions/18348437/how-do-i-edit-the-header-text-of-a-handsontable
	//update hot
	//col resizing? ok because input loses focus
	//long render indicators are not really necessary at this point because 100k row files only takes 1-2s
	//does work with virtual indices (e.g. when we reordered the columns)

	let rect = lastClickedHeaderCellTh.getBoundingClientRect()

	let input = document.createElement(`input`)
	input.setAttribute(`type`, `text`)
	input.style.position = `absolute`
	input.style.left = `${rect.left}px`
	editHeaderCellTextInputLeftOffsetInPx = rect.left
	input.style.top = `${rect.top}px`
	input.style.width = `${rect.width}px`
	input.style.height = `${rect.height}px`
	input.style.zIndex = `1000`

	input.value = headerRowWithIndex.row[visualColIndex] ?? ''
	editHeaderCellTextInputEl = input

	let overlayWrapper = getHandsontableOverlayScrollLeft()!
	handsontableOverlayScrollLeft = overlayWrapper.scrollLeft

	let inputWasRemoved = false
	const removeInput = () => {
		editHeaderCellTextInputEl = null
		//this also calls blur
		if (inputWasRemoved) return
		inputWasRemoved = true
		input.remove()
	}

	//blur -> commit
	//esc -> revert

	const beforeValue = input.value
	//set to false initially e.g. when we focus some other window we don't want to apply changes
	let shouldApplyChanges = true

	let applyChange = () => {
		shouldApplyChanges = false
		if (headerRowWithIndex && beforeValue !== input.value) {
			headerRowWithIndex.row[visualColIndex] = input.value

			let undoPlugin = (hot as any).undoRedo
			let doneStack = undoPlugin.doneActions as any[]
			let editHeaderRow: EditHeaderCellAction = {
				actionType: 'changeHeaderCell',
				change: [0, visualColIndex, beforeValue, input.value]
			}
			doneStack.push(editHeaderRow)

			//TODO show indicator?
			hot!.render()
		}
	}

	let addListeners = () => {

		input.addEventListener(`blur`, () => {
			if (shouldApplyChanges) {
				applyChange()
			}
			removeInput()
		})

		input.addEventListener(`keyup`, (e) => {

			if (e.key.toLocaleLowerCase() === `escape`) {
				shouldApplyChanges = false
				removeInput()
			}

			if (e.key.toLocaleLowerCase() === `enter`) {
				shouldApplyChanges = true
				applyChange()
				removeInput()
			}
		})
	}


	document.body.appendChild(input)

	setTimeout(() => {
		addListeners()
		// input.select()
	})

}

/**
 * creates an empty template table of user selected type from schema
 */
function addTable(){
	const selectEl = <HTMLSelectElement>_getById("entities")
	const tableType: string = selectEl.options[selectEl.selectedIndex].value
	if(tableType === "") return //in case no option selected

	//set up columns
	let newTableColumns: any[] = []
	initialData.tableColumns.forEach((table) => { //iterates to find correct schema data
		table.forEach((column) => {
			if(column.name === "type" && column.default === tableType){
				newTableColumns = table
			}
		})
	})
	const columnOptions = setColumnOptions(newTableColumns)

	//create empty row of data to initialise table
	let emptyData: {[k: string]: any} = {}
	newTableColumns.forEach((column) => {
		if(column.required === true){
			emptyData[column.name] = null
		}
		else if(column.name === "type"){ //set up type column here
			emptyData[column.name] = tableType
		}
	})

	const tableKey: string = "table" + HotRegisterer.counter
	const container = createHtmlContainer(HotRegisterer.counter, tableType)
	if (container){
		HotRegisterer.register(tableKey, container, [emptyData], columnOptions, [])
		HotRegisterer.counter++
		setColumnMetadata(0, newTableColumns)
	}
	else{
		console.log("couldn't find html to create table")
		//TO DO - better error/exception handling here
	}

	onResizeGrid()

	console.log(Object.keys(emptyData))

	hot = HotRegisterer.getInstance(tableKey)
	if(!hot) return // TO DO need an exception error thrown bc if can't access table means smthn went wrong
	onTableChange(tableType, undefined, undefined, undefined, undefined, [hot.getSourceDataAtRow(0)], "addTable")
}

/**
 * called when a table is manually deleted
 */
function removeTable(){
	toggleAskDeleteTableModalDiv(false)
	hot = getSelectedHot()
	if (!hot) throw new Error('table was null')
	//@ts-ignore
	let tableKey = hot.rootElement.id
	let tableName = retrieveTable(hot)
	
	let container: HTMLElement | null = document.getElementById(tableKey)
	if(hot && container){
		hot.destroy()
		hot = null
		let key: string = (container.id).substr((container.id).length -1)
		HotRegisterer.removeKey("table"+key)
		deleteHtmlContainer("container"+key)
	}
	onResizeGrid()
	onTableChange(tableName, undefined, undefined, undefined, undefined, [], "deleteTable")
}

/**
 * creates HOT instances and adds their references to a bucket so can be identified.
 * @param counter keeps track of how many previous instances created in order to
 * continue creating unique IDs
 * @param register used to create a new HOT instance and register it in the bucket
 * @param getInstance used to select a particular table instance
 * @param bucket a bucket to store all the keys to hot instances in
 * @param removeKey removes deleted instances from bucket
 */
let HotRegisterer: HotRegister = {
	counter: 0,
    bucket: {},
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
	
				if (tableData.length === 1 || isReadonlyMode) {
					return `${text} <span class="remove-row clickable" onclick="removeRow(${row})" style="visibility: hidden"><i class="fas fa-trash"></i></span>`
				}
	
				return `${text} <span class="remove-row clickable" onclick="removeRow(${row})"><i class="fas fa-trash"></i></span>`
				//why we would always disallow to remove first row?
				// return row !== 0
				// 	? `${text} <span class="remove-row clickable" onclick="removeRow(${row})"><i class="fas fa-trash"></i></span>`
				// 	: `${text} <span class="remove-row clickable" onclick="removeRow(${row})" style="visibility: hidden"><i class="fas fa-trash"></i></span>`
			} as any,
			renderAllRows: false, //use false and small table size for fast initial render, see https://handsontable.com/docs/7.0.2/Options.html#renderAllRows
			afterChange: function(changes: [number, string | number, any, any][], reason: string){
				//push changes to global undo stack
				if(this.undo && (reason !== "UndoRedo.undo" && reason !== "UndoRedo.redo")){
					undoStack.push(this)
					redoStack = [] //clear redo stack after new changes made?
				}
				//@ts-ignore says getDataAtRowProp doesn't exist on default settings but it does?
				onAnyChange(changes, reason, this.getDataAtRowProp(0, "type"))}, //only called when cell value changed (e.g. not when col/row removed)
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
						disabled: function () {
	
							if (isReadonlyMode) return true
							
							hot = getSelectedHot()
							if (!hot) throw new Error('table was null')

							const selection = hot!.getSelected()
							let allRowsAreSelected = false
							if (selection) {
								const selectedRowsCount = Math.abs(selection[0][0] - selection[0][2]) //starts at 0 --> +1
								allRowsAreSelected = hot!.countRows() === selectedRowsCount + 1
							}
	
							return hot!.countRows() === 1 || allRowsAreSelected
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
						name: "Fill Cells (Ctrl+L)",
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
							triggerGlobalUndo()
						},
					},
					'globalRedo': {
						name: "Redo (Ctrl + Y)",
						callback: function () { 
							triggerGlobalRedo()
						},
					},
					'---------4': {
						name: '---------'
					},
					'remove_table': {
						name: "Delete table",
						callback: function () { //key, selection, clickEvent
							toggleAskDeleteTableModalDiv(true)
						},
					},
					'alignment': {},
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
				hot = getSelectedHot()
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
				hot = getSelectedHot()
				if (!hot) throw new Error('table was null')

				let rowMeta = hot.getCellMetaAtRow(0)
				setColumnMetadata(action.index, rowMeta)
				onResizeGrid()
			},
			afterRowMove: function (startRow: number, endRow: number) {
				hot = getSelectedHot()
				if (!hot) throw new Error('table was null')
				let tableName = retrieveTable(hot)
				//@ts-ignore handsontable insists startRow is a number but it's actually a number array?
				//i don't understand why it does this and how to fix it...
				onTableChange(tableName, undefined, undefined, startRow, endRow, [], "moveRow")
			},
			afterCreateRow: function (visualRowIndex, amount) {
				//added below
				//critical because we could update hot settings here
				pre_afterCreateRow(visualRowIndex, amount)
	
				//don't do this as we are inside a hook and the next listerners will change the indices and when we call
				//hot.updateSettings (inside this func) the plugin internal states are changed and the indices/mappings are corrupted
				// updateFixedRowsCols()
			},
			afterRemoveRow: function (visualRowIndex, amount) {
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
				//onAnyChange()
				onTableChange(tableName, undefined, undefined, [visualRowIndex], undefined, [], "deleteRow")
				onResizeGrid()
				//dont' call this as it corrupts hot index mappings (because all other hooks need to finish first before we update hot settings)
				//also it's not needed as handsontable already handles this internally
				// updateFixedRowsCols()
			},
			beforeKeyDown: function (event: KeyboardEvent) {

				//we need this because when editing header cell the hot instance thinks some editor is active and would pass the inputs to the next cell...
				if (editHeaderCellTextInputEl) {
					event.stopImmediatePropagation()
					return
				}
	
				//NOTE that this can prevent all vs code shortcuts... e.g. cmd+p (on mac)!!!
				if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowDown') {
					event.stopImmediatePropagation()
					insertRowBelow()
				} else if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowUp') {
					event.stopImmediatePropagation()
					insertRowAbove()
				} else if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowLeft') {
					event.stopImmediatePropagation()
					insertColLeft()
				} else if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'ArrowRight') {
					event.stopImmediatePropagation()
					insertColRight()
				}
	
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
 * takes the json schema column objects and modifies for processing by handsontable
 * TO DO - here is where would add in object type referencing other table columns as source data
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
			else{
				let _tmpObj = {data: column.name, title: column.name, type: _type, source: _source, editor: CustomEditor, renderer: customRenderer}
				columnOptions.push(_tmpObj)
			}

		}
	})	
	return columnOptions
}
/**
* finds the correct array of column objects for the currently selected table
* @param tableData currently selected table of data
* @param yamlTableColumns full set of array of column arrays
*/
function getMatchingColumns(tableName: string, yamlTableColumns: any[][]){
	let idx: number = 0
	//make sure we select correct column data
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
 * uses json schema to set cell metadata
 * @param tableColumns 
 */
function setColumnMetadata(row: number, tableColumns: any[]){
	tableColumns.forEach((column, idx) => {
		if(hot){
			//TO DO - descriptions are off by 1 or 2 index, need to fix
			hot.setCellMeta(row, idx, "description", column.description)
			hot.setCellMeta(row, idx, "default", column.default)
			hot.setCellMeta(row, idx, "required", column.required)
			hot.setCellMeta(row, idx, "cellType", column.type)
		}
	})
}