import axios from "axios";
export async function getSource(
  index: string,
  title?: string,
  id?: string,
  oldID?: string
): Promise<string> {
  const params: Record<string, string> = {
    action: "raw",
  };
  if (oldID) {
    params.oldid = oldID;
  }
  if (title && !id) {
    params.title = title;
  } else if (id) {
    params.curid = id;
  } else {
    console.error("need title or id");
    return "";
  }
  const resp = await axios({
    method: "GET",
    url: index,
    params: params,
  });
  return resp.data;
}
