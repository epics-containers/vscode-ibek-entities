# vscode-tabular-yaml

This extension opens IOC yaml files into a table ui for editing, using a JSON schema for validation. Open a yaml file and click `edit yaml`, or execute the command `edit as yaml` to open editor and display data. Files are parsed using js-yaml and yawn-yaml.

Make changes in the tabular editor and they will be reflected back into the text file, and vice versa. Changes must be saved manually. Comments will not be preserved if they are inside the entities array.

## Requirements

 - The first line of the yaml file must contain the JSON schema to validate against, in the format `# yaml-language-server: $schema=<schema here>`
 - Items to be displayed in the table must be in an array called `entities`

## Features

 - Two-way data flow between file and editor
    - Note: only valid changes to yaml data will be tracked between files
 - Add and delete rows to tables
 - Undo/redo stack for each table
 - Access context menu by right-clicking on table
 - Cell validation based on type and requirement
    - Grey background cell = required cell
    - Greyed out text = default template value in empty cell
    - Red cell = validation based on type or requirement failed
 - Default template values displayed in empty cells
 - Add and delete entire tables
 - Unsaved changes indicator and notifications let you know when changes have been applied to the yaml file

## To do

 - Modify CSS and HTML for VSCode themes
 - Drag-and-swap table order
 - Improve Add Table functionality
 - Object cell type
 - Fix license and other admin etc.
 - Documentation

## Acknowledgements & Use

This extension modifies and builds from [vscode-csv-editor](https://github.com/janisdd/vscode-edit-csv) by [janisdd](https://github.com/janisdd). Additionally:
- Used [yawn-yaml](https://github.com/mohsen1/yawn-yaml) and [js-yaml](https://www.npmjs.com/package/js-yaml) for parsing/writing yaml data. 
- Used [handsontable](https://github.com/handsontable/handsontable) for tables. 
- Used [bulma](https://github.com/jgthms/bulma), [bulma-extension](https://github.com/Wikiki/bulma-extensions) and [fontawesome](https://github.com/FortAwesome/Font-Awesome) for ui. 
- Used [mousetrap](https://github.com/ccampbell/mousetrap) for shortcuts.

All other modules used, and information on specific version dependencies, can be found in package.json
