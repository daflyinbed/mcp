import {
  commands,
  env,
  Uri,
  workspace,
  TextDocumentContentProvider,
  Disposable,
  window,
} from "vscode";
import { EwivFS } from "./fsProvider";
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return getSource(site!.index, uri.query, undefined, uri.fragment);
  }
})();
export class Commands {
  arr: Disposable[] = [];
  fsInitialized = false;
  ewivFS: EwivFS;
  constructor() {
    this.ewivFS = new EwivFS();
    this.arr = [
      workspace.registerFileSystemProvider("ewivFS", this.ewivFS, {
        isCaseSensitive: true,
      }),
      commands.registerCommand("ewiv.diff_in_browser", this.diffInBrowser),
      commands.registerCommand("ewiv.diff_source", this.diffSource),
      commands.registerCommand("ewiv.open_source", this.openSource, this),
    ];
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
  private async openSource(
    siteName: string,
    index: string,
    pageID?: string,
    title?: string,
    oldID?: string
  ): Promise<void> {
    if (!siteName) {
      const sites = getSites();
      const temp = await window.showQuickPick(sites.map((v) => v.site));
      if (temp) {
        siteName = temp;
        index = sites.find((v) => v.site === temp)!.index;
      } else {
        return;
      }
    }
    if (!this.ewivFS) {
      commands.executeCommand("ewiv.init_fs");
    }
    if (!pageID && !title) {
      const temp = await window.showInputBox({
        placeHolder: "input page name",
      });
      if (temp) {
        title = temp;
      } else {
        return;
      }
    }
    let createPage = false;
    let source = "";
    const uri = Uri.parse(`ewivFS:/${siteName}/${title}?${oldID || ""}`);
    if (!this.ewivFS?.has(uri)) {
      if (!pageID && !title) {
        createPage = true;
        source = "";
      } else {
        source = await getSource(index, title, pageID, oldID);
      }
      this.ewivFS?.createFile(uri, Buffer.from(source));
    }
    commands.executeCommand("vscode.open", uri);
  }
}
