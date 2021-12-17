# vscode-tabular-yaml

This VSCode extension opens ibek IOC yaml files into a table ui for editing, using a JSON schema for validation. Open a yaml file and click `edit as table`, or use Ctrl+i Ctrl+t keyboard shortcut, or command palette to open editor and display data.

Make changes in the tabular editor and they will be reflected back into the text file, and vice versa. Changes must be saved manually. Comments will not be preserved if they are inside the entities array.

## TO DO
 - Get Github Actions to pass
 - ID dropdown entries
 - Modify CSS for light mode VSCode 
 - Migrate user documentation from confluence to repo (use sphinx-js?)

## Acknowledgements & Use

This extension modifies and builds from [vscode-csv-editor](https://github.com/janisdd/vscode-edit-csv) by [janisdd](https://github.com/janisdd). Additionally:
- Used [yaml](https://github.com/eemeli/yaml/) for parsing/writing yaml data. 
- Used [handsontable](https://github.com/handsontable/handsontable) for tables. 
- Used [bulma](https://github.com/jgthms/bulma), [bulma-extension](https://github.com/Wikiki/bulma-extensions) and [fontawesome](https://github.com/FortAwesome/Font-Awesome) for ui. 
- Used [mousetrap](https://github.com/ccampbell/mousetrap) for shortcuts.

All other modules used, and information on specific version dependencies, can be found in package.json
