/// <reference path="findWidget.ts" />


const defaultInitialVars: InitialVars = {
	isWatchingSourceFile: false
}

declare var acquireVsCodeApi: any
declare var initialContent: string
declare var initialConfig: YamlEditSettings | undefined
declare var initialData: InitialDataObject

declare var initialVars: InitialVars

let vscode: VsExtension | undefined = undefined

if (typeof acquireVsCodeApi !== 'undefined') {
	vscode = acquireVsCodeApi()
}

if (typeof initialConfig === 'undefined') {
	// tslint:disable-next-line:no-duplicate-variable
	var initialConfig = undefined as YamlEditSettings | undefined
	// tslint:disable-next-line:no-duplicate-variable
	var initialVars = {
		...defaultInitialVars
	}
}

//const csv: typeof import('papaparse') = (window as any).Papa
//handsontable instance
let hot: import('../thirdParty/handsontable/handsontable') | null

//add toFormat to big numbers
//@ts-ignore
toFormat(Big)

/**
 * sets up an empty global undo stack for all tables
 */
let undoStack: any[] = []
/**
 * sets up an empty global redo stack for all tables
 */
let redoStack: any[] = []

/**
 * used to differentiate between row actions called by user or undo/redo
 */
let isUndoRedo: boolean = false

/**
 * used to override hot table undo keyboard shortcut
 */
let lastKey = 0

/**
 * used to differentiate between row creation called by ui or called by 
 * undoing a row removal action
 */
let undoneRemoveRowAction: boolean = false

/**
 * Buffer array to store changes implemented during
 * setTimeout timer
 */
let changeBuffer: any[] = []

/**
 * Buffer array to store type of changes implemented during
 * setTimeout timer
 */
let changeTypeBuffer: string[] = []

/**
 * Keeps track of ongoing setTimeout timers. Keyed
 * by string
 */
let changeTimers: Map<string, any> = new Map(); 

/**
 * the default csv content to used if we get empty content
 * handson table will throw if we pass in a 1D array because it expects an object?
 */
const defaultCsvContentIfEmpty = `,\n,`

/**
 * TODO check
 * stores the header row after initial parse...
 * if we have header rows in data (checked) we set this to the header row
 * if we uncheck header row read option then we use this to insert the header row again as data row
 * can be null if we have 0 rows
 * {string[] | null}
 */
let headerRowWithIndex: HeaderRowWithIndex | null = null
let lastClickedHeaderCellTh: Element | null = null
let editHeaderCellTextInputEl: HTMLInputElement | null = null
let editHeaderCellTextInputLeftOffsetInPx: number = 0
let handsontableOverlayScrollLeft: number = 0
let _onTableScrollThrottled: ((this: HTMLDivElement, e: Event) => void) | null = null

let hiddenPhysicalRowIndices: number[] = []


type HeaderRowWithIndexUndoStackItem = {
	action: 'added' | 'removed'
	visualIndex: number
	headerData: Array<string | null>
}
let headerRowWithIndexUndoStack: Array<HeaderRowWithIndexUndoStackItem> = []
let headerRowWithIndexRedoStack: Array<HeaderRowWithIndexUndoStackItem> = []


//will be set when we read the csv content
let newLineFromInput = '\n'

//we need to store this because for collapsed columns we need to change the selection
//and we need to know if we we need to change the column or not
let lastHandsonMoveWas: 'tab' | 'enter' | null = null

/**
 * true: cell content is wrapped and the row height is changed,
 * false: no wrapping (content is hidden)
 */
let enableWrapping: boolean = true

/**
 * true: borders are set to 0 (in css). This helps if you encounter some border color issues,
 * false: normal borders
 */
let disableBorders: boolean = false

/**
 * fixes the first X columns so they will stay in view even if you scroll
 */
let fixedColumnsLeft: number = 0

/**
 * true: we started with has header option enabled which caused an event
 *   because we change the table when removing the header row from the table body we need to clear the undo...
 * false: nothing to do
 */
let isFirstHasHeaderChangedEvent = true
/**
 * the initial width for columns, 0 or a negative number will disable this and auto column size is used on initial render
 */
let initialColumnWidth: number = 0

/**
 * this is only needed if we want to display header rows but we have only 1 row...
 * handsontable always needs at least one row so we cannot remove the first row and use it as header
 * so we store here that we want to set the first row as header row immediately after we have at least 2 rows
 * true: use the first row as header row immediately after we have at least 2 rows
 * false: do not use the first row as header (also false we have toggle has header option and have >= 2 rows)
 */
let shouldApplyHasHeaderAfterRowsAdded = false

/**
 * table is editable or not, also disables some related ui, e.g. buttons
 * set via {@link CsvEditSettings.initiallyIsInReadonlyMode}
 */
let isReadonlyMode = false

/**
 * stores the widths of the handsontable columns
 * THIS is always synced with the ui
 * it allows us to modify the widths better e.g. restore widths...
 * 
 * uses visual column indices!
 * 
 * inspired by https://github.com/YaroslavOvdii/fliplet-widget-data-source/blob/master/js/spreadsheet.js (also see https://github.com/Fliplet/fliplet-widget-data-source/pull/81/files)
 */
let allColWidths: number[][] = []
//afterRender is called directly after we render the table but we might want to apply old col widths here
let isInitialHotRender = true

const csvEditorWrapper = _getById('csv-editor-wrapper')
const csvEditorDiv = _getById('csv-editor')
const askCreateTableModalDiv = _getById('ask-create-table-modal')

const receivedProgBar = _getById('received-prog-bar') as HTMLProgressElement
const receivedProgBarWrapper = _getById('received-prog-bar-wrapper') as HTMLDivElement
const statusInfo = _getById('status-info') as HTMLSpanElement

const fixedColumnsTopInfoSpan = _getById('fixed-columns-top-info') as HTMLDivElement
const fixedColumnsTopIcon = _getById('fixed-columns-icon') as HTMLSpanElement
const fixedColumnsTopText = _getById('fixed-columns-text') as HTMLSpanElement

//add this to the first wrong column
const warningTooltipTextWhenCommentRowNotFirstCellIsUsed = `Please use only the first cell in comment row (others are not exported)`




//--- find widget controls

const findWidgetInstance = new FindWidget()

//setupSideBarResizeHandle()


/* main */

//set defaults when we are in browser

if (typeof initialContent === 'undefined') {
	// tslint:disable-next-line:no-duplicate-variable
	var initialContent = ''
}

if (initialContent === undefined) {
	initialContent = ''
}

// initialContent = `123,wet
// 4,5`

// initialContent =
// 	`
// #test , wer
// # wetwet
// 1,2,3
// 4,5,6,7,8
// 4,5,6,7,8

// `

if (!vscode) {
	console.log("initialConfig: ", initialConfig)
	console.log("initialContent: " + initialContent)
}

//set values from extension config
setupAndApplyInitialConfigPart1(initialConfig, initialVars)

setupGlobalShortcutsInVs()

//see readDataAgain
if (typeof initialData === 'undefined') {
	var initialData = {
		tableArrays: [[]] as any[][],
		tableHeaders: [""],
		tableColumns: [[]] as any [][]
	}
}

if (initialData === undefined) {
	var initialData = {
		tableArrays: [[]] as any[][],
		tableHeaders: [""],
		tableColumns: [[]] as any[][]
	}
}
let _data = initialData


//when we get data from vs code we receive it via messages
if (_data && !vscode) {

	let _exampleData: string[][] = []
	let initialRows = 5
	let initialCols = 5

	_exampleData = [...Array(initialRows).keys()].map(p =>
		[...Array(initialCols).keys()].map(k => '')
	)

	//@ts-ignore
	// _exampleData = Handsontable.helper.createSpreadsheetData(100, 20)
	// _exampleData = Handsontable.helper.createSpreadsheetData(1000, 20)
	// _exampleData = Handsontable.helper.createSpreadsheetData(10000, 21)
	// _exampleData = Handsontable.helper.createSpreadsheetData(100000, 20)

	_data = {
		tableColumns: [['A', 'B', 'C', 'D', 'E']],
		tableArrays: _exampleData,
		tableHeaders: ["Table 1"]
	}
	displayYamlData(_data.tableArrays, _data.tableHeaders, _data.tableColumns)
}



if (vscode) {

	receivedProgBarWrapper.style.display = "block"

	window.addEventListener('message', (e) => {
		handleVsCodeMessage(e)
	})
	_postReadyMessage()
	// console.log(JSON.stringify(vscode.getState()))
}


//-------------------------------------------------- global shortcuts 
//only in vs code not in browser

//register this before handsontable so we can first apply our actions
function setupGlobalShortcutsInVs() {
	Mousetrap.bindGlobal(['ctrl+u'], (e) => {
		insertRowBelow()
	})
	Mousetrap.bindGlobal(['ctrl+i'], (e) => {
		insertRowAbove()
	})

	Mousetrap.bindGlobal(['ctrl+l'], (e) => {
		hot = getSelectedHot()
		if(!hot) return
		let selection = hot.getSelected()
		fillAndIncrementCells(hot, selection)
	})

	Mousetrap.bindGlobal(['ctrl+d'], (e) => {
		hot = getSelectedHot()
		if(!hot) return
		let selection = hot.getSelected()
		clearCells(hot, selection)
	})

	//---- some shortcuts are also in ui.ts where the handsontable instance is created...
	//needed for core handsontable shortcuts e.g. that involve arrow keys


}
