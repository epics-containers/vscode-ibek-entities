import * as vscode from 'vscode';
import * as path from 'path';
import { getExtensionConfiguration } from './configurationHelper';

/**
 * returns a local file path relative to the extension root dir
 * @param filePath 
 */
export function getResourcePath(webview: vscode.Webview, context: vscode.ExtensionContext, filePath: string): string {
	//fix for windows because there path.join will use \ as separator and when we inline this string in html/js
	//we get specials strings e.g. c:\n
	// return `vscode-resource:${path.join(context.extensionPath, filePath).replace(/\\/g, '/')}`
	return `${webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, filePath).replace(/\\/g, '/')))}`
}

/**
 * creates the html for the csv editor
 * 
 * this is copied from csvEditorHtml/index.html
 * @param context 
 */
export function createEditorHtml(webview: vscode.Webview, context: vscode.ExtensionContext, initialVars: InitialVars): string {

	const _getResourcePath = getResourcePath.bind(undefined, webview, context)

	let handsontableCss = _getResourcePath('thirdParty/handsontable/handsontable.min.css')
	// let handsontableCss = _getResourcePath('thirdParty/handsontable/handsontable.css')
	let handsontableJs = _getResourcePath('thirdParty/handsontable/handsontable.min.js')
	// let handsontableJs = _getResourcePath('thirdParty/handsontable/handsontable.js')
	let papaparseJs = _getResourcePath('thirdParty/papaparse/papaparse.min.js')
	// let papaparseJs = _getResourcePath('thirdParty/papaparse/papaparse.js')

	const mousetrapJs = _getResourcePath('thirdParty/mousetrap/mousetrap.min.js')
	const mousetrapBindGlobalJs = _getResourcePath('thirdParty/mousetrap/plugins/global-bind/mousetrap-global-bind.min.js')

	const bigJs = _getResourcePath('thirdParty/big.js/big.min.js')
	const bigJsToFormat = _getResourcePath('thirdParty/toFormat/toFormat.min.js')

	let fontAwesomeCss = _getResourcePath('thirdParty/fortawesome/fontawesome-free/css/all.min.css')
	//we need to load the font manually because the url() seems to not work properly with vscode-resource
	const iconFont = _getResourcePath('thirdParty/fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2')
	let bulmaCss = _getResourcePath('thirdParty/bulma/bulma.min.css')

	const mainCss = _getResourcePath('csvEditorHtml/main.css')
	const darkThemeCss = _getResourcePath('csvEditorHtml/dark.css')
	const lightThemeCss = _getResourcePath('csvEditorHtml/light.css')
	const hightContrastThemeCss = _getResourcePath('csvEditorHtml/high_contrast.css')
	const settingsOverwriteCss = _getResourcePath('csvEditorHtml/settingsOverwrite.css')

	//scripts
	const progressJs = _getResourcePath('csvEditorHtml/out/progressbar.js')
	const findWidgetJs = _getResourcePath('csvEditorHtml/out/findWidget.js')
	const ioJs = _getResourcePath('csvEditorHtml/out/io.js')
	const uiJs = _getResourcePath('csvEditorHtml/out/ui.js')
	const utilJs = _getResourcePath('csvEditorHtml/out/util.js')
	const mainJs = _getResourcePath('csvEditorHtml/out/main.js')

	const beforeDomLoadedJs = _getResourcePath('csvEditorHtml/out/beforeDomLoaded.js')

	const config = getExtensionConfiguration()

	//use blocks so vs code adds folding

	let findWidgetHtml = ``
	{
		findWidgetHtml = `
		<div id="find-widget" class="find-widget" style="display: none; right: 100px;">

		<div id="find-widget-progress-bar" class="progress-bar"></div>

		<div class="gripper" onmousedown="findWidgetInstance.onFindWidgetGripperMouseDown(event)">
			<i class="fas fa-grip-vertical"></i>
		</div>

		<div class="search-input-wrapper">
			<input id="find-widget-input" placeholder="Find..." class="input" title="Enter to start search" />

			<div id="find-widget-error-message" class="error-message">
			</div>
		</div>

		<div class="info">
			<span id="find-widget-start-search" class="clickable" style="margin-right: 7px;" onclick="findWidgetInstance.refreshCurrentSearch()"
				title="Start search (Enter)">
				<i class="fas fa-search"></i>
			</span>
			<span id="find-widget-info">0/0</span>
			<span id="find-widget-cancel-search" title="Cancel search (Escape)" class="clickable" onclick="findWidgetInstance.onCancelSearch()" style="display: none;">
				<i class="fas fa-hand-paper"></i>
			</span>
			<span id="find-widget-outdated-search" class="outdated-search clickable" style="display: none;" onclick="findWidgetInstance.refreshCurrentSearch()"
				title="The table has changed, thus the search is outdated. Click to refresh the search.">
				<i class="fas fa-exclamation-triangle"></i>
			</span>
		</div>

		<div class="divider"></div>
		
		<!-- search options -->
		<div class="flexed">
			<div id="find-window-option-match-case" class="btn option" onclick="findWidgetInstance.toggleFindWindowOptionMatchCase()" title="Match Case">
				<span>Aa</span>
			</div>

			<div id="find-window-option-whole-cell" class="btn option" onclick="findWidgetInstance.toggleFindWindowOptionWholeCell()" title="Match Whole Cell Value">
				<span style="text-decoration: underline overline;">Abl</span>
			</div>

			<div id="find-window-option-whole-cell-trimmed" class="btn option" onclick="findWidgetInstance.toggleFindWindowOptionMatchTrimmedCell()" title="Trims the cell value before comparing">
				<span style="text-decoration: underline;">_A_</span>
			</div>

			<div id="find-window-option-regex" class="btn option" onclick="findWidgetInstance.toggleFindWindowOptionRegex()" title="Use Regular Expression">
				<span>
					<i class="fas fa-square-full" style="font-size: 5px;"></i>
					<i class="fas fa-asterisk" style="vertical-align: top; font-size: 8px; margin-top: 3px;"></i>
				</span>
			</div>
		</div>

		<div class="divider"></div>

		<!-- search navigation buttons-->
		<div class="flexed" style="margin-right: 5px;">
			<div id="find-widget-previous" class="btn" onclick="findWidgetInstance.gotoPreviousFindMatch()" title="Previous match (⇧F3)">
				<i class="fas fa-chevron-up"></i>
			</div>
	
			<div id="find-widget-next" class=" btn" onclick="findWidgetInstance.gotoNextFindMatch()" title="Next match (F3)">
				<i class="fas fa-chevron-down"></i>
			</div>
	
			<div class="btn" onclick="findWidgetInstance.showOrHideWidget(false)" title="Close (Escape)">
					<i class="fas fa-times"></i>
			</div>
		</div>

	</div>
		`
	}

	let bodyPageHtml = ``
	 {
		bodyPageHtml= `
		<div class="page full-h">

			<div class="all-options">

				<table>
					<thead>
						<tr>
							<th style="width: 100%;">
								<div class="options-title">

										<span class="mar-left-half clickable" onclick="forceResizeColumns()" style="margin-left: 0.5em;"
											title="Resizes all column widths to match their content">
											<i id="force-column-resize-icon" class="fas fa-arrows-alt-h"></i>
										</span>

										<span id="reload-file" class="clickable" onclick="preReloadFileFromDisk()" style="margin-left: 2em;"
											title="Reload the csv file content (from disk)">
											<i class="fas fa-sync-alt"></i>
										</span>
										<!-- fixed columns left -->
										<div class="flexed changeable-indicator" style="margin-left: 1em;">
											<div>
												<span id="fixed-columns-icon" class="clickable" title="Set fixed columns left" onclick="_toggleFixedColumnsText()">
													<i class="fas fa-align-left"></i>
												</span>
												<span id="fixed-columns-text" style="margin-left: 0.5rem;" class="dis-hidden">fixed columns:</span>
											</div>
											<div id="fixed-columns-top-info" class="text" style="margin-left: 0.5rem;">0</div>
											<div class="changeable" style="margin-left: 0.5rem;">
												<span class="clickable" onclick="incFixedColsLeft()"><i class="fas fa-chevron-up"></i></span>
												<span class="clickable" onclick="decFixedColsLeft()"><i class="fas fa-chevron-down"></i></span>
											</div>
										</div>
								</div>
							</th>
						</tr>
					</thead>
					
				</table>

			</div>

			<div class="table-action-buttons">

				<div class="separated-btns">
					
					<button id="add-row-btn" class="button is-outlined on-readonly-disable-btn" onclick="addRow()">
						<span class="icon is-small">
							<i class="fas fa-plus"></i>
						</span>
						<span>Add row</span>
					</button>
					<div class="row-col-insert-btns">
						<button class="button is-outlined on-readonly-disable-btn" onclick="insertRowAbove()" title="Insert row above current row [ctrl+shift+alt+up, ctrl+shift+ins]">
							<i class="fas fas fa-caret-up "></i>
						</button>
						<button class="button is-outlined on-readonly-disable-btn" onclick="insertRowBelow() " title="Insert row below current row [ctrl+shift+alt+down, ctrl+ins]">
							<i class="fas fa-caret-down ad"></i>
						</button>
					</div>

					<button id="add-col-btn" class="button is-outlined on-readonly-disable-btn" onclick="addColumn()">
						<span class="icon is-small">
							<i class="fas fa-plus"></i>
						</span>
						<span>Add column</span>
					</button>
					<div class="row-col-insert-btns">
						<button class="button is-outlined on-readonly-disable-btn" onclick="insertColLeft()" title="Insert column left to current column [ctrl+shift+alt+left]">
							<i class="fas fas fa-caret-left"></i>
						</button>
						<button class="button is-outlined on-readonly-disable-btn" onclick="insertColRight()" title="Insert column right to current column [ctrl+shift+alt+right]">
							<i class="fas fa-caret-right"></i>
						</button>
					</div>

					<button style="margin-right: 1em" class="button is-outlined on-readonly-disable-btn" onclick="addTable()">
						<span class="icon is-small">
							<i class="fas fa-plus"></i>
						</span>
						<span>Add table</span>
						<span class="tooltip mar-left-half is-tooltip-multiline is-tooltip-left"
							data-tooltip="Creates and appends a new empty table to the end of the set.">
							<i class="fas fa-question-circle"></i>
						</span>
					</button>

					<div id="status-info-wrapper">
						<div>
							<span id="status-info"></span>
						</div>
					</div>			

				</div>
				<div id="received-csv-prog-bar-wrapper">
					<progress id="received-csv-prog-bar" class="progress is-info" value="50" max="100"></progress>
				</div>
			</div>


			<!-- main editor/grid area -->
			<div class="side-paneled">
				
				<!-- main editor/grid area -->
				<div id="csv-editor-wrapper" class="csv-editor-wrapper">
					<div id="csv-editor">No data received</div>
				</div>

			</div>

		</div>
		`
	 }

	let helpModalHtml = ``
	{
		helpModalHtml = `
		<div id="help-modal" class="modal">
		<div class="modal-background" onclick="toggleHelpModal(false)"></div>
		<div class="modal-content">
			<div class="box">

				<h3 class="title is-3">Features/Shortcuts</h3>
				<div class="content">
					<ul>
						<li>Undo/Redo</li>
						<li>Click on column header text to sort</li>
						<li>Click left next to the row/column header text to select then drag to rearrange</li>
						<li>Resize row/column</li>
						<li>
							<div class="keys">Home</div> to move to the first cell in a row
						</li>
						<li>
							<div class="keys">End</div> to move to the last cell in a row
						</li>

						<li>
							<div class="keys">Ctrl</div>+<div class="keys">Home</div> to move to the first cell in a column
						</li>
						<li>
							<div class="keys">Ctrl</div>+<div class="keys">End</div> to move to the last cell in a column
						</li>
						<li>
							<div class="keys">Esc</div> to cancel editing and close cell editor
						</li>
						<li>
							<div class="keys">Ctrl</div>+<div class="keys">Enter</div> to add a line break in a cell
						</li>

						<li>To delete a row/column hover over it and click the trash-icon</li>

						<li>Double click on a column resize handle to fit content, double click on an auto sized column to set width
							to
							200px (good for very wide columns)</li>

					</ul>

					For a full list of shortcuts see <a target="_blank"
						href="https://handsontable.com/docs/6.2.2/tutorial-keyboard-navigation.html">https://handsontable.com/docs/6.2.2/tutorial-keyboard-navigation.html</a>
				</div>

				<h3 class="title is-3">Hints</h3>
				<div class="content">
					<ul>
					<!-- turns out handsontable checks if the values are isNaN and if both are numbers they are parsed as floats and compared as floats ... so comparing numbers or text should be fine here -->
						<li>Sorting is not automatically updated after data has changed</li>
						<li>Sorting state is exported</li>
						<li>You can use ctrl/cmd click on a column header to sort by multiple columns</li>
						<li>The unsaved changes indicator is display on any change (never cleared until you apply the changes, even if you revert manually)</li>
						<li>When you see the unsaved changes indicator right after the table was loaded then some rows were expanded (to ensure all rows have the same length)</li>
						<li>You can right-click on the table to get a context menu</li>
						<li>Hidden rows are also exported</li>
						<li>Comment rows will export only the first cell/column. If you use a cell other than the first for comments the cell color will indicate this. </li>
						<li>If you edit an unnamed (csv) file and close it then the editor will be closed too (unsaved changes will
							be lost)!</li>
						<li>Copy & Past use tab (<div class="keys">⇥</div>) as separator (same as excel)</li>
						<li>You cannot change the new line character (because vs code automatically converts it to the file setting
							i think)
						</li>
						<li>If a row has more cell than the others empty cells are added to match the row with the highest cell
							count</li>
						<li>Extension configuration is only applied for new editors</li>
						<li>You can delete multiple rows/cols by selecting them via shift and right click then remove</li>
					</ul>
				</div>


			</div>
		</div>
		<button class="modal-close is-large" aria-label="close" onclick="toggleHelpModal(false)"></button>
	</div>
		`
	}
	
	
	let askReadAgainModalHtml = ``
	{
		askReadAgainModalHtml = `
		<div id="ask-read-again-modal" class="modal modal-centered">
		<div class="modal-background"></div>
		<div class="modal-content">
			<div class="box">
				<h3 class="title is-3">Reset data and apply read options</h3>

				<p>
					Are you sure you want to overwrite the table with the initial content of the file? <br />
					This will use the initial data (when you opened the csv editor) and discard all changes applied to the table! <br />
					Note that this will not reread or reload the csv file content (a snapshot of the file was stored in memory when you opened the csv editor)!
				</p>

				<div style="margin-top: 1em">
					<button class="button is-warning" onclick="resetDataFromResetDialog()">
						<span>Reset</span>
					</button>

					<button style="margin-left: 0.5em" class="button is-outlined" onclick="toggleAskReadAgainModal(false)">
						<span>Cancel</span>
					</button>
				</div>

			</div>
		</div>
		<button class="modal-close is-large" aria-label="close" onclick="toggleAskReadAgainModal(false)"></button>
	</div>
	`
	}

	let askReloadFileModalHtml = ``
	{
		askReloadFileModalHtml =`
		<div id="ask-reload-file-modal" class="modal modal-centered">
		<div class="modal-background"></div>
		<div class="modal-content">
			<div class="box">
				<h3 class="title is-3">Reload file content and discard changes</h3>

				<p>
					Are you sure you want to read the source file again? <br />
					All changes to the table will be discarded! <br />
					<br />
					<i>This will also update the snapshot of the file that is used for the reset data feature.</i>
				</p>

				<div style="margin-top: 1em">
					<button class="button is-warning" onclick="reloadFileFromDisk()">
						<span>Reload</span>
					</button>

					<button style="margin-left: 0.5em" class="button is-outlined" onclick="toggleAskReloadFileModalDiv(false)">
						<span>Cancel</span>
					</button>
				</div>

			</div>
		</div>
		<button class="modal-close is-large" aria-label="close" onclick="toggleAskReloadFileModalDiv(false)"></button>
	</div>
		`
	}

	let askDeleteTableModalHtml = ``
	{
		askDeleteTableModalHtml =`
		<div id="ask-delete-table-modal" class="modal modal-centered">
		<div class="modal-background"></div>
		<div class="modal-content">
			<div class="box">
				<h3 class="title is-3">Delete table</h3>

				<p>
					Are you sure you want to delete this table? <br />
					All data and changes will be lost. This cannot be undone! <br />
					<br />
				</p>

				<div style="margin-top: 1em">
					<button class="button is-warning" onclick="removeTable()">
						<span>Delete</span>
					</button>

					<button style="margin-left: 0.5em" class="button is-outlined" onclick="toggleAskDeleteTableModalDiv(false)">
						<span>Cancel</span>
					</button>
				</div>

			</div>
		</div>
		<button class="modal-close is-large" aria-label="close" onclick="toggleAskDeleteTableModalDiv(false)"></button>
	</div>
		`
	}

	let sourceFileChangedModalHtml = ``
	{
		sourceFileChangedModalHtml = `
		<div id="source-file-changed-modal" class="modal modal-centered">
		<div class="modal-background"></div>
		<div class="modal-content">
			<div class="box">
				<h3 class="title is-3">Source file changed</h3>

				<p>
					The source file changed, thus the tabel is not up-to-date. <br />
					You can reload the file content which will discard all changes to the table! <br /><br />
					Or you can ignore the changes. <br />
					<br />
					<i>This will also update the snapshot of the file that is used for the reset data feature.</i>
				</p>

				<div style="margin-top: 1em">
					<button class="button is-warning" onclick="reloadFileFromDisk()">
						<span>Reload</span>
					</button>

					<button style="margin-left: 0.5em" class="button is-outlined" onclick="toggleSourceFileChangedModalDiv(false)">
						<span>Ignore</span>
					</button>
				</div>

			</div>
		</div>
		<button class="modal-close is-large" aria-label="close" onclick="toggleSourceFileChangedModalDiv(false)"></button>
	</div>
		`
	}

	return `
	<!DOCTYPE html>
	<html>
	<head>
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">

		<style>
			@font-face {
				font-family: 'Font Awesome 5 Free';
				font-weight: 900;
				src: url("${iconFont}") format("woff2");
			}
		</style>

		<link rel="stylesheet" href="${handsontableCss}">

		<link rel="stylesheet" href="${fontAwesomeCss}">

		<link rel="stylesheet" href="${bulmaCss}">
		<link rel="stylesheet" href="${mainCss}">
		<link rel="stylesheet" href="${darkThemeCss}">
		<link rel="stylesheet" href="${lightThemeCss}">
		<link rel="stylesheet" href="${hightContrastThemeCss}">
		<link rel="stylesheet" href="${settingsOverwriteCss}">
	</head>
	<body class="vs-code vs-code-settings-font-size">
	<script>
		var initialConfig = ${JSON.stringify(config)};
		var initialVars = ${JSON.stringify(initialVars)};
		</script>
		<script src="${beforeDomLoadedJs}"></script>
	
	${findWidgetHtml}

	${bodyPageHtml}

	${helpModalHtml}

	${askReadAgainModalHtml}

	${askReloadFileModalHtml}

	${askDeleteTableModalHtml}

	${sourceFileChangedModalHtml}


	<script src="${handsontableJs}"></script>
	<script src="${papaparseJs}"></script>
	<script src="${mousetrapJs}"></script>
	<script src="${mousetrapBindGlobalJs}"></script>
	<script src="${bigJs}"></script>
	<script src="${bigJsToFormat}"></script>

	<script src="${progressJs}"></script>
	<script src="${findWidgetJs}"></script>
	<script src="${ioJs}"></script>
	<script src="${utilJs}"></script>
	<script src="${uiJs}"></script>
	<script src="${mainJs}"></script>

	</body>
</html>`
}