import { workspace } from "vscode";
import { auth } from "./auth";
import { CookieJar } from "tough-cookie";
export interface SiteConf {
  site: string;
  index: string;
  api: string;
  rcNamespace?: string;
  rcType?: string;
  auth?: {
    name: string;
    password: string;
  };
  cookies: CookieJar;
}
export class Conf {
  private conf: SiteConf[];
  private map: Map<string, SiteConf>;
  private static instance: Conf;
  constructor() {
    this.conf = <SiteConf[]>workspace.getConfiguration("ewiv").get("sites");
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
  public getSites(): SiteConf[] {
    return this.conf;
  }
  public getSite(siteName: string): SiteConf | undefined {
    return this.map.get(siteName);
  }
  public async init(): Promise<void> {
    await Promise.all(
      this.conf
        .filter((v) => v.auth?.name && v.auth?.password)
        .map(async (v) => {
          if (v.auth?.name && v.auth.password) {
            const jar = await auth(v.api, v.auth.name, v.auth.password);
            if (jar) {
              v.cookies = jar;
            }
          }
        })
    );
  }
}
export function getSites(): Array<SiteConf> {
  return <Array<SiteConf>>workspace.getConfiguration("ewiv").get("sites");
}
export function getSite(siteName: string): SiteConf | undefined {
  return getSites().find((v) => v.site === siteName);
}
