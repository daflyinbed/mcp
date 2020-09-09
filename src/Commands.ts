import {
  commands,
  env,
  Uri,
  workspace,
  TextDocumentContentProvider,
  Disposable,
  window,
  TextEditor,
} from "vscode";
import { EwivFS } from "./fsProvider";
import { ChangeItem, RcDataProvider, Site } from "./treeViewProviders/rc";
import { HistoryProvider } from "./treeViewProviders/pageHistory";
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
    return (await getSource(site!.api, undefined, undefined, uri.fragment))
      .content;
  }
})();
export class Commands {
  arr: Disposable[] = [];
  fsInitialized = false;
  ewivFS: EwivFS;
  constructor() {
    this.ewivFS = new EwivFS();
    const rcTreeProvider = new RcDataProvider();
    const historyTreeProvider = new HistoryProvider();
    window.onDidChangeActiveTextEditor((e: TextEditor | undefined) => {
      if (e?.document.uri.scheme === "ewivFS") {
        historyTreeProvider.refresh();
      }
    });
    this.arr = [
      workspace.registerFileSystemProvider("ewivFS", this.ewivFS, {
        isCaseSensitive: true,
      }),
      window.registerTreeDataProvider("mwRecentChange", rcTreeProvider),
      window.registerTreeDataProvider("mwPageRevisions", historyTreeProvider),
      commands.registerCommand("ewiv.diff_in_browser", this.diffInBrowser),
      commands.registerCommand("ewiv.diff_source", this.diffSource, this),
      commands.registerCommand("ewiv.open_source", this.openSource, this),
      commands.registerCommand("ewiv.refresh_recent_change", () => {
        rcTreeProvider.refresh();
      }),
      commands.registerCommand(
        "ewiv.refresh_site_recent_change",
        (ele: Site) => {
          rcTreeProvider.refresh(ele);
        }
      ),
      commands.registerCommand("ewiv.refresh_page_history", () => {
        historyTreeProvider.refresh();
      }),
    ];
  }
  private diffInBrowser(node: ChangeItem): void {
    env.openExternal(
      Uri.parse(
        `${node.index}?title=${node.data.title}&action=historysubmit&type=revision&diff=${node.data.revID}&oldid=${node.data.oldRevID}`
      )
    );
  }
  private async diffSource(node: ChangeItem): Promise<void> {
    if (!this.ewivFS) {
      commands.executeCommand("ewiv.init_fs");
    }
    const api = getSites().find((v) => v.site === node.siteName)?.api;
    if (!api) {
      console.warn(`site not found`);
      return;
    }
    const oldUri = Uri.parse(
      `ewivFS:/${node.siteName}/${node.data.title}?${node.data.oldRevID}`
    );
    if (!this.ewivFS.has(oldUri)) {
      const oldSource = await getSource(
        api,
        node.data.title,
        undefined,
        node.data.oldRevID.toString()
      );
      this.ewivFS.createFile(oldUri, Buffer.from(oldSource.content));
    }
    const newUri = Uri.parse(
      `ewivFS:/${node.siteName}/${node.data.title}?${node.data.revID}`
    );
    if (!this.ewivFS.has(newUri)) {
      const newSource = await getSource(
        api,
        node.data.title,
        undefined,
        node.data.revID.toString()
      );
      this.ewivFS.createFile(newUri, Buffer.from(newSource.content));
    }
    commands.executeCommand("vscode.diff", oldUri, newUri);
  }
  private async openSource(
    siteName: string,
    pageID?: string,
    title?: string,
    oldID?: string
  ): Promise<void> {
    const sites = getSites();
    if (!siteName) {
      const temp = await window.showQuickPick(sites.map((v) => v.site));
      if (temp) {
        siteName = temp;
      } else {
        return;
      }
    }
    const api = sites.find((v) => v.site === siteName)?.api;
    if (!api) {
      console.warn("not found site in conf ", siteName);
      return;
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
    let uri = Uri.parse(`ewivFS:/${siteName}/${title}`);
    if (oldID) {
      uri = uri.with({ query: oldID });
    }
    if (!oldID || !this.ewivFS?.has(uri)) {
      const source = await getSource(api, title, pageID, oldID);
      pageID = source.pageID;
      title = source.title;
      oldID = source.oldID;
      const content = source.content;
      uri = Uri.parse(`ewivFS:/${siteName}/${title}?${oldID}`);
      this.ewivFS?.createFile(uri, Buffer.from(content));
    }
    commands.executeCommand("vscode.open", uri);
  }
}
