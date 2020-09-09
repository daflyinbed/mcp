import got from "got";
import { Conf, SiteConf } from "./index";
export class Change {
  public user: string;
  public comment: string;
  public time: Date;
  public title: string;
  public pageID: number;
  public revID: number;
  public oldRevID: number;
  public oldLen: number;
  public newLen: number;
  // 查巡查状态需要权限
  // public isPatrolled: boolean;
  public sha1: string;
  constructor(
    user: string,
    comment: string,
    timestamp: string,
    title: string,
    pageID: number,
    revID: number,
    oldRevID: number,
    oldLen: number,
    newLen: number,
    // 查巡查状态需要权限
    // isPatrolled: boolean,
    sha1: string
  ) {
    this.user = user;
    this.comment = comment;
    this.time = new Date(timestamp);
    this.title = title;
    this.pageID = pageID;
    this.revID = revID;
    this.oldRevID = oldRevID;
    this.oldLen = oldLen;
    this.newLen = newLen;
    // 查巡查状态需要权限
    // this.isPatrolled = isPatrolled;
    this.sha1 = sha1;
  }
}
export class RC {
  public site: string;
  public _continue = "";
  public list: Array<Change> = [];
  constructor(site: string) {
    this.site = site;
  }
  get conf(): SiteConf | undefined {
    return Conf.get().getSite(this.site);
  }
  async _get(_continue?: boolean): Promise<Array<Change>> {
    if (!this.conf) {
      console.error("site not found: ", this.site);
      return [];
    }
    const params: Record<string, string | number> = {
      action: "query",
      list: "recentchanges",
      rclimit: 20,
      rcprop: "user|comment|timestamp|title|ids|sizes|redirect|sha1",
      format: "json",
      rctype: this.conf.rcType || "edit|new|external|categorize",
    };
    if (this.conf.rcNamespace) {
      params["rcnamespace"] = this.conf.rcNamespace;
    }
    if (_continue) {
      params["rccontinue"] = this._continue;
    }
    try {
      const result = await got(this.conf.api, {
        method: "GET",
        searchParams: params,
      });
      const data = JSON.parse(result.body);
      this.list = data.query.recentchanges.map(
        (v: Record<string, string | number>) => {
          return new Change(
            <string>v.user,
            <string>v.comment,
            <string>v.timestamp,
            <string>v.title,
            <number>v.pageid,
            <number>v.revid,
            <number>v.old_revid,
            <number>v.oldlen,
            <number>v.newlen,
            // 查巡查状态需要权限
            // v.hasOwnProperty("patrolled"),
            <string>v.sha1
          );
        }
      );
      this._continue = data.continue.rccontinue;
      return this.list;
    } catch (e) {
      console.warn(e);
      return [];
    }
  }
  async init(): Promise<Array<Change>> {
    return this._get(false);
  }
}
