import { RC, Change } from "../mw/rc";
import {
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  EventEmitter,
  Event,
} from "vscode";
import { Conf, SiteConf } from "../mw";
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
      return Conf.get()
        .getSites()
        .map((v) => {
          return new Site(v);
        });
    } else {
      const changes = await new RC(ele.siteConf.site).init();
      return changes.map((v) => new ChangeItem(v, ele.siteConf.site));
    }
  }
}
export class Site extends TreeItem {
  public siteConf: SiteConf;
  constructor(siteConf: SiteConf) {
    super(siteConf.site, TreeItemCollapsibleState.Collapsed);
    this.siteConf = siteConf;
    this.contextValue = "mcp:rc_site";
  }
}

export class ChangeItem extends TreeItem {
  public data: Change;
  public siteName: string;
  constructor(data: Change, siteName: string) {
    super(`${data.title}`);
    this.command = {
      title: "open source",
      command: "mcp.open_source",
      arguments: [siteName, data.pageID, data.title, data.revID],
    };
    this.siteName = siteName;
    this.description = sign(data.newLen - data.oldLen);
    this.data = data;
    this.tooltip = `${data.user}
${data.time.toLocaleString()}
${data.title}
${data.comment}
${data.oldRevID}->${data.revID}`;
    this.contextValue = "mcp:rc_change";
  }
}
