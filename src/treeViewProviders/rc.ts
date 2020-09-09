import { RC, Change } from "../mw/rc";
import {
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  EventEmitter,
  Event,
} from "vscode";
import { getSites, SiteConf } from "../conf";
import { sign } from "../utils";
export class RcDataProvider
  implements TreeDataProvider<Site | ChangeItem | undefined> {
  private _onDidChangeTreeData: EventEmitter<
    Site | ChangeItem | undefined
  > = new EventEmitter<Site | ChangeItem>();
  readonly onDidChangeTreeData: Event<Site | ChangeItem | undefined> = this
    ._onDidChangeTreeData.event;

  refresh(ele?: Site): void {
    this._onDidChangeTreeData.fire(ele);
  }
  // constructor() {}
  getTreeItem(ele: Site | ChangeItem): TreeItem {
    return ele;
  }
  async getChildren(ele: Site): Promise<Site[] | ChangeItem[]> {
    if (!ele) {
      return getSites().map((v) => {
        return new Site(v);
      });
    } else {
      const changes = await new RC(
        ele.api,
        ele.index,
        ele.rcNamespace,
        ele.rcType
      ).init();
      return changes.map((v) => new ChangeItem(v, ele.index, ele.siteName));
    }
  }
}
export class Site extends TreeItem {
  public siteName: string;
  public api: string;
  public index: string;
  public rcNamespace: string;
  public rcType: string;
  constructor({ site, api, index, rcNamespace, rcType }: SiteConf) {
    super(site, TreeItemCollapsibleState.Collapsed);
    this.siteName = site;
    this.api = api;
    this.index = index;
    this.rcNamespace = rcNamespace;
    this.rcType = rcType || "edit|new|external|categorize";
    this.contextValue = "ewiv:rc_site";
  }
}

export class ChangeItem extends TreeItem {
  public data: Change;
  public index: string;
  public siteName: string;
  constructor(data: Change, index: string, siteName: string) {
    super(`${data.title}`);
    this.command = {
      title: "open source",
      command: "ewiv.open_source",
      arguments: [siteName, data.pageID, data.title, data.revID],
    };
    this.siteName = siteName;
    this.index = index;
    this.description = sign(data.newLen - data.oldLen);
    this.data = data;
    this.tooltip = `${data.user}
${data.time.toLocaleString()}
${data.title}
${data.comment}
${data.oldRevID}->${data.revID}`;
    this.contextValue = "ewiv:rc_change";
  }
}
