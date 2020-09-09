import { getHistory, PageRevisions } from "../mw/Page";
import { getSites, SiteConf } from "../conf";
import {
  TreeItem,
  TreeDataProvider,
  window,
  EventEmitter,
  Event,
} from "vscode";
export class HistoryItem extends TreeItem {
  public data: PageRevisions;
  public api: string;
  public index: string;
  public siteName: string;
  constructor(
    data: PageRevisions,
    api: string,
    index: string,
    siteName: string
  ) {
    super(`${data.time.toLocaleString()}`);
    this.data = data;
    this.api = api;
    this.index = index;
    this.siteName = siteName;
    this.command = {
      title: "open source",
      command: "ewiv.open_source",
      arguments: [siteName, data.pageID, data.title, data.revID],
    };
    this.description = `${data.user} ${data.comment}`;
    this.tooltip = data.size.toString();
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

      if (doc?.uri.scheme === "ewivFS") {
        const siteName = doc.uri.path.split("/")[1];
        const { api, index } = <SiteConf>(
          getSites().find((v) => v.site === siteName)
        );
        const pagename = doc.uri.path.split("/").slice(2).join("/");
        const resp = await getHistory(api, pagename);
        return resp.map((v) => {
          return new HistoryItem(v, api, index, siteName);
        });
      }
    } else {
      return [];
    }
  }
}
