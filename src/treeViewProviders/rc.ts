import { RC, RecentChange } from "../mw/rc";
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState } from "vscode";
import { getSites, SiteConf } from "../conf";
export class RcDataProvider implements TreeDataProvider<Site | Change> {
  // constructor() {}
  getTreeItem(ele: Site | Change): TreeItem {
    return ele;
  }
  async getChildren(ele: Site): Promise<Site[] | Change[]> {
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
      return changes.map((v) => new Change(v, ele.index, ele.siteName));
    }
  }
}
class Site extends TreeItem {
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
  }
}
const sign = (num: number): string => (num > 0 ? `+${num}` : String(num));
export class Change extends TreeItem {
  public data: RecentChange;
  public index: string;
  public siteName: string;
  constructor(data: RecentChange, index: string, siteName: string) {
    super(`${data.title}`);
    this.command = {
      title: "open source",
      command: "ewiv.open_source",
      arguments: [siteName, data.pageID, data.title, data.oldRevID],
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
    this.contextValue = "ewiv:change";
  }
}
