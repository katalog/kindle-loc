// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "kindle-loc" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json	
    var controller = new LocationController();
    context.subscriptions.push(controller);
    context.subscriptions.push(vscode.commands.registerCommand('kindle-loc.kloc', () => {
        controller.goToLocationCommand()
    }));
}

// This method is called when your extension is deactivated
export function deactivate() {}

let magicNumber = 64.955

class LocationController {
    private disposable: vscode.Disposable;
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'kindle-loc.kloc';
        this.statusBarItem.tooltip = "Go to Kindle Location";

        // subscribe to selection change and editor activation events
        let subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeTextEditorSelection(this.onEvent, this, subscriptions);
        vscode.window.onDidChangeActiveTextEditor(this.onEvent, this, subscriptions);

        // create a combined disposable from both event subscriptions
        this.disposable = vscode.Disposable.from(...subscriptions);
        this.updateLocation();
    }

    public goToLocationCommand(): void {
         // declaring manager? as optional makes .then/async blocks 'forget' the
         // definite assignment/null check inference done after create() in tslint.
        let manager: CursorManager;
        manager = CursorManager.create()!;
        if (!manager) { return; }

        vscode.window.showInputBox({
            prompt: `Type an loc number from 0 to ${(manager.maxPosition/magicNumber).toFixed(1)}.`,
            value: String((manager.cursorOffset/magicNumber).toFixed(1)),
            validateInput: (input: string) => {
                manager.previewCursorOffset(input);
                return undefined;
            }
        }).then((input?: string) => {
            input !== undefined ? manager.commit() : manager.abort();
        });
    }

    private updateLocation(): void {
        let manager = CursorManager.create();
        if (!manager) {
            this.statusBarItem.hide();
            return;
        }

        let offset = manager.cursorOffset / magicNumber;

        if (offset !== undefined) {
            // Update the status bar
            let positionName = vscode.workspace.getConfiguration('kindle-loc').positionName || 'kloc';
            this.statusBarItem.text = `${positionName} ${offset.toFixed(1)}`;
            this.statusBarItem.show();
        }
    }

    private onEvent(): void {
        this.updateLocation();
    }

    public dispose() {
        this.disposable.dispose();
        this.statusBarItem.dispose();
    }
}

class CursorManager {
    private static cursorPositionDecoration = vscode.window.createTextEditorDecorationType({
        borderColor: new vscode.ThemeColor('editor.foreground'),
        borderStyle: 'solid',
        borderWidth: '1px',
        outlineColor: new vscode.ThemeColor('editor.foreground'),
        outlineStyle: 'solid',
        outlineWidth: '1px',
    });
    // Originally preview was implemented without actually moving the cursor, but that was weird when
    // the real cursor highlight and the mimicked one were both visible.  Leaving this in just because.
    // private static CursorLineDecoration = vscode.window.createTextEditorDecorationType({
    //     backgroundColor: new vscode.ThemeColor('editor.lineHighlightBackground'),
    //     borderColor: new vscode.ThemeColor('editor.lineHighlightBorder'),
    //     borderStyle: 'solid',
    //     borderWidth: '1px',
    //     isWholeLine: true,
    // });

    public static create()
    {
        let editor = vscode.window.activeTextEditor;
        let doc = editor ? editor.document : undefined;
        if (!doc) { return undefined; }

        return new CursorManager(editor!, doc);
    }

    private readonly originalCursorOffset: number;
    private readonly cachedSelections: vscode.Selection[];

    constructor(readonly editor: vscode.TextEditor, readonly document: vscode.TextDocument) {
        this.originalCursorOffset = document.offsetAt(editor.selection.active);
        this.cachedSelections = [editor.selection]; // dup active selection for our working copy
        this.cachedSelections.push(...editor.selections);
    }

    public get cursor() : vscode.Position {
        return this.editor.selection.active;
    }
    public get cursorOffset() : number {
         return this.document.offsetAt(this.cursor);
    }
    // public get selections() : vscode.Selection[] {
    //     return this.editor.selections;
    // }
    public set selections(selections: vscode.Selection[]) {
        this.editor.selections = selections;
    }

    public get maxPosition(): number {
        return this.document.offsetAt(new vscode.Position(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
    }

    public previewCursorOffset(offset: string): boolean {
        let success = false;
        let newOffset = +offset
        newOffset = newOffset * magicNumber

        let newPosition = this.document.positionAt(newOffset);
        this.cachedSelections[0] = new vscode.Selection(newPosition, newPosition);
        this.editor.selections = this.cachedSelections;    
        success = true;
        
        const range = new vscode.Range(this.cursor, this.cursor.translate(0, 1));
        this.editor.setDecorations(CursorManager.cursorPositionDecoration, [range]);
        this.reveal();
        return success;
    }

    public commit() {
        this.clearDecorations();
        this.editor.selection = this.cachedSelections[0];
        vscode.window.showTextDocument(this.document, { selection: this.cachedSelections[0] });
    }

    public abort() {
        this.clearDecorations();
        this.cachedSelections.splice(0,1);
        this.editor.selections = this.cachedSelections;
        this.reveal();
    }

    private clearDecorations(): void {
        this.editor.setDecorations(CursorManager.cursorPositionDecoration, []);
    }

    private reveal(revealType?: vscode.TextEditorRevealType): void {
        revealType = revealType || vscode.TextEditorRevealType.InCenterIfOutsideViewport;
        this.editor.revealRange(this.editor.selection, revealType);
    }
}