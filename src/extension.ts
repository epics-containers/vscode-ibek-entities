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

	//called to get from an editor to the source file
	const gotoSourceYamlCommand = vscode.commands.registerCommand('edit-yaml.goto-source', () => {


		if (vscode.window.activeTextEditor) { //a web view is no text editor...
			vscode.window.showInformationMessage("Open a yaml editor first to show the source yaml file")
			return
		}

		openSourceFileFunc()
	})

	const editYamlCommand = vscode.commands.registerCommand('edit-yaml.edit', () => {

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

	//when an unnamed file is saved the new file (new uri) is opened
	//	when the extension calls save the new file is not displayed
	//	because we don't know the new uri we wait for new yaml files to be opened and show them
	//TODO can be improved to not show any opened yaml file (e.g. from other extensions to only write to a file)
	const onDidOpenTextDocumentHandler = vscode.workspace.onDidOpenTextDocument((args) => {

		//when we know the old uri then we could update the instance manager and the panel (e.g. title)...
		//but for now we close the editor iff we saved an untitled file

		// console.log(`onDidOpenTextDocument ${args.uri.toString()}`);

		//when we save an unnamed (temp file) file a new file with the new uri is opened and saved
		//TODO i don't think we can get the old/new name of the file os wait for 
		//so just filter for csv file and show it 
		if (args.isUntitled || isYamlFile(args) === false || args.version !== 1) return
	})


	//when an unnamed yaml file is closed and we have an editor for it then close the editor
	//	this is because we currently not updating the editor (e.g. title, uris) after an unnamed file is saved
	const onDidCloseTextDocumentHandler = vscode.workspace.onDidCloseTextDocument((args) => {

		if (args.uri.scheme === editorUriScheme) return //closed an editor nothing to do here... onDispose will handle it

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

	const onDidChangeConfigurationCallback = onDidChangeConfiguration.bind(undefined, instanceManager)
	const onDidChangeConfigurationHandler = vscode.workspace.onDidChangeConfiguration(onDidChangeConfigurationCallback)

	context.subscriptions.push(editYamlCommand)
	context.subscriptions.push(gotoSourceYamlCommand)
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

	panel.onDidChangeViewState(({ webviewPanel }) => {
		if (!webviewPanel.visible || !webviewPanel.active) {
			undoCommand.dispose();
			redoCommand.dispose();
			saveCommand.dispose();
		} else {
			registerCommands();
		}
	});

	//register our custom undo/redo/save commands for triggering inside webview
	let undoCommand: vscode.Disposable;
	let redoCommand: vscode.Disposable;
	let saveCommand: vscode.Disposable;
	const registerCommands = () => {
		undoCommand = vscode.commands.registerCommand('undo', async (args: any) => {
			const msg: ReceivedMessageFromVsCode = {
				command: "triggerUndo",
				}
			panel.webview.postMessage(msg)
			return vscode.commands.executeCommand('default:undo', args);
		});

		redoCommand = vscode.commands.registerCommand('redo', async (args) => {
			const msg: ReceivedMessageFromVsCode = {
				command: "triggerRedo",
				}
			panel.webview.postMessage(msg)
			return vscode.commands.executeCommand('default:redo', args);
		});

		saveCommand = vscode.commands.registerCommand('workbench.action.files.save', async (args: any) => {
			vscode.workspace.openTextDocument(instance.sourceUri)
				.then(document => {
					document.save()
			})
			return
		});

	};
	registerCommands();


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

		debugLog(`dispose yaml editor panel (webview)`)

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
							console.warn(`Could not save yaml file`)
							vscode.window.showErrorMessage(`Could not save yaml file`)
							return
						}

						setEditorHasChanges(instance, false)
					},
					(reason) => {
						console.warn(`Error saving yaml file`)
						console.warn(reason); //will be null e.g. no permission denied when saved manually
						vscode.window.showErrorMessage(`Error saving yaml file`)
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
 * Called when a change is made in the table. Maps the change to the file YAML AST
 * and then overwrites the entire file content with the newly changed AST content.
 * @param changeType the name of the change
 * @param changeObject object containing details of the change made
 */

function applyYamlChanges(instance: Instance, changeType: string, changeObject: ReturnChangeObject, openSourceFileAfterApply: boolean) {
	let newContent: string = ""
	vscode.workspace.openTextDocument(instance.sourceUri)
		.then(document => {
			let saveSourceFile: boolean = false

			//fetch current (and possibly unsaved) content of file
			let currentYaml = YAML.parseDocument(document.getText())
			let entities = currentYaml.get("entities")

			//let fileIndexes: number[] = returnExistingEntities(entities, changeObject.tableName)
			let fileIndexes: any[] = returnExistingEntities(entities, changeObject.tableName)
			const tableGroup = fileIndexes[changeObject.tableIndex!] //fetch the indexes of entities involved in current change
			switch (changeType) {
				case "valueChange":
					if(!Array.isArray(changeObject.cellValue)) break
					//iterate over all cells with changes
					changeObject.cellValue.forEach((cell: any, i: number) => {
						if(!changeObject.oldRowIndex) return
						let changedEntityIndex: number = tableGroup[changeObject.oldRowIndex[i]]
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
					if(changeObject.newRowIndex! >= tableGroup.length){
						//this means we are adding an item to the end of the array
						newEntityIndex = tableGroup[changeObject.newRowIndex!-1] + 1
					}
					else if(changeObject.newRowIndex === 0){
						//this means a new row was added at the beginning of the table
						newEntityIndex = tableGroup[0]
					}
					else{
						newEntityIndex = tableGroup[changeObject.newRowIndex!]
					}

					const newNode = currentYaml.createNode(changeObject.tableData)
					newNode.set("type", changeObject.tableName)
					newNode.items.forEach((item: any, idx: number) => {
						if (item.key.value === "type"){
							let _moveType = newNode.items[idx]
							newNode.items.splice(idx, 1)
							newNode.items.unshift(_moveType)
							return
						}
					});
					entities.add(newNode)
					moveEntity(entities.items, entities.items.length-1, newEntityIndex)
					break

				case "deleteRow":
					if(!changeObject.oldRowIndex) break
					let oldEntityIndex: number = tableGroup[changeObject.oldRowIndex[0]!]
					delete entities.items[oldEntityIndex]
					break

				case "moveRow":
					if(!changeObject.oldRowIndex) break
					if(Array.isArray(changeObject.newRowIndex)) break
					//row(s) moved down
					if(changeObject.newRowIndex! > changeObject.oldRowIndex[changeObject.oldRowIndex.length -1]){
						//this means we want to move rows to last position
						if(changeObject.newRowIndex! >= tableGroup.length){
							changeObject.newRowIndex!--
							let movedEntityIndex: number = tableGroup[changeObject.newRowIndex!]
							//the rows we are moving are going to the very end of the file
							if(tableGroup[tableGroup.length-1] === entities.items.length-1){
								changeObject.oldRowIndex.forEach(movedRow => {
									const movedNode = entities.items[tableGroup[movedRow]]
									entities.add(movedNode)
									delete entities.items[tableGroup[movedRow]]
								});
							}
							//rows are moving internally
							else {
								changeObject.oldRowIndex[0]++
								changeObject.oldRowIndex.forEach(movedRow => {
									movedRow--
									moveEntity(entities.items, tableGroup[movedRow], movedEntityIndex)
								});
							}
							break
							
						}
						//rows are moving internally not to last row position
						else{
							changeObject.newRowIndex!--
							changeObject.oldRowIndex[0]++
							let movedEntityIndex: number = tableGroup[changeObject.newRowIndex!]
							changeObject.oldRowIndex.forEach(movedRow => {
								movedRow--
								moveEntity(entities.items, tableGroup[movedRow], movedEntityIndex)
							});
							break
						}
					}
					//row(s) moved up
					else if(changeObject.newRowIndex! < changeObject.oldRowIndex[changeObject.oldRowIndex.length -1]){
						changeObject.oldRowIndex[changeObject.oldRowIndex.length -1]-- //TO DO there must be a better method than this?
						let movedEntityIndex: number = tableGroup[changeObject.newRowIndex!]
						changeObject.oldRowIndex.reverse().forEach(movedRow => {
							movedRow++
							moveEntity(entities.items, tableGroup[movedRow], movedEntityIndex)
						});
					}

					break

				case "addTable":
					let iterIndex = 0 
					if(changeObject.tableData){
						changeObject.tableData.forEach((tableRow) => {
							const newNode = currentYaml.createNode(tableRow)
							//ensures type is first item in entity
							newNode.items.forEach((item: any, idx: number) => {
								if (item.key.value === "type"){
									let _moveType = newNode.items[idx]
									newNode.items.splice(idx, 1)
									newNode.items.unshift(_moveType)
									return
								}
							});
							entities.add(newNode)
							if(changeObject.tableIndex !== fileIndexes.length){
								//This means table NOT added to end of document so need to move
								moveEntity(entities.items, entities.items.length - 1, fileIndexes[changeObject.tableIndex!][iterIndex])
								iterIndex++
							}
						})
					}
					break

				case "deleteTable":
					tableGroup.reverse() //delete entities in reverse order to preserve index
					tableGroup.forEach((entityIndex: number) => {
						delete entities.items[entityIndex]
					})
					break

				case "saveChanges":
					saveSourceFile = true
					_afterEditsApplied(instance, document, true, saveSourceFile, openSourceFileAfterApply)
					break

			}

			let yamlString = currentYaml.toString()
			newContent = yamlString
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
						_afterEditsApplied(instance, document, editsApplied, saveSourceFile, openSourceFileAfterApply)
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
						createNewSourceFile(instance, newContent, openSourceFileAfterApply, false)
					})

			})
}

/**
 * tries to create a new tmp file (untitled:URI.fsPath) so that the user can decide to save or discard it
 * @param instance 
 * @param newContent 
 * @param openSourceFileAfterApply 
 */
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

}


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

/** 
* parse yaml file into javascript object and validate it using json schema
* @param {string} yamlString stringified content of the selected yaml file 
* @returns {[any[][], string[], any[][]]} [0] array of each table's data, 
* [1] header (entity type) of each table [2] column names and metadata for each table
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
 * Fetches the JSON schema associated with the yaml file from the first line
 * comment. Fetches from URL or filepath.
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

/**
 * Validates contents of the yaml file against JSON schema.
 * @param parsedYaml 
 * @param schema 
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
 * Extracts items from the "entities" array of the yaml file and formats
 * them by type grouping into data sets for Handsontable to process
 * @param parseResult the parsed yaml file
 * @param tableHeaders array containing the "type" of each entity group
 * @param tablesArray array containing each tables dataset
 */
export function createTableData(parseResult: any, tableHeaders: string[], tablesArray: any[][]){
    for (let entity in parseResult.entities){
      let dataArray = [] //data array for each table
        for (let key in parseResult.entities[entity]){
            //takes first "type" value and adds to array of headers
            if (key === "type"){
				let _tempObject: {} = parseResult.entities[entity]
				let length = tableHeaders.length
				//if this is first array
				if (tableHeaders.length === 0){
					tableHeaders.push(parseResult.entities[entity][key])
                	dataArray.push(_tempObject)
					tablesArray.push(dataArray)
				}
				//check if current entity group matches current entity
				else if(tableHeaders[length-1] === parseResult.entities[entity][key]){
					//yes does match so we want to append this entity to current tables
					tablesArray[length-1].push(_tempObject)
				}
				else{
					//no, so we want to make a new array and tableheaders
					tableHeaders.push(parseResult.entities[entity][key])
                	dataArray.push(_tempObject)
					tablesArray.push(dataArray)
				}
            }
        } 
	}
};

/** 
 * Extracts data from JSON schema for columns, including name and metadat
 * (such as default value, requirement etc), and puts into a format for Handsontable 
 * to utilise
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
