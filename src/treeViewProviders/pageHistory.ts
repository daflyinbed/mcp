import { getHistory, PageRevisions } from "../mw/Page";
import {
  TreeItem,
  TreeDataProvider,
  window,
  EventEmitter,
  Event,
} from "vscode";
import { parseUri, toPositive } from "../utils";
export class HistoryItem extends TreeItem {
  public data: PageRevisions;
  public siteName: string;
  constructor(data: PageRevisions, siteName: string, curRevID: number) {
    super(`${curRevID === data.revID ? "[CURRENT] " : ""}${data.revID}`);
    this.data = data;
    this.siteName = siteName;
    this.command = {
      title: "open source",
      command: "mcp.open_source",
      arguments: [siteName, data.pageID, data.title, data.revID],
    };
    this.description = `${data.user} ${data.comment}`;
    this.tooltip = `${siteName}
${data.title}
editor: ${data.user}
${data.time.toLocaleString()}
${data.comment || "no comment"}
revID: ${data.revID}
size: ${data.size}`;
  }
}
export class HistoryProvider implements TreeDataProvider<HistoryItem> {
  private _onDidChangeTreeData: EventEmitter<
    HistoryItem | undefined
  > = new EventEmitter<HistoryItem | undefined>();
  readonly onDidChangeTreeData: Event<HistoryItem | undefined> = this
    ._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  getTreeItem(element: HistoryItem): TreeItem {
    return element;
  }
  async getChildren(element?: HistoryItem): Promise<HistoryItem[] | undefined> {
    if (!element) {
      const doc = window.activeTextEditor?.document;
      if (doc?.uri.scheme === "mcpFS") {
        const { siteName, pageName } = parseUri(doc.uri);
        const resp = await getHistory(siteName, pageName);
        return resp.map((v) => {
          return new HistoryItem(v, siteName, toPositive(doc.uri.query));
        });
      }
    } else {
      return [];
    }
  }
}
