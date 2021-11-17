import * as vscode from 'vscode';
import * as path from "path";
import { isYamlFile, getCurrentViewColumn, debugLog, moveEntity, returnExistingEntities} from './util';
import { createEditorHtml } from './getHtml';
import { InstanceManager, Instance, SomeInstance } from './instanceManager';
//import { InstanceManager, Instance, SomeInstance, InstanceWorkspaceSourceFile } from './instanceManager';
import { getExtensionConfiguration } from './configurationHelper';
import * as chokidar from "chokidar";
const YAML = require('yaml')
const fs   = require('fs');
const Validator = require("jsonschema").Validator;
const fetch = require('sync-fetch')


// const debounceDocumentChangeInMs = 1000

//for a full list of context keys see https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts

/**
 * for editor uris this is the scheme to use
 * so we can find editors
 */
export const editorUriScheme = 'csv-edit'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	//from https://stackoverflow.com/questions/38267360/vscode-extension-api-identify-file-or-folder-click-in-explorer-context-menu
	//to get a list of all known languages for: resourceLangId
	// vscode.languages.getLanguages().then(l => console.log('languages', l));

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	let instanceManager = new InstanceManager()

	/*
	const applyCsvCommand = vscode.commands.registerCommand('edit-yaml.apply', () => {

		const instance = getActiveEditorInstance(instanceManager)
		if (!instance) return

		const msg: RequestApplyPressMessage = {
			command: "applyPress"
		}
		instance.panel.webview.postMessage(msg)
	})

	const applyAndSaveCsvCommand = vscode.commands.registerCommand('edit-yaml.applyAndSave', () => {

		const instance = getActiveEditorInstance(instanceManager)
		if (!instance) return

		const msg: RequestApplyAndSavePressMessage = {
			command: "applyAndSavePress"
		}
		instance.panel.webview.postMessage(msg)
	})
	*/

	//called to get from an editor to the source file
	const gotoSourceCsvCommand = vscode.commands.registerCommand('edit-yaml.goto-source', () => {


		if (vscode.window.activeTextEditor) { //a web view is no text editor...
			vscode.window.showInformationMessage("Open a yaml editor first to show the source yaml file")
			return
		}

		openSourceFileFunc()
	})

	const editCsvCommand = vscode.commands.registerCommand('edit-yaml.edit', () => {

		if (!vscode.window.activeTextEditor && instanceManager.hasActiveEditorInstance()) {
			//open source file ... probably better for usability when we use recently used
			openSourceFileFunc()
			return
		}

		//vscode.window.activeTextEditor will be undefined if file is too large...
		//see https://github.com/Microsoft/vscode/blob/master/src/vs/editor/common/model/textModel.ts
		if (!vscode.window.activeTextEditor || !isYamlFile(vscode.window.activeTextEditor.document)) {
			vscode.window.showInformationMessage("Open a yaml file first to show the yaml editor")
			return
		}

		const uri = vscode.window.activeTextEditor.document.uri

		//check if we already got an editor for this file
		const oldInstance = instanceManager.findInstanceBySourceUri(uri)
		if (oldInstance) {
			//...then show the editor
			oldInstance.panel.reveal()

			//webview panel is not a document, so this does not work
			// vscode.workspace.openTextDocument(oldInstance.editorUri)
			// .then(document => {
			// 	vscode.window.showTextDocument(document)
			// })
			return
		}

		//we have no old editor -> create new one
		createNewEditorInstance(context, vscode.window.activeTextEditor, instanceManager)
	})


	const openSourceFileFunc = () => {

		let instance: Instance
		try {
			instance = instanceManager.getActiveEditorInstance()
		} catch (error) {
			if(error instanceof Error){
				vscode.window.showErrorMessage(`Could not find the source file for the editor (no instance found), error: ${error.message}`)
			}
			return
		}
		vscode.workspace.openTextDocument(instance.sourceUri)
			.then(document => {
				vscode.window.showTextDocument(document)
			})

	}

	//@ts-ignore
	// const askRefresh = function (instance: Instance) {
	// 	const options = ['Yes', 'No']
	// 	vscode.window.showInformationMessage('The source file changed or was saved. Would you like to overwrite your csv edits with the new content?',
	// 		{
	// 			modal: false,

	// 		}, ...options)
	// 		.then((picked) => {

	// 			if (!picked) return

	// 			picked = picked.toLowerCase()
	// 			if (picked === 'no') return

	// 			//update
	// 			console.log('update');

	// 			if (!vscode.window.activeTextEditor) {

	// 				vscode.workspace.openTextDocument(instance.sourceUri)
	// 					.then((document) => {

	// 						const newContent = document.getText()
	// 						instance.panel.webview.html = createEditorHtml(context, newContent)

	// 					})

	// 				return
	// 			}

	// 			const newContent = vscode.window.activeTextEditor.document.getText()

	// 			//see https://github.com/Microsoft/vscode/issues/47534
	// 			// const msg = {
	// 			// 	command: 'csvUpdate',
	// 			// 	csvContent: newContent
	// 			// }
	// 			// instance.panel.webview.postMessage(msg)

	// 			instance.panel.webview.html = createEditorHtml(context, newContent)
	// 		})
	// }

	//we could use this hook to check if the file was changed (outside of the editor) and show a message to the user
	//but we would need to distinguish our own changes from external changes...

	//this only works if the file is opened inside an editor (inside vs code) and visible (the current file)
	//not working even if the file is in the current workspace (directoy), the file must be open and visible!
	// vscode.workspace.onDidChangeTextDocument((args: vscode.TextDocumentChangeEvent) => {
	// 	//see https://github.com/Microsoft/vscode/issues/50344
	// 	//when dirty flag changes this is called
	// 	// if (args.contentChanges.length === 0) {
	// 	// 	return
	// 	// }
	// 	console.log(`onDidChangeTextDocument`, args)
	// })

	// 	if (!isCsvFile(args.document)) return //closed non-csv file ... we cannot have an editor for this document

	// 	console.log(`CHANGE ${args.document.uri.toString()}`);
	// }, debounceDocumentChangeInMs));

	//when an unnamed file is saved the new file (new uri) is opened
	//	when the extension calls save the new file is not displayed
	//	because we don't know the new uri we wait for new csv files to be opened and show them
	//TODO can be improved to not show any opened csv file (e.g. from other extensions to only write to a file)
	const onDidOpenTextDocumentHandler = vscode.workspace.onDidOpenTextDocument((args) => {

		//when we know the old uri then we could update the instance manager and the panel (e.g. title)...
		//but for now we close the editor iff we saved an untitled file

		// console.log(`onDidOpenTextDocument ${args.uri.toString()}`);

		//when we save an unnamed (temp file) file a new file with the new uri is opened and saved
		//TODO i don't think we can get the old/new name of the file os wait for 
		//so just filter for csv file and show it 
		if (args.isUntitled || isYamlFile(args) === false || args.version !== 1) return

		//this will display the new file (after unnamed was saved) but the reference is still broken...
		//also this would show almost every opened csv file (even if we don't wan to display it e.g. only for silent editing from other extensions)
		// vscode.window.showTextDocument(args.uri)
	})

	// vscode.workspace.onDidSaveTextDocument(debounce((args: vscode.TextDocument) => {
	// }, debounceDocumentChangeInMs))
	// vscode.workspace.onDidSaveTextDocument((args: vscode.TextDocument) => {
	// console.log(`onDidSaveTextDocument ${args.uri.toString()}`);
	// })


	//when an unnamed csv file is closed and we have an editor for it then close the editor
	//	this is because we currently not updating the editor (e.g. title, uris) after an unnamed file is saved
	const onDidCloseTextDocumentHandler = vscode.workspace.onDidCloseTextDocument((args) => {

		if (args.uri.scheme === editorUriScheme) return //closed an editor nothing to do here... onDispose will handle it

		// console.log(`onDidCloseTextDocument ${args.uri.toString()}`);

		if (isYamlFile(args) && args.isUntitled && args.uri.scheme === "untitled") {

			const instance = instanceManager.findInstanceBySourceUri(args.uri)

			if (!instance) return

			instance.panel.dispose()
		}
	})

	//used to track changes in text file to editor constantly
	const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
		let changes = e.contentChanges
		let message = "Changed: " + changes[0].text + "\nAt: " + changes[0].range.start.line + "." + changes[0].range.start.character + " to " + changes[0].range.end.line + "." + changes[0].range.end.character
		vscode.window.showInformationMessage(message)
		
		if(!vscode.window.activeTextEditor) return

		const uri = vscode.window.activeTextEditor.document.uri
		const instance = instanceManager.findInstanceBySourceUri(uri)
		if(!instance) return

		let data = parseYaml(e.document.getText(), instance)
		let jsonSchema = fetchSchema(instance.document)
		let parseResult = YAML.parseDocument(e.document.getText()).toJSON()
		let yamlIsValid: boolean = validateYaml(parseResult, jsonSchema)

		if(!yamlIsValid){
			vscode.window.showWarningMessage("Warning: YAML file contents are not valid against schema. This may cause errors in displaying file or tables.")
		}
		const msg: ReceivedMessageFromVsCode = {
			command: "yamlUpdate",
			yamlContent: JSON.stringify(data)
			}
			
		instance.hasChanges = false
		setEditorHasChanges(instance, false)
		instance.panel.webview.postMessage(msg)
			
	})

	//not needed because this changes only initial configuration...
	// vscode.workspace.onDidChangeConfiguration((args) => {
	// })
	const onDidChangeConfigurationCallback = onDidChangeConfiguration.bind(undefined, instanceManager)
	const onDidChangeConfigurationHandler = vscode.workspace.onDidChangeConfiguration(onDidChangeConfigurationCallback)

	context.subscriptions.push(editCsvCommand)
	context.subscriptions.push(gotoSourceCsvCommand)
	//context.subscriptions.push(applyCsvCommand)
	//context.subscriptions.push(applyAndSaveCsvCommand)
	context.subscriptions.push(onDidOpenTextDocumentHandler)
	context.subscriptions.push(onDidCloseTextDocumentHandler)
	context.subscriptions.push(onDidChangeConfigurationHandler)
	context.subscriptions.push(onDidChangeTextDocument)
}

// this method is called when your extension is deactivated
export function deactivate() { }

/**
 * called when the (extension?) config changes
 * can be called manually to force update all instances
 * @param e null to manually update all instances
 */
function onDidChangeConfiguration(instanceManager: InstanceManager, e: vscode.ConfigurationChangeEvent | null) {

	if (e === null || e.affectsConfiguration('csv-edit.fontSizeInPx')) {
		const newFontSize = getExtensionConfiguration().fontSizeInPx

		const instances = instanceManager.getAllInstances()
		for (let i = 0; i < instances.length; i++) {
			const instance = instances[i];

			instance.panel.webview.postMessage({
				command: 'changeFontSizeInPx',
				fontSizeInPx: newFontSize
			} as RequestChangeFontSiteInPxMessage)
		}
	}
}

export function getEditorTitle(document: vscode.TextDocument): string {
	return `YAML edit ${path.basename(document.fileName)}`
}

export function createNewEditorInstance(context: vscode.ExtensionContext, activeTextEditor: vscode.TextEditor, instanceManager: InstanceManager): void {

	const uri = activeTextEditor.document.uri

	const title = getEditorTitle(activeTextEditor.document)

	let panel = vscode.window.createWebviewPanel('yaml-editor', title, getCurrentViewColumn(), {
		enableFindWidget: false, //we use our own find widget...
		enableCommandUris: true,
		enableScripts: true,
		retainContextWhenHidden: true
	})

	//check if the file is in the current workspace
	let isInCurrentWorkspace = activeTextEditor.document.uri.fsPath !== vscode.workspace.asRelativePath(activeTextEditor.document.uri.fsPath)

	const config = getExtensionConfiguration()

	//a file watcher works when the file is in the current workspace (folder) even if it's not opened
	//it also works when we open any file (not in the workspace) and 
	//	we edit the file inside vs code
	//	we edit outside vs code but the file is visible in vs code (active)
	//it does NOT work when the file is not in the workspace and we edit the file outside of vs code and the file is not visible in vs code (active)
	// const watcher = vscode.workspace.createFileSystemWatcher(activeTextEditor.document.fileName, true, false, true)

	let instance: SomeInstance

	// NOTE that watching new files (untitled) is not supported by this is probably no issue...

	if (isInCurrentWorkspace) {

		let watcher: vscode.FileSystemWatcher | null = null

		if (config.shouldWatchCsvSourceFile) {
			//if the file is in the current workspace we the file model in vs code is always synced so is this (faster reads/cached)
			watcher = vscode.workspace.createFileSystemWatcher(activeTextEditor.document.fileName, true, false, true)

			//not needed because on apply changes we create a new file if this is needed
			watcher.onDidChange((e) => {
				if (instance.ignoreNextChangeEvent) {
					instance.ignoreNextChangeEvent = false
					debugLog(`source file changed: ${e.fsPath}, ignored`)
					return
				}

				debugLog(`source file changed: ${e.fsPath}`)
				onSourceFileChanged(e.fsPath, instance)
			})
		}

		instance = {
			kind: 'workspaceFile',
			panel: null as any,
			sourceUri: uri,
			editorUri: uri.with({
				scheme: editorUriScheme
			}),
			hasChanges: false,
			originalTitle: title,
			sourceFileWatcher: watcher,
			document: activeTextEditor.document,
			supportsAutoReload: true,
			ignoreNextChangeEvent: false,
		}

	} else {

		let watcher: chokidar.FSWatcher | null = null

		if (config.shouldWatchCsvSourceFile) {
			//the problem with this is that it is faster than the file model (in vs code) can sync the file...
			watcher = chokidar.watch(activeTextEditor.document.fileName)

			watcher.on('change', (path) => {

				if (instance.ignoreNextChangeEvent) {
					instance.ignoreNextChangeEvent = false
					debugLog(`source file (external) changed: ${path}, ignored`)
					return
				}
				debugLog(`source file (external) changed: ${path}`)
				onSourceFileChanged(path, instance)
			})
		}

		instance = {
			kind: 'externalFile',
			panel: null as any,
			sourceUri: uri,
			editorUri: uri.with({
				scheme: editorUriScheme
			}),
			hasChanges: false,
			originalTitle: title,
			sourceFileWatcher: watcher,
			document: activeTextEditor.document,
			supportsAutoReload: false,
			ignoreNextChangeEvent: false,
		}
	}

	try {
		instanceManager.addInstance(instance)
	} catch (error) {
		if(error instanceof Error){
			vscode.window.showErrorMessage(`Could not create an editor instance, error: ${error.message}`)
		}

		if (instance.kind === 'workspaceFile') {
			instance.sourceFileWatcher?.dispose()
		} else {
			instance.sourceFileWatcher?.close()
		}

		return
	}


	//just set the panel if we added the instance
	instance.panel = panel


	panel.webview.onDidReceiveMessage((message: PostMessage) => {

		switch (message.command) {

			case 'ready': {

				debugLog('received ready from webview')
				let data = parseYaml(activeTextEditor.document.getText(), instance)

				instance.hasChanges = false
				setEditorHasChanges(instance, false)

				let funcSendContent = (initialText: string) => {
					//new yaml data message, sends data as json string
					const msg: ReceivedMessageFromVsCode = {
						command: "yamlUpdate",
						yamlContent: JSON.stringify(data)
						}
					panel.webview.postMessage(msg)
				}

				if (isInCurrentWorkspace === false) {
					//slow path
					//external files are normally not synced so better read the file...

					// vscode.workspace.fs.readFile(instance.sourceUri)
					// 	.then(content => {

					// 		console.log(`encoding`)
					// 		//TODO get encoding????
					// 		//see https://github.com/microsoft/vscode/issues/824
					// const text = Buffer.from(content).toString('utf-8')
					// 		funcSendContent(text)

					// 	}, error => {
					// 		vscode.window.showErrorMessage(`could not read the source file, error: ${error?.message}`);
					// 	})

					//TODO
					//THIS might not get the up-to-date state of the file on the disk
					//but vs code api cannot get the file encoding (so that we could use vscode.workspace.fs.readFile)
					//or allow us to force to updat the memory model in vs code of the file...

					//see https://github.com/microsoft/vscode/issues/824
					//see https://github.com/microsoft/vscode/issues/3025

					//in case we closed the file (we have an old view/model of the file) open it again
					vscode.workspace.openTextDocument(instance.sourceUri)
						.then(
							document => {
								funcSendContent(activeTextEditor.document.uri.fsPath)
							}, error => {
								vscode.window.showErrorMessage(`could not read the source file, error: ${error?.message}`);
							}
						)

				} else if (activeTextEditor.document.isClosed) {
					//slow path
					//not synchronized anymore...
					//we need to get the real file content from disk
					vscode.workspace.openTextDocument(instance.sourceUri)
						.then(
							document => {
								funcSendContent(activeTextEditor.document.uri.fsPath)
							}, error => {
								vscode.window.showErrorMessage(`could not read the source file, error: ${error?.message}`);
							}
						)

				} else {
					//fast path
					//file is still open and synchronized
					//let initialText = activeTextEditor.document.getText()
					funcSendContent(activeTextEditor.document.uri.fsPath)
				}

				debugLog('finished sending csv content to webview')

				break
			}
			case "msgBox": {

				if (message.type === 'info') {
					vscode.window.showInformationMessage(message.content)

				} else if (message.type === 'warn') {
					vscode.window.showWarningMessage(message.content)

				} else if (message.type === 'error') {
					vscode.window.showErrorMessage(message.content)

				} else {
					const _msg = `unknown show message box type: ${message.type}, message: ${message.content}`
					console.error(_msg)
					vscode.window.showErrorMessage(_msg);
				}
				break
			}
			
			case "modify": {
				const { changeType, changeContent } = message
				let changeObject: ReturnChangeObject = JSON.parse(changeContent)
				applyYamlChanges(instance, changeType, changeObject, config.openSourceFileAfterApply)
				break
			}

			case "copyToClipboard": {
				vscode.env.clipboard.writeText(message.text)
				break
			}

			case "setHasChanges": {
				instance.hasChanges = message.hasChanges
				setEditorHasChanges(instance, message.hasChanges)
				break
			}

			default: notExhaustive(message, `Received unknown post message from extension: ${JSON.stringify(message)}`)
		}

	}, undefined, context.subscriptions)

	panel.onDidDispose(() => {

		debugLog(`dispose csv editor panel (webview)`)

		try {
			instanceManager.removeInstance(instance)
		} catch (error) {
			if(error instanceof Error){
				vscode.window.showErrorMessage(`Could not destroy an editor instance, error: ${error.message}`);
			}
		}

		try {

			if (instance.kind === 'workspaceFile') {
				instance.sourceFileWatcher?.dispose()
			} else {
				instance.sourceFileWatcher?.close()
			}
		} catch (error) {
			if(error instanceof Error){
				vscode.window.showErrorMessage(`Could not dispose source file watcher for file ${instance.document.uri.fsPath}, error: ${error.message}`);
			}
		}

	}, null, context.subscriptions)

	panel.webview.html = createEditorHtml(panel.webview, context, {
		isWatchingSourceFile: instance.supportsAutoReload
	})



}

function _afterEditsApplied(instance: Instance, document: vscode.TextDocument, editsApplied: boolean, saveSourceFile: boolean, openSourceFileAfterApply: boolean) {

	const afterShowDocument = () => {
		if (!editsApplied) {
			console.warn(`Edits could not be applied`)
			vscode.window.showErrorMessage(`Edits could not be applied`)
			return
		}

		if (saveSourceFile) {
			instance.ignoreNextChangeEvent = true
			document.save()
				.then(
					wasSaved => {
						if (!wasSaved) {
							console.warn(`Could not save csv file`)
							vscode.window.showErrorMessage(`Could not save csv file`)
							return
						}

						setEditorHasChanges(instance, false)
					},
					(reason) => {
						console.warn(`Error saving csv file`)
						console.warn(reason); //will be null e.g. no permission denied when saved manually
						vscode.window.showErrorMessage(`Error saving csv file`)
					})
			return
		}

		setEditorHasChanges(instance, false)
	}

	//also works for unnamed files... they will not be displayed after save
	if (openSourceFileAfterApply) {
		vscode.window.showTextDocument(document)
			.then(() => {
				afterShowDocument()
			})
	}
	else {
		afterShowDocument()
	}

}

/**
 * maps changes to ast and writes applied ast to file
 */

function applyYamlChanges(instance: Instance, changeType: string, changeObject: ReturnChangeObject, openSourceFileAfterApply: boolean) {
	vscode.workspace.openTextDocument(instance.sourceUri)
		.then(document => {
			//fetch current (and possibly unsaved) content of file
			let currentYaml = YAML.parseDocument(document.getText())
			let entities = currentYaml.get("entities")

			let fileIndexes: number[] = returnExistingEntities(entities, changeObject.tableName)
			switch (changeType) {
				case "valueChange":
					if(!Array.isArray(changeObject.cellValue)) break
					//iterate over all cells with changes
					changeObject.cellValue.forEach((cell: any, i: number) => {
						if(!changeObject.oldRowIndex) return
						let changedEntityIndex: number = fileIndexes[changeObject.oldRowIndex[i]]
						let entity = entities.items[changedEntityIndex]

						if(!Array.isArray(changeObject.columnName)) return
						//this checks if new value is null if so deletes item?
						if(cell === null){
							entity.delete(changeObject.columnName[i])
						}
						else{
							entity.set(changeObject.columnName[i], cell)
						}
					});
					break

				case "addRow":
					let newEntityIndex: number = 0
					if(Array.isArray(changeObject.newRowIndex)) break
					if(changeObject.newRowIndex! >= fileIndexes.length){
						//this means we are adding an item to the end of the array
						newEntityIndex = fileIndexes[changeObject.newRowIndex!-1] + 1
					}
					else if(changeObject.newRowIndex === 0){
						//this means a new row was added at the beginning of the table
						newEntityIndex = fileIndexes[0]
					}
					else{
						newEntityIndex = fileIndexes[changeObject.newRowIndex!]
					}

					const newNode = currentYaml.createNode(changeObject.tableData)
					newNode.set("type", changeObject.tableName)
					entities.add(newNode)
					moveEntity(entities.items, entities.items.length-1, newEntityIndex)
					break

				case "deleteRow":
					if(!changeObject.oldRowIndex) break
					let oldEntityIndex: number = fileIndexes[changeObject.oldRowIndex[0]!]
					delete entities.items[oldEntityIndex]
					break

				case "moveRow":
					if(!changeObject.oldRowIndex) break
					if(Array.isArray(changeObject.newRowIndex)) break
					//row(s) moved down
					if(changeObject.newRowIndex! > changeObject.oldRowIndex[changeObject.oldRowIndex.length -1]){
						//this means we want to move rows to last position
						if(changeObject.newRowIndex! >= fileIndexes.length){
							changeObject.newRowIndex!--
							let movedEntityIndex: number = fileIndexes[changeObject.newRowIndex!]
							//the rows we are moving are going to the very end of the file
							if(fileIndexes[fileIndexes.length-1] === entities.items.length-1){
								changeObject.oldRowIndex.forEach(movedRow => {
									const movedNode = entities.items[fileIndexes[movedRow]]
									entities.add(movedNode)
									delete entities.items[fileIndexes[movedRow]]
								});
							}
							//rows are moving internally
							else {
								changeObject.oldRowIndex[0]++
								changeObject.oldRowIndex.forEach(movedRow => {
									movedRow--
									moveEntity(entities.items, fileIndexes[movedRow], movedEntityIndex)
								});
							}
							break
							
						}
						//rows are moving internally not to last row position
						else{
							changeObject.newRowIndex!--
							changeObject.oldRowIndex[0]++
							let movedEntityIndex: number = fileIndexes[changeObject.newRowIndex!]
							changeObject.oldRowIndex.forEach(movedRow => {
								movedRow--
								moveEntity(entities.items, fileIndexes[movedRow], movedEntityIndex)
							});
							break
						}
					}
					//row(s) moved up
					else if(changeObject.newRowIndex! < changeObject.oldRowIndex[changeObject.oldRowIndex.length -1]){
						changeObject.oldRowIndex[changeObject.oldRowIndex.length -1]-- //TO DO there must be a better method than this?
						let movedEntityIndex: number = fileIndexes[changeObject.newRowIndex!]
						changeObject.oldRowIndex.reverse().forEach(movedRow => {
							movedRow++
							moveEntity(entities.items, fileIndexes[movedRow], movedEntityIndex)
						});
					}

					break

				case "addTable":
					if(changeObject.tableData){
						changeObject.tableData.forEach((tableRow) => {
							const newNode = currentYaml.createNode(tableRow)
							entities.add(newNode)
						})
					}
					break

				case "deleteTable":
					fileIndexes.forEach((entityIndex) => {
						delete entities.items[entityIndex]
					})
					break

			}

			let yamlString = currentYaml.toString()
			let yamlData = currentYaml.toJSON()

			//validate new yaml file content against schema
			const jsonSchema = fetchSchema(instance.document)
			let yamlIsValid: boolean = validateYaml(yamlData, jsonSchema)
			if(!yamlIsValid){
				vscode.window.showWarningMessage("Warning: YAML file contents are not valid against schema. This may cause errors in displaying file or tables.")
			}

			const edit = new vscode.WorkspaceEdit()

			var firstLine = document.lineAt(0);
			var lastLine = document.lineAt(document.lineCount - 1);
			var textRange = new vscode.Range(0,
				firstLine.range.start.character,
				document.lineCount - 1,
				lastLine.range.end.character);

			//don't apply if the content didn't change
			// TO DO - won't work for yaml
			if (document.getText() === yamlString) {
				debugLog(`content didn't change`)
				return
			}

			edit.replace(document.uri, textRange, yamlString)
			vscode.workspace.applyEdit(edit)
				.then(
					editsApplied => {
						_afterEditsApplied(instance, document, editsApplied, false, openSourceFileAfterApply)
					},
					(reason) => {
						console.warn(`Error applying edits`)
						console.warn(reason)
						vscode.window.showErrorMessage(`Error applying edits`)
					})
			
		},
			(reason) => {

				//maybe the source file was deleted...
				//see https://github.com/microsoft/vscode-extension-samples/pull/195/files

				console.warn(`Could not find the source file, trying to access it and create a temp file with the same path...`)
				console.warn(reason)

				vscode.workspace.fs.stat(instance.sourceUri).
					then(fileStat => {
						//file exists and can be accessed
						vscode.window.showErrorMessage(`Could apply changed because the source file could not be found`)

					}, error => {

						//file is probably deleted
						vscode.window.showWarningMessage(`The source file could not be found and was probably deleted.`)
						//createNewSourceFile(instance, yamlString, openSourceFileAfterApply, false)
					})

			})
}

/**
 * tries to create a new tmp file (untitled:URI.fsPath) so that the user can decide to save or discard it
 * @param instance 
 * @param newContent 
 * @param openSourceFileAfterApply 
 */
/*
function createNewSourceFile(instance: Instance, newContent: string, openSourceFileAfterApply: boolean, saveSourceFile: boolean) {

	//TODO i'm not sure if this also works for remote file systems...
	//see https://stackoverflow.com/questions/41068197/vscode-create-unsaved-file-and-add-content
	const newSourceFile = vscode.Uri.parse(`untitled:${instance.sourceUri.fsPath}`)

	vscode.workspace.openTextDocument(newSourceFile)
		.then(newFile => {

			const edit = new vscode.WorkspaceEdit()
			edit.insert(newSourceFile, new vscode.Position(0, 0), newContent)

			vscode.workspace.applyEdit(edit).then(success => {

				if (!success) {
					debugLog('could not created new source file because old was deleted')
					return
				}

				debugLog('created new source file because old was deleted')

				if (openSourceFileAfterApply) {
					vscode.window.showTextDocument(newFile)
				}

				if (saveSourceFile) {
					newFile.save().then(successSave => {

						if (!successSave) {
							vscode.window.showErrorMessage(`Could not save new source file (old was deleted)`)
							return
						}

						//successfully saved

					}, error => {
						vscode.window.showErrorMessage(`Could not save new source file (old was deleted), error: ${error?.message}`)
					})
				}


			}, error => {
				vscode.window.showErrorMessage(`Could not create new source file (old was deleted), error: ${error?.message}`)
			})

		}, error => {
			vscode.window.showErrorMessage(`Could not open new source file, error: ${error?.message}`)
		})

}*/


/**
 * returns the active (editor) instance or null
 * error messages are already handled here
 * @param instanceManager 
 */
export function getActiveEditorInstance(instanceManager: InstanceManager): Instance | null {

	if (vscode.window.activeTextEditor) { //a web view is no text editor...
		vscode.window.showInformationMessage("Open a yaml editor first to apply changes")
		return null
	}

	let instance: Instance
	try {
		instance = instanceManager.getActiveEditorInstance()
	} catch (error) {
		if(error instanceof Error){
			vscode.window.showErrorMessage(`Could not find the editor instance, error: ${error.message}`)
		}
		return null
	}

	return instance
}

export function notExhaustive(x: never, message: string): never {
	vscode.window.showErrorMessage(message);
	throw new Error(message)
}

export function setEditorHasChanges(instance: Instance, hasChanges: boolean) {
	instance.panel.title = `${hasChanges ? '* ' : ''}${instance.originalTitle}`
}

export function onSourceFileChanged(path: string, instance: Instance) {

	if (!instance.supportsAutoReload) {
		vscode.window.showWarningMessage(`The csv source file '${instance.document.fileName}' changed and it is not in the current workspace. Thus the content could not be automatically reloaded. Please open/display the file in vs code and switch back the to table. Then you need to manually reload the table with the reload button. Alternatively just close the table and reopen it.`, {
			modal: false,

		})
		return
	}

	const msg: SourceFileChangedMessage = {
		command: 'sourceFileChanged'
	}
	instance.panel.webview.postMessage(msg)
}


// class CsvEditStateSerializer  implements vscode.WebviewPanelSerializer{

// 	static state: VsState = {
// 		previewIsCollapsed: true,
// 		readOptionIsCollapsed: true,
// 		writeOptionIsCollapsed: true
// 	}

// 	async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: VsState) {
// 		// `state` is the state persisted using `setState` inside the webview
// 		console.log(`Got state: ${state}`);
// 		CsvEditStateSerializer.state = state
// 	}
// }


/** 
* parse yaml file into javascript object and validate it using json schema
* @param {string} content 
* @returns {[string[], string[][], string[]]| null} [0] comments before, [1] csv data, [2] comments after
*/

export function parseYaml(yamlString: string, instance: Instance){
	let jsonSchema = fetchSchema(instance.document)
	let tableHeaders: string[] = [] //array of header titles
	let tablesArray: any[][] = [] //array of each data array for every table
	let tableColumns: any[][] = [] //array of arrays of object, where each array of objects is one set of columns
	let parseResult: any
	try {
		parseResult = YAML.parse(yamlString)
		let yamlIsValid: boolean = validateYaml(parseResult, jsonSchema)
		if (!yamlIsValid){
			vscode.window.showWarningMessage("Warning: YAML content could not be validated against schema.This may result in error displaying tables.")
		}
		createTableData(parseResult, tableHeaders, tablesArray) 
		createColumnData(tableColumns, jsonSchema)
	}catch (e) {
		console.log(e); //TO DO: do something if error loading file
	}
	return {
		 tablesArray, tableHeaders, tableColumns
	}
}

/**
 * check if yaml file specifies schema in first-line comment
 * if it does, check it exists and fetch it
 * @param instance
 */
export function fetchSchema(document: vscode.TextDocument){
	let jsonSchema: any
	if(document){
		let firstLine: string = document.lineAt(0).text
		//checks if first line is schema in comment
		if(firstLine.indexOf("# yaml-language-server: $schema=") !== -1){
			let schemaPath: string = firstLine.split('=')[1]
			if(schemaPath.includes("http")){
				//checks url and fetches
				try{
					jsonSchema = fetch(schemaPath).json()
				}
				catch(e){
					vscode.window.showErrorMessage("Error: "+e)
					return
				}
			}
			else if(fs.existsSync(schemaPath)){
				//checks valid filepath and loads
				jsonSchema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
			}

			if (jsonSchema){
				return jsonSchema
			}
			else{
				//TO DO - need proper exception handling?
				vscode.window.showErrorMessage("Could not fetch JSON schema to validate YAML file. Please check that the path to the schema is correct.")
			}
		}
		else{
			//if yaml file doesn't link to a schema:
			vscode.window.showWarningMessage("Please specify a JSON schema to validate by in the YAML file. This should be the first line of the file, in the format:\n"+
			"'# yaml-language-server: $schema=<json schema here>'")
		}
	}
	else{
		//TO DO - Better error handling?
		vscode.window.showErrorMessage("No active text document open.")
	}
}

/*
* using json-schema, validate the yaml file against the given json schema
*/

export function validateYaml(parsedYaml: any, schema: any){
	const validator = new Validator();
	if(parsedYaml && schema){
  		const validation = validator.validate(parsedYaml, schema);
  		if (validation.errors.length) {
			return false
  		}
  		else {
			return true
		}
	}
	else{
		vscode.window.showErrorMessage("Error validating YAML against schema.")
		return false
	}

}

/**
 * extract the relevant table data from the yaml object and return as arrays
 * iterates over all entities and their key value pairs
 * @param parseResult 
 * @param tableHeaders 
 * @param tablesArray 
 */
export function createTableData(parseResult: any, tableHeaders: string[], tablesArray: any[][]){
    for (let entity in parseResult.entities){
      let dataArray = [] //data array for each table
        for (let key in parseResult.entities[entity]){
            //takes first "type" value and adds to array of headers
            if (key === "type"){
				let _tempObject: {} = parseResult.entities[entity]
              	if (tableHeaders.indexOf(parseResult.entities[entity][key]) > -1){
                	let index = tableHeaders.indexOf(parseResult.entities[entity][key]) 
                	dataArray.push(_tempObject)
					tablesArray[index].push(_tempObject)
              	}
              	else {
                	tableHeaders.push(parseResult.entities[entity][key])
                	dataArray.push(_tempObject)
					tablesArray.push(dataArray)
              	}
            }
        } 
	}
};

/** 
 * extracts the relevant column data from the supplied json schema and return as array of objects
*/
export function createColumnData(tableColumns: any[][], jsonSchema: any){
	var iocEntities: any[] = []
	iocEntities = jsonSchema.properties.entities.items.anyOf
	for (let tableObj of iocEntities){
	  var columns: any[] = []
	  //creates object for each column in this table instance
	  for (let colObj of Object.keys(tableObj.properties)){
		if (tableObj.required.includes(colObj)){
		  var requirement = true
		}
		else{
		  requirement = false
		};
		let _col: ColumnObject = {
			name: colObj,
			required: requirement,
			default: tableObj.properties[colObj].default,
			type: tableObj.properties[colObj].type,
			description: tableObj.properties[colObj].description
			};
		columns.push(_col)
	  }
	  tableColumns.push(columns)
	};
  
};
