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
import { McpFS, NODE } from "./fsProvider";
import { ChangeItem, RcDataProvider, Site } from "./treeViewProviders/rc";
import { HistoryProvider } from "./treeViewProviders/pageHistory";
import { getSource, edit } from "./mw/Page";
import { Conf } from "./mw";
import { parseUri, toPositive } from "./utils";
export class Commands {
  arr: Disposable[] = [];
  fsInitialized = false;
  mcpFS: McpFS;
  constructor() {
    this.mcpFS = new McpFS();
    const rcTreeProvider = new RcDataProvider();
    const historyTreeProvider = new HistoryProvider();
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    window.onDidChangeActiveTextEditor((e: TextEditor | undefined) => {
      if (e?.document.uri.scheme === "mcpFS") {
        const uri = e.document.uri;
        historyTreeProvider.refresh();
        const { siteName, pageName, history } = parseUri(uri);
        statusBarItem.text = `${siteName} • ${pageName} • ${history} • ${
          this.mcpFS.getPageData(uri).contentModel || "wikitext"
        }`;
        statusBarItem.show();
      }
    });
    this.arr = [
      workspace.registerFileSystemProvider("mcpFS", this.mcpFS, {
        isCaseSensitive: true,
      }),
      window.registerTreeDataProvider("mcpRecentChange", rcTreeProvider),
      window.registerTreeDataProvider("mcpPageRevisions", historyTreeProvider),
      commands.registerCommand("mcp.diff_in_browser", this.diffInBrowser),
      commands.registerCommand("mcp.diff_source", this.diffSource, this),
      commands.registerCommand("mcp.open_source", this.openSource, this),
      commands.registerCommand("mcp.refresh_recent_change", () => {
        Conf.get().reload();
        rcTreeProvider.refresh();
      }),
      commands.registerCommand(
        "mcp.refresh_site_recent_change",
        (ele: Site) => {
          rcTreeProvider.refresh(ele);
        }
      ),
      commands.registerCommand("mcp.refresh_page_history", () => {
        historyTreeProvider.refresh();
      }),
      commands.registerCommand("mcp.edit", this.edit, this),
      commands.registerCommand("mcp.discard", this.discard, this),
      commands.registerCommand("mcp.login", this.login, this),
      commands.registerCommand("mcp.open_in_browser", (uri: Uri) => {
        const { siteName, pageName } = parseUri(uri);
        const site = Conf.get().getSite(siteName);
        if (!site) {
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
      return;
    }
    env.openExternal(
      Uri.parse(
        `${conf.index}?title=${node.data.title}&action=historysubmit&type=revision&diff=${node.data.revID}&oldid=${node.data.oldRevID}`
      )
    );
  }
  private async diffSource(node: ChangeItem): Promise<void> {
    const oldUri = Uri.parse(
      `mcpFS:/${node.siteName}/${node.data.title}?${node.data.oldRevID}`
    );
    if (!this.mcpFS.has(oldUri)) {
      const oldSource = await getSource(
        node.siteName,
        node.data.title,
        undefined,
        node.data.oldRevID.toString()
      );
      this.mcpFS.createFile(oldUri, Buffer.from(oldSource.content));
    }
    const newUri = Uri.parse(
      `mcpFS:/${node.siteName}/${node.data.title}?${node.data.revID}`
    );
    if (!this.mcpFS.has(newUri)) {
      const newSource = await getSource(
        node.siteName,
        node.data.title,
        undefined,
        node.data.revID.toString()
      );
      this.mcpFS.createFile(newUri, Buffer.from(newSource.content));
    }
    commands.executeCommand(
      "vscode.diff",
      Uri.parse(
        `mcpFS:/${node.siteName}/${node.data.title}?${node.data.oldRevID}`
      ),
      Uri.parse(
        `mcpFS:/${node.siteName}/${node.data.title}?${node.data.revID}`
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
      return;
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
    let source;
    let uri = Uri.parse(`mcpFS:/${siteName}/${title}`);
    if (!oldID) {
      source = await getSource(siteName, title, pageID, oldID);
      oldID = source.oldID;
    }
    uri = uri.with({ query: oldID });
    if (!this.mcpFS?.has(uri)) {
      if (!source) {
        source = await getSource(siteName, title, pageID, oldID);
      }
      pageID = source.pageID;
      title = source.title;
      oldID = source.oldID;
      const content = source.content;
      this.mcpFS?.createFile(uri, Buffer.from(content));
      this.mcpFS?.setPageData(uri, source.pageData);
    }
    commands.executeCommand("vscode.open", uri);
  }
  private async edit(data: any) {
    let uri: Uri;
    if (data?.resourceUri instanceof Uri) {
      uri = data.resourceUri;
    } else {
      uri = window.activeTextEditor!.document.uri;
    }
    const file = <NODE>this.mcpFS.stat(uri);
    const content = new TextDecoder("utf-8").decode(file.data);
    const { siteName, pageName } = parseUri(uri);
    const site = Conf.get().getSite(siteName);
    if (!site) {
      return;
    }
    await Conf.get().init(siteName);
    let summary = await window.showInputBox({ placeHolder: "summary" });
    if (!summary) {
      summary = "";
    }
    const page = <NODE>this.mcpFS.stat(uri.with({ query: "" }));
    const maxRevID = Array.from(page.history.keys()).sort((a, b) => b - a)[0];
    const success = await edit(
      siteName,
      pageName,
      content,
      summary,
      toPositive(uri.query),
      maxRevID === toPositive(uri.query)
    );
    if (success) {
      this.mcpFS.rollBack(uri);
      commands.executeCommand("mcp.refresh_recent_change");
      commands.executeCommand("mcp.refresh_page_history");
    }
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
    this.mcpFS.rollBack(resourceUri);
  }
}
