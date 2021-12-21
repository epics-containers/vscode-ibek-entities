
/**
 * some initial vars from the extension when the webview is created
 */
type InitialVars = {
	/**
	 * true: the extension is watching the source file for changes
	 * false: not (e.g. file is not in the workspace or something other)
	 */
	isWatchingSourceFile: boolean
}

/**
 * the settings for the plugin
 */
type YamlEditSettings = {

	/**
	 * if one edits a cell in the last row and presses enter what the editor should do
	 * 
	 * default: default of handson table
	 * createRow: create a new row
	 */
	lastRowEnterBehavior: 'default' | 'createRow'

	/**
	 * if one edits a cell in the last column and presses tab what the editor should do
	 * 
	 * default: default of handson table
	 * createColumn: create a new column
	 */
	lastColumnTabBehavior: 'default' | 'createColumn'

	/**
	 * normally the columns are auto sized, if we click on the handle when it has auto size then its with is set to this value (in px). Useful if we have a very wide column (wider than the screen and quickly want to shrink it)
	 */
	doubleClickColumnHandleForcedWith: number

	/**
	 * true: opens the source file after apply, false: keep the editor displayed
	 */
	openSourceFileAfterApply: boolean

	/**
	 * true: select the text inside the cell (note you can also select the cell and start typings to overwrite the cell value), false: cursor starts at the end of the text
	 */
	selectTextAfterBeginEditCell: boolean

	/**
	 * true: cell content is wrapped and the row height is changed, false: no wrapping (content is hidden)
	 */
	enableWrapping: boolean

	/**
	 * the initial width for columns, 0 or a negative number will disable this and auto column size is used on initial render
	 */
	initialColumnWidth: number

	/**
	 * true: borders are set to 0 (in css). This helps if you encounter some border color issues, false: normal borders
	 */
	disableBorders: boolean

	/**
	 * the first X columns are pinned so they will stay in view even if you scroll. This option and readOption_hasHeader are mutually exclusive
	 */
	initiallyFixedColumnsLeft: number

	/**
	 * the font size in px, 0 or -x to sync the font size with the editor, +x to overwrite the font size (changing will rerender the table)
	 */
	fontSizeInPx: number

	/**
	 * which cell should be focused or selected when a new row is inserted (above or below)
	 * focusFirstCellNewRow: focus the first cell in the new row: 
	 * keepRowKeepColumn: keep the currently selected cell
	 */
	insertRowBehavior: 'focusFirstCellNewRow' | 'keepRowKeepColumn'

	/**
	 * table should start in readonly mode?
	 * true: table is view only,
	 * false: edit mode (normal)
	 * NOTE that initial fixes (e.g. all rows should have the same length) are applied because readonly is only applied after/during the table is created
	 */
	initiallyIsInReadonlyMode: boolean
}

/* --- frontend settings --- */


type MiscOptions = {

	/**
	 * then we double click on the resize handle auto size is used...
	* if we have a large column and double click on that we want to shrink it to this value...
	* use falsy value to not change the column size
	* double click again will use auto size
	 */
	doubleClickMinColWidth: number
}

/**
 * used to update the yaml object we use to build the table (changes will be lost!!) 
 */
type YamlUpdateMessage = {
	command: 'yamlUpdate'
	yamlContent: string
}

type RequestChangeFontSiteInPxMessage = {
	command: 'changeFontSizeInPx'
	fontSizeInPx: number
}

type TriggerUndoMessage = {
	command: 'triggerUndo'
}

type TriggerRedoMessage = {
	command: 'triggerRedo'
}

type ReceivedMessageFromVsCode =  YamlUpdateMessage | RequestChangeFontSiteInPxMessage | TriggerUndoMessage | TriggerRedoMessage

/**
 * send by the webview indicating that it has rendered and the webview has set up the listener to receive content
 */
type ReadyMessage = {
	command: 'ready'
}

/**
 * msg from the webview when it finished rendering and can receive messages
 */
type DisplayMessageBoxMessage = {
	command: 'msgBox'
	type: 'info' | 'warn' | 'error'
	content: string
}

type ModifyFileMessage = {
	command: 'modify'
	changeType: string
	changeContent: string
}

type CopyToClipboardMessage = {
	command: 'copyToClipboard'
	text: string
}

type SetEditorHasChangesMessage = {
	command: 'setHasChanges'
	hasChanges: boolean
}

type PostMessage = ReadyMessage | DisplayMessageBoxMessage  | ModifyFileMessage | CopyToClipboardMessage | SetEditorHasChangesMessage

type VsState = {
	readOptionIsCollapsed: boolean
	writeOptionIsCollapsed
	previewIsCollapsed: boolean
}

type VsExtension = {
	postMessage: (message: PostMessage) => void
	setState: (newState: VsState) => void
	getState: () => VsState | undefined
}


type HandsontableMergedCells = {
	/**
	 * zero based start index
	 */
	row: number
	/**
	 * zero based start index
	 */
	col: number

	/**
	 * the length in rows to span
	 */
	rowspan: number
	/**
	 * the length in cols to span
	 */
	colspan: number
}

type StringSlice = {
	text: string
	sliceNr: number
	totalSlices: number
}

/*+
 * see https://handsontable.com/docs/6.2.2/demo-searching.html
 */
type HandsontableSearchResult = {
	/**
	 * the visual index
	 */
	row: number

	/**
	 * the physical row index (needed because the visual index depends on sorting (and maybe virtual rendering?))
	 */
	rowReal: number
		/**
	 * the visual index
	 */
	col: number

	/**
	 * the physical col index (needed because the visual index depends on sorting (and maybe virtual rendering?))
	 */
	colReal: number

	/**
	 * the cell data if any
	 * from source this is: this.hot.getDataAtCell(rowIndex, colIndex);
	 */
	data: null | undefined | string
}

type HeaderRowWithIndex = {
	/**
	 * entries can be null e.g. for new columns
	 * for null we display the column name 'column X' where X is the number of the column
	 * however, after opening the cell editor null becomes the empty string (after committing the value)...
	 * these are visual indices as we use this for rendering...
	 */
	row: Array<string | null>
/**
 * the physical row index of the header row
 * this is needed if we want to insert the header row back into the table (or remove)
 */
	physicalIndex: number
}

type MergedCellDef = {
	row: number
	col: number
	rowspan: number
	colspan: number
}

/**
 * [row, col, oldValue, newValue]
 */
type CellChanges = [number, number | string, string, string]

type Point = {
	x: number
	y: number
}

type NumbersStyle = {
	key: 'en' | 'non-en'
	regex: RegExp
	thousandSeparator: RegExp
	/**
	 * the idea is to replace the thousand separators with the empty string (we normally also allow a single whitespace as separator)... else:
	 * e.g. we have en (1.23) and a cell values is 1,2,3
	 * when we just replace the thousand separator (,) with the empty string we get 123
	 * but actually we only use the first number so we expect 1
	 * 
	 * when replacing only this regex e.g. /((\.)\d{3})+/
	 * 1.000,123 -> 1000,123
	 * 1.000 --> 1000
	 * 1.000.000 -> 1000000
	 * 1,2,3 -> 1,2,3
	 * 1,200,3 -> 1200,3 (hm... maybe this should be 2003? for now it's easier the match from left to right and replace)
	 */
	thousandSeparatorReplaceRegex: RegExp
}

type KnownNumberStylesMap = {
	['en']: NumbersStyle
	['non-en']: NumbersStyle
}
type EditHeaderCellAction = {
	actionType: 'changeHeaderCell'
	change: [0, number, string, string]
}
type RemoveColumnAction = {
	actionType: 'remove_col'
	amount: number
	index: number
	indexes: number[]
	//a table with the removed data
	data: string[][]
}

type InsertColumnAction = {
	actionType: 'insert_col'
}

/** 
* declares column metadata information 
*/
type ColumnObject = {
	name: string 
	required: boolean
	default?: string
	type: string 
	description: string
  }

type HotRegister = {
	counter: number
	bucket: {[key: string]: any}
	register: (key: string,container: HTMLElement, tableData: any[], columnOps: any[], tableColumns: any[]) => void
	getInstance: (key: string) => Handsontable | null
	removeKey: (key: string) => void
	emptyBucket: any[]
}

type InitialDataObject = {
	tableArrays: any[][]
	tableHeaders: string[]
	tableColumns: any[][]
}

type ReturnDataObject = {
	tableArrays: any[][]
}

type ReturnChangeObject = {
	tableName?: string
	tableIndex?: number 
	columnName?: string | number | any[]
	cellValue?: any[]
	oldRowIndex?: number[]
	newRowIndex?: number | number[]
	tableData?: [][]
}

type DeletedTableObject = {
	type: string
	keyIndex: number
	latestData: any[]
	undoList: any[]
	redoList: any[]
}