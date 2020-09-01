import {
  commands,
  env,
  Uri,
  workspace,
  TextDocumentContentProvider,
} from "vscode";
import axios from "axios";
import { Change } from "./treeViewProviders/rc";
import { getSource } from "./mw/Page";
import { getSites, SiteConf } from "./conf";
const historyProvider = new (class implements TextDocumentContentProvider {
  async provideTextDocumentContent(uri: Uri): Promise<string> {
    const site = getSites().find((v: SiteConf) => {
      return v.site === uri.path;
    });
    if (!site) {
      console.error("site conf not found: ", uri.toString());
      return "";
    }
    return getSource(site!.index, uri.query, undefined, uri.fragment);
  }
})();
export class Commands {
  constructor() {
    commands.registerCommand("ewiv.diff_in_browser", this.diffInBrowser);
    commands.registerCommand("ewiv.diff_source", this.diffSource);
  }
  private diffInBrowser(node: Change): void {
    env.openExternal(
      Uri.parse(
        `${node.index}?title=${node.data.title}&action=historysubmit&type=revision&diff=${node.data.revID}&oldid=${node.data.oldRevID}`
      )
    );
  }
  private async diffSource(node: Change): Promise<void> {
    const makeUri = (id: number): Uri => {
      workspace.registerTextDocumentContentProvider("ewiv", historyProvider);
      return Uri.parse(`ewiv:${node.siteName}?${node.data.title}#${id}`);
    };
    commands.executeCommand(
      "vscode.diff",
      makeUri(node.data.oldRevID),
      makeUri(node.data.revID)
    );
  }
}
