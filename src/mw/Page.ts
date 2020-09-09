import got from "got";
import { Conf } from "./index";
interface PageRevision {
  pageID: string;
  title: string;
  oldID: string;
  content: string;
}
export class PageRevisions {
  public user: string;
  public comment: string;
  public time: Date;
  public title: string;
  public pageID: number;
  public revID: number;
  public size: number;
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
    size: number,
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
    this.size = size;
    // 查巡查状态需要权限
    // this.isPatrolled = isPatrolled;
    this.sha1 = sha1;
  }
}
export async function getSource(
  site: string,
  title?: string,
  id?: string,
  oldID?: string
): Promise<PageRevision> {
  const params: Record<string, string> = {
    action: "query",
    format: "json",
    prop: "revisions",
    rvprop: "content|ids",
  };
  if (oldID) {
    params.revids = oldID;
  } else if (title && !id) {
    // revid和title不能一起用 也不能和pageid一起用
    params.titles = title;
  } else if (id) {
    params.pageids = id;
  } else {
    console.error("need revid or title or id");
    return <PageRevision>{};
  }
  const conf = Conf.get().getSite(site);
  if (!conf) {
    console.error("site not found: ", site);
    return <PageRevision>{};
  }
  const resp = await got(conf.api, {
    method: "GET",
    searchParams: params,
    cookieJar: conf.cookies,
  });
  const data = JSON.parse(resp.body);
  id = Object.keys(data.query.pages)[0];
  const info = data.query.pages[id];
  return {
    pageID: info.pageid,
    title: info.title,
    oldID: info.revisions[0].revid,
    content: info.revisions[0]["*"],
  };
}
export async function getHistory(
  site: string,
  title?: string,
  id?: string
): Promise<PageRevisions[]> {
  const params: Record<string, string> = {
    action: "query",
    prop: "revisions",
    format: "json",
    rvprop: "ids|timestamp|user|size|comment|sha1",
    rvlimit: "10",
  };
  if (id) {
    params.pageids = id;
  } else if (title) {
    params.titles = title;
  }
  const conf = Conf.get().getSite(site);
  if (!conf) {
    console.error("site not found: ", site);
    return [];
  }

  const resp = await got(conf.api, {
    method: "GET",
    searchParams: params,
  });
  const data = JSON.parse(resp.body);
  if (!id) {
    id = Object.keys(data.query.pages)[0];
  }
  return data.query.pages[id].revisions.map(
    (v: Record<string, string | number>) => {
      return new PageRevisions(
        <string>v.user,
        <string>v.comment,
        <string>v.timestamp,
        <string>title,
        parseInt(<string>id),
        <number>v.revid,
        <number>v.size,
        <string>v.sha1
      );
    }
  );
}
