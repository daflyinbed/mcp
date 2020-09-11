// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Commands } from "./Commands";
import { McpSCM } from "./scm";
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(...new Commands().arr);
  new McpSCM(context);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  console.log("deactivate");
}
