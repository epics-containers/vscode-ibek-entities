//
// Note: This example test is leveraging the Mocha test framework.
//
//to run tests start tsc -w and then go to the debug tab and select "EXtension Tests" and run

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as vscode from 'vscode'
import * as path from "path";
const fs   = require('fs');
const YAML = require('yaml')
import { isYamlFile, returnExistingEntities, moveEntity} from '../../util';
import { validateYaml, getEditorTitle, createTableData, createColumnData, fetchSchema } from '../../extension';

// *** UNIT TESTING (VSCODE SIDE INPUT) ***

suite('initial parsing and validating tests', function () {
    test('get editor title', async function () {
        let correct: string = "YAML edit test.yaml"
        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.yaml"))
        let test: string = ""
        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            test = getEditorTitle(document)
        })
        assert.equal(test, correct)
    })

    test('confirm not yaml if no file', async function () {
        let test: boolean | "" | undefined
        const document = undefined
        test = isYamlFile(document)
        const correct = false
        assert.strictEqual(test, correct)
    })

    test('confirm yml file is yaml', async function () {
        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.yml"))
        const correct = true
        let test: boolean | "" | undefined
        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            test = isYamlFile(document)
        })
        assert.strictEqual(test, correct)
    })

    test('confirm yaml file is yaml', async function () {
        const correct = true
        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.yaml"))
        let test: boolean | "" | undefined
        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            test = isYamlFile(document)
        })
        assert.strictEqual(test, correct)
    })

    test('confirm csv file is not yaml', async function () {
        const correct = false
        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.csv"))
        let test: boolean | "" | undefined

        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            test = isYamlFile(document)
        })
        assert.strictEqual(test, correct)
    })

    test('test fetching schema (url)', async function () {
        const correct: any = JSON.parse(fs.readFileSync(path.join(__dirname, "./../../../src/test/samples/test.json"), "utf-8"))
        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.yaml"))

        let test: any
        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            test = fetchSchema(document)
        })
        assert.deepEqual(test, correct)
    })

    test('test fetching schema (filepath)', async function () {
        const correct: any = JSON.parse(fs.readFileSync(path.join(__dirname, "./../../../src/test/samples/test.json"), "utf-8"))
        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/testFileSchema.yaml"))

        let test: any
        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            test = fetchSchema(document)
        })
        assert.deepEqual(test, correct)
    })

    test('test yaml validation (for valid file)', async function () {
        const correct = true
        const schema = path.join(__dirname, "./../../../src/test/samples/test.json")
        const file = path.join(__dirname, "./../../../src/test/samples/test.yaml")
        const test = validateYaml(YAML.parse(fs.readFileSync(file, "utf-8")), JSON.parse(fs.readFileSync(schema, "utf-8")))
        assert.strictEqual(test, correct)
    })

    test('test yaml validation (for invalid file)', async function () {
        const correct = false
        const schema = path.join(__dirname, "./../../../src/test/samples/test.json")
        const file = path.join(__dirname, "./../../../src/test/samples/testInvalid.yaml")
        const test = validateYaml(YAML.parse(fs.readFileSync(file, "utf-8")), JSON.parse(fs.readFileSync(schema, "utf-8")))
        assert.strictEqual(test, correct)
    })

    test('test creating table data', async function () {
        let tableHeaders: string[] = [] 
        let tableArrays: any[][] = []

        const correctFileHeaders = path.join(__dirname, "./../../../src/test/samples/tableHeaders.txt")
        const correctHeaders = fs.readFileSync(correctFileHeaders, "utf-8")

        const correctFileData = path.join(__dirname, "./../../../src/test/samples/tableData.txt")
        const correctData = fs.readFileSync(correctFileData, "utf-8")


        const file = path.join(__dirname, "./../../../src/test/samples/test.yaml")
        createTableData(YAML.parse(fs.readFileSync(file, "utf-8")), tableHeaders, tableArrays)

        const testHeaders = JSON.stringify(tableHeaders)
        const testData = JSON.stringify(tableArrays)

        assert.equal(testHeaders, correctHeaders)
        assert.equal(testData, correctData)
    })

    test('test creating column data', async function () {
        let tableColumns: any[][] = []

        const correctFile = path.join(__dirname, "./../../../src/test/samples/tableColumns.txt")
        const correct = fs.readFileSync(correctFile, "utf-8")

        const schema = path.join(__dirname, "./../../../src/test/samples/test.json")
        createColumnData(tableColumns, JSON.parse(fs.readFileSync(schema, "utf-8")))

        const test = JSON.stringify(tableColumns)

        assert.equal(test, correct)
    })

})

// *** UNIT TESTING (VSCODE SIDE OUTPUT) ***

suite('some tests for writing changes/yaml back to file', function () {

    test('test returning existing ioc entity groups', async function () {
        const correct = [[0], [1], [2, 3]]
        let test: any[] = []

        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.yaml"))
        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            const currentYaml = YAML.parseDocument(document.getText())
            const entities = currentYaml.get("entities")

            test = returnExistingEntities(entities, "pmac.DlsPmacAsynMotor")
        })
        assert.deepEqual(test, correct)
    })

    test('test moving existing ioc entity (index 0 to 3)', async function () {
        const correctFile = path.join(__dirname, "./../../../src/test/samples/moveEntity.txt")
        const correct = fs.readFileSync(correctFile, "utf-8")
        let test: string = ""
        const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.yaml"))
        await vscode.workspace.openTextDocument(setting).then((document: vscode.TextDocument) => {
            const currentYaml = YAML.parseDocument(document.getText())
            const entities = currentYaml.get("entities")
            moveEntity(entities.items, 0, 3)
            test = JSON.stringify(entities)
        })
        assert.equal(test, correct)

    })
})

// *** UNIT TESTING (VSCODE OUTPUT WITH EXTENSION ACTIVATED) ***
// TO DO some tests here once I figure out how to activate the extension in a test
/*
suite('some tests for writing changes/yaml back to file', function () {

    //these tests are for table functions contained within applyYamlChanges
    test('test change item value on ioc entity', async function () {
        //this involves opening an editor for the file, getting current text state and YAML,
        //then calling applychange function and pretending we changed a value in the table
        //then we fetch the text of the open file again and check that it has changed?
        //and that it now is the same as the sample template
        //fairly sure this needs editor instance however....
    })

    test('test remove item value on ioc entity', async function () {

    })

    test('test adding new table row to file', async function () {

    })

    test('test removing deleted table row from file', async function () {

    })

    test('test adding new table to file)', async function () {

    })

    test('test removing deleted table from file)', async function () {

    })

    //depending on how we move row(s), method is different so need tests to test all cases
    test('test changing ioc entity order (moving row(s) up)', async function () {

    })

    test('test changing ioc entity order (moving row(s) down)', async function () {

    })

    test('test changing ioc entity order (moving row(s) down to last row)', async function () {

    })

    test('test changing ioc entity order (moving row(s) down to last table last row)', async function () {

    })
})*/

// *** SYSTEM TESTING (WEBVIEW SIDE) ***
// TO DO - fetch html, fetch html for table actions too?
suite('tests with extension activated', function () {
    const setting: vscode.Uri = vscode.Uri.parse(path.join(__dirname, "./../../../src/test/samples/test.yaml"))

    //these tests are for table functions contained within applyYamlChanges
    test('activate extension', async function () {
        let test: boolean = false
        const correct: boolean = true
        await vscode.workspace.openTextDocument(setting).then(async (document: vscode.TextDocument) => {
            await vscode.window.showTextDocument(document).then(async () => {              
                await vscode.commands.executeCommand("edit-yaml.edit").then(() => {
                    test = true
                })
            })
        })
        assert.strictEqual(test, correct)
    })
})