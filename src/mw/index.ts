import { workspace, window } from "vscode";
import { auth } from "./auth";
import { CookieJar } from "tough-cookie";
export interface SiteConf {
  site: string;
  index: string;
  api: string;
  rcNamespace?: string;
  rcType?: string;
  name?: string;
  password?: string;
  cookies: CookieJar;
}
export class Conf {
  private conf: SiteConf[];
  private map: Map<string, SiteConf>;
  private static instance: Conf;
  constructor() {
    this.conf = <SiteConf[]>workspace.getConfiguration("mcp").get("sites");
    this.map = new Map();
    this.conf.forEach((v) => {
      this.map.set(v.site, v);
    });
  }
  public static get(): Conf {
    if (!this.instance) {
      this.instance = new Conf();
    }
    return this.instance;
  }
  public reload(): void {
    this.conf = <SiteConf[]>workspace.getConfiguration("mcp").get("sites");
    this.map = new Map();
    this.conf.forEach((v) => {
      this.map.set(v.site, v);
    });
  }
  public getSites(): SiteConf[] {
    return this.conf;
  }
  public getSite(siteName: string): SiteConf | undefined {
    const site = this.map.get(siteName);
    if (!site) {
      window.showErrorMessage("site not found in configure file" + siteName);
    }
    return site;
  }
  public async init(siteName: string): Promise<void> {
    const site = this.getSite(siteName);
    if (!site) {
      return;
    }
    if (site.cookies) {
      // console.log("already logined");
      return;
    }
    if (!site?.name) {
      // console.log("need uesrname of: ", siteName);
      const temp = await window.showInputBox({
        placeHolder: "username",
        prompt: `username for login ${siteName}`,
      });
      if (temp) {
        site.name = temp;
      } else {
        return;
      }
    }
    if (!site?.password) {
      // console.log("need password of: ", siteName);
      const temp = await window.showInputBox({
        placeHolder: "password",
        password: true,
        prompt: `password for login ${siteName}`,
      });
      if (temp) {
        site.password = temp;
      } else {
        return;
      }
    }
    const jar = await auth(site.api, site.name, site.password);
    if (jar) {
      site.cookies = jar;
    } else {
      window.showErrorMessage(`login failed with ${site.name} in ${site.site}`);
    }
  }
}
export function getSites(): Array<SiteConf> {
  return <Array<SiteConf>>workspace.getConfiguration("mcp").get("sites");
}
export function getSite(siteName: string): SiteConf | undefined {
  return getSites().find((v) => v.site === siteName);
}
