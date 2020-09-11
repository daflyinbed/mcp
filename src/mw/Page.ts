import got from "got";
import { Conf } from "./index";
import { window } from "vscode";
import { PageData } from "../fsProvider";
interface PageRevision {
  pageID: string;
  title: string;
  oldID: string;
  content: string;
  pageData: PageData;
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
    rvprop: "content|ids|contentmodel",
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
    pageData: { contentModel: info.revisions[0].contentmodel },
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
    return [];
  }

  const resp = await got(conf.api, {
    method: "GET",
    searchParams: params,
    cookieJar: conf.cookies,
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
export async function edit(
  siteName: string,
  title: string,
  text: string,
  summary: string,
  revID: number,
  Latest: boolean
): Promise<boolean> {
  const site = Conf.get().getSite(siteName);
  if (!site) {
    return false;
  }
  const [token, curID] = await getToken(siteName, title);
  if (!token || curID == undefined || isNaN(curID)) {
    window.showErrorMessage(`submit ${title} failed`);
    return false;
  }
  if (revID < curID) {
    const y = await window.showInputBox({
      prompt: `your edit is based on ${revID} which ${
        Latest ? "IS LATEST" : "IS NOT LATEST"
      } version at your open time, current latest version is ${curID}, input y if you still want to submit`,
    });
    if (y !== "y") {
      return false;
    }
  }
  const resp = await got(site.api, {
    method: "POST",
    form: {
      action: "edit",
      title: title,
      text: text,
      summary: summary || "from mcp",
      format: "json",
      token: token,
    },
    cookieJar: site.cookies,
  });
  const data = JSON.parse(resp.body);
  if (data.edit.result === "Success") {
    window.showInformationMessage("submit success");
    return true;
  }
  return false;
}
async function getToken(
  siteName: string,
  title: string
): Promise<[string, number]> {
  const site = Conf.get().getSite(siteName);
  if (!site) {
    return ["", NaN];
  }
  const resp = await got(site.api, {
    method: "GET",
    searchParams: {
      action: "query",
      meta: "tokens",
      type: "csrf",
      format: "json",
      titles: title,
      prop: "revisions",
      rvprop: "ids",
    },
    cookieJar: site.cookies,
  });
  const data = JSON.parse(resp.body);
  const id = Object.keys(data.query.pages)[0];
  return [data.query.tokens.csrftoken, data.query.pages[id].revisions[0].revid];
}
