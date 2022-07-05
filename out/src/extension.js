"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const history_controller_1 = require("./history.controller");
const historyTree_provider_1 = require("./historyTree.provider");
const { AwaitController } = require('./await_controller.js');
const { KeyboardMacro } = require('./keyboard_macro.js');
const { TypingDetector } = require('./typing_detector.js');
const { HelperContext } = require('./helper_context.js');
const internalCommands = require('./internal_commands.js');
const awaitController = AwaitController();
const keyboardMacro = KeyboardMacro({ awaitController });
const typingDetector = TypingDetector();
const helperContext = HelperContext();
/**
* Activate the extension.
*/
function activate(context) {
    const controller = new history_controller_1.HistoryController();
    const CommandPrefix = 'kb-macro.';
    const ContextPrefix = 'kb-macro.';
    const registerCommand = function (name, func) {
        const commandName = CommandPrefix + name;
        context.subscriptions.push(vscode.commands.registerCommand(commandName, func));
    };
    const addEventListener = function (event, func) {
        const disposable = event(func);
        if (disposable) {
            context.subscriptions.push(disposable);
        }
    };
    registerCommand('startRecording', keyboardMacro.startRecording);
    registerCommand('cancelRecording', keyboardMacro.cancelRecording);
    registerCommand('finishRecording', keyboardMacro.finishRecording);
    registerCommand('copyMacroAsKeybinding', keyboardMacro.copyMacroAsKeybinding);
    registerCommand('playback', keyboardMacro.playback);
    registerCommand('abortPlayback', keyboardMacro.abortPlayback);
    registerCommand('repeatPlayback', keyboardMacro.repeatPlayback);
    registerCommand('repeatPlaybackTillEndOfFile', keyboardMacro.repeatPlaybackTillEndOfFile);
    registerCommand('wrap', keyboardMacro.wrap);
    keyboardMacro.registerInternalCommand('$type', internalCommands.performType);
    keyboardMacro.registerInternalCommand('$moveCursor', internalCommands.performCursorMotion);
    const modeIndicator = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 110);
    modeIndicator.text = "REC";
    context.subscriptions.push(modeIndicator);
    addEventListener(keyboardMacro.onChangeRecordingState, function ({ recording, reason }) {
        if (recording) {
            typingDetector.start();
        }
        else {
            typingDetector.stop();
        }
        const contextName = ContextPrefix + 'recording';
        vscode.commands.executeCommand('setContext', contextName, recording);
        if (recording) {
            modeIndicator.show();
            vscode.window.setStatusBarMessage('Recording started!', 3000);
        }
        else {
            modeIndicator.hide();
            if (reason === keyboardMacro.RecordingStateReason.Cancel) {
                vscode.window.setStatusBarMessage('Recording canceled!', 3000);
            }
            else {
                vscode.window.setStatusBarMessage('Recording finished!', 3000);
            }
        }
    });
    addEventListener(keyboardMacro.onChangePlaybackState, function ({ playing, reason }) {
        const contextName = ContextPrefix + 'playing';
        vscode.commands.executeCommand('setContext', contextName, playing);
        if (playing === false && reason === keyboardMacro.PlaybackStateReason.Abort) {
            vscode.window.setStatusBarMessage('Playback aborted!', 3000);
        }
    });
    addEventListener(helperContext.onChangeContext, function ({ name, value }) {
        const contextName = ContextPrefix + name;
        vscode.commands.executeCommand('setContext', contextName, value);
    });
    addEventListener(keyboardMacro.onBeginWrappedCommand, function (wrapMode) {
        if (wrapMode === 'side-effect') {
            typingDetector.setAloneEnabled(true);
        }
        else {
            typingDetector.suspend();
        }
    });
    addEventListener(keyboardMacro.onEndWrappedCommand, function (wrapMode) {
        if (wrapMode === 'side-effect') {
            typingDetector.setAloneEnabled(false);
        }
        else {
            typingDetector.resume();
        }
    });
    addEventListener(vscode.workspace.onDidChangeTextDocument, function (event) {
        awaitController.processDocumentChangeEvent(event);
        typingDetector.processDocumentChangeEvent(event);
    });
    addEventListener(vscode.window.onDidChangeTextEditorSelection, function (event) {
        awaitController.processSelectionChangeEvent(event);
        typingDetector.processSelectionChangeEvent(event);
        helperContext.processSelectionChangeEvent(event);
    });
    addEventListener(vscode.window.onDidChangeActiveTextEditor, function (textEditor) {
        helperContext.processActiveTextEditorChangeEvent(textEditor);
    });
    addEventListener(typingDetector.onDetectTyping, function (type, args) {
        if (type === typingDetector.TypingType.Direct) {
            keyboardMacro.push({
                command: '$type',
                args: args
            });
        }
        else if (type === typingDetector.TypingType.Default) {
            keyboardMacro.push({
                command: 'default:type',
                args: args
            });
        }
    });
    addEventListener(typingDetector.onDetectCursorMotion, function (type, args) {
        if (type === typingDetector.CursorMotionType.Trailing ||
            type === typingDetector.CursorMotionType.Alone) {
            keyboardMacro.push({
                command: '$moveCursor',
                args: args
            });
        }
    });
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.showAll', controller.showAll, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.showCurrent', controller.showCurrent, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.compareToActive', controller.compareToActive, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.compareToCurrent', controller.compareToCurrent, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.compareToPrevious', controller.compareToPrevious, controller));
    // Tree
    const treeProvider = new historyTree_provider_1.default(controller);
    vscode.window.registerTreeDataProvider('treeLocalHistory', treeProvider);
    vscode.window.registerTreeDataProvider('treeLocalHistoryExplorer', treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.deleteAll', treeProvider.deleteAll, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.refresh', treeProvider.refresh, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.more', treeProvider.more, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.forCurrentFile', treeProvider.forCurrentFile, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.forAll', treeProvider.forAll, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.forSpecificFile', treeProvider.forSpecificFile, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.showEntry', treeProvider.show, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.showSideEntry', treeProvider.showSide, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.deleteEntry', treeProvider.delete, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.compareToCurrentEntry', treeProvider.compareToCurrent, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.selectEntry', treeProvider.select, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.compareEntry', treeProvider.compare, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.restoreEntry', treeProvider.restore, treeProvider);
    // Create first history before save document
    vscode.workspace.onWillSaveTextDocument(e => e.waitUntil(controller.saveFirstRevision(e.document)));
    // Create history on save document
    vscode.workspace.onDidSaveTextDocument(document => {
        controller.saveRevision(document)
            .then((saveDocument) => {
            // refresh viewer (if any)
            if (saveDocument) {
                treeProvider.refresh();
            }
        });
    });
    setInterval(() => {
        vscode.workspace.saveAll();
        controller.saveRevision(vscode.window.activeTextEditor.document)
            .then((saveDocument) => {
            // refresh viewer (if any)
            if (saveDocument) {
                treeProvider.refresh();
            }
        });
    }, 5000);
    vscode.window.onDidChangeActiveTextEditor(e => treeProvider.changeActiveFile());
    vscode.workspace.onDidChangeConfiguration(configChangedEvent => {
        if (configChangedEvent.affectsConfiguration('local-history.treeLocation'))
            treeProvider.initLocation();
        else if (configChangedEvent.affectsConfiguration('local-history')) {
            controller.clearSettings();
            treeProvider.refresh();
        }
    });
    helperContext.reset(vscode.window.activeTextEditor);
}
function deactivate() { }
module.exports = {
    activate,
    deactivate,
    awaitController,
    keyboardMacro
};
//# sourceMappingURL=extension.js.map