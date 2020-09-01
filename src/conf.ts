import { workspace } from "vscode";
export interface SiteConf {
  site: string;
  index: string;
  api: string;
  rcNamespace: string;
  rcType: string;
}
export function getSites(): Array<SiteConf> {
  return <Array<SiteConf>>workspace.getConfiguration("ewiv").get("sites");
}
