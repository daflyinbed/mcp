import axios from "axios";
interface PageRevision {
  pageID: string;
  title: string;
  oldID: string;
  content: string;
}
export async function getSource(
  api: string,
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
  const resp = await axios({
    method: "GET",
    url: api,
    params: params,
  });
  id = Object.keys(resp.data.query.pages)[0];
  const info = resp.data.query.pages[id];
  return {
    pageID: info.pageid,
    title: info.title,
    oldID: info.revisions[0].revid,
    content: info.revisions[0]["*"],
  };
}
