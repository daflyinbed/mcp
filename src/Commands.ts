import {
  commands,
  env,
  Uri,
  workspace,
  Disposable,
  window,
  TextEditor,
  StatusBarAlignment,
} from "vscode";
import { EwivFS, NODE } from "./fsProvider";
import { ChangeItem, RcDataProvider, Site } from "./treeViewProviders/rc";
import { HistoryProvider } from "./treeViewProviders/pageHistory";
import { getSource, edit } from "./mw/Page";
import { Conf } from "./mw";
import { parseUri, toPositive } from "./utils";
export class Commands {
  arr: Disposable[] = [];
  fsInitialized = false;
  ewivFS: EwivFS;
  constructor() {
    this.ewivFS = new EwivFS();
    const rcTreeProvider = new RcDataProvider();
    const historyTreeProvider = new HistoryProvider();
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    window.onDidChangeActiveTextEditor((e: TextEditor | undefined) => {
      if (e?.document.uri.scheme === "ewivFS") {
        const uri = e.document.uri;
        historyTreeProvider.refresh();
        const { siteName, pageName } = parseUri(uri);
        statusBarItem.text = `${siteName} • ${pageName} • ${
          this.ewivFS.getPageData(uri).contentModel || "wikitext"
        }`;
        statusBarItem.show();
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
      commands.registerCommand("ewiv.edit", this.edit, this),
      commands.registerCommand("ewiv.discard", this.discard, this),
      commands.registerCommand("ewiv.login", this.login, this),
      commands.registerCommand("ewiv.open_in_browser", (uri: Uri) => {
        const { siteName, pageName } = parseUri(uri);
        const site = Conf.get().getSite(siteName);
        if (!site) {
          console.error("site not found: ", uri);
          return;
        }
        env.openExternal(
          Uri.parse(
            `${site.index}?title=${pageName}${
              uri.query ? "&oldid=" + toPositive(uri.query) : ""
            }`
          )
        );
      }),
    ];
  }
  private diffInBrowser(node: ChangeItem): void {
    const conf = Conf.get().getSite(node.siteName);
    if (!conf) {
      console.error("site not found: ", node.siteName);
      return;
    }
    env.openExternal(
      Uri.parse(
        `${conf.index}?title=${node.data.title}&action=historysubmit&type=revision&diff=${node.data.revID}&oldid=${node.data.oldRevID}`
      )
    );
  }
  private async diffSource(node: ChangeItem): Promise<void> {
    if (!this.ewivFS) {
      commands.executeCommand("ewiv.init_fs");
    }
    const oldUri = Uri.parse(
      `ewivFS:/${node.siteName}/${node.data.title}?${node.data.oldRevID}`
    );
    if (!this.ewivFS.has(oldUri)) {
      const oldSource = await getSource(
        node.siteName,
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
        node.siteName,
        node.data.title,
        undefined,
        node.data.revID.toString()
      );
      this.ewivFS.createFile(newUri, Buffer.from(newSource.content));
    }
    commands.executeCommand(
      "vscode.diff",
      Uri.parse(
        `ewivFS:/${node.siteName}/${node.data.title}?${node.data.oldRevID}`
      ),
      Uri.parse(
        `ewivFS:/${node.siteName}/${node.data.title}?${node.data.revID}`
      ),
      `${node.siteName} ${node.data.title} ${node.data.oldRevID}-${node.data.revID} ${node.data.comment}`
    );
  }
  private async openSource(
    siteName: string,
    pageID?: string,
    title?: string,
    oldID?: string
  ): Promise<void> {
    const conf = Conf.get();
    const sites = conf.getSites();
    if (!siteName) {
      const temp = await window.showQuickPick(sites.map((v) => v.site));
      if (temp) {
        siteName = temp;
      } else {
        return;
      }
    }
    const site = conf.getSite(siteName);
    if (!site) {
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
      const source = await getSource(siteName, title, pageID, oldID);
      pageID = source.pageID;
      title = source.title;
      oldID = source.oldID;
      const content = source.content;
      uri = Uri.parse(`ewivFS:/${siteName}/${title}?${oldID}`);
      this.ewivFS?.createFile(uri, Buffer.from(content));
      this.ewivFS?.setPageData(uri, source.pageData);
    }
    commands.executeCommand("vscode.open", uri);
  }
  private async edit({ resourceUri }: any) {
    let uri: Uri;
    if (resourceUri) {
      uri = resourceUri;
    } else {
      uri = window.activeTextEditor!.document.uri;
    }
    const file = <NODE>this.ewivFS.stat(uri);
    const content = new TextDecoder("utf-8").decode(file.data);
    const { siteName, pageName } = parseUri(uri);
    const site = Conf.get().getSite(siteName);
    if (!site) {
      console.error("site not found: ", siteName);
      return;
    }
    await Conf.get().init(siteName);
    let summary = await window.showInputBox({ placeHolder: "summary" });
    if (!summary) {
      summary = "";
    }
    await edit(siteName, pageName, content, summary, new Date(file.mtime));
    this.ewivFS.rollBack(uri);
  }
  private async login() {
    const siteName = await window.showQuickPick(
      Conf.get()
        .getSites()
        .map((v) => v.site)
    );
    if (!siteName) {
      return;
    }
    await Conf.get().init(siteName);
  }
  private discard({ resourceUri }: { resourceUri: Uri }) {
    this.ewivFS.rollBack(resourceUri);
  }
}
