import {
  scm,
  Uri,
  workspace,
  Disposable,
  SourceControl,
  SourceControlResourceGroup,
  SourceControlResourceState,
  ExtensionContext,
  QuickDiffProvider,
} from "vscode";
import { toNegative, toPositive, parseUri } from "./utils";
import { Conf, SiteConf } from "./mw";
export class McpSCM implements Disposable {
  dispose(): void {
    this.sc.dispose();
  }
  private sc: SourceControl;
  private resourceGroups: SourceControlResourceGroup[];
  constructor(context: ExtensionContext) {
    this.sc = scm.createSourceControl("mcp", "mcp");
    this.sc.quickDiffProvider = new DiffProvider();
    const sites = Conf.get().getSites();
    this.resourceGroups = sites.map((site) => {
      return this.sc.createResourceGroup(site.site, site.site);
    });
    sites.forEach((site: SiteConf, index: number) => {
      const fsWatcher = workspace.createFileSystemWatcher(`/${site.site}/**`);
      fsWatcher.onDidChange(async (uri: Uri) => {
        const arr: SourceControlResourceState[] = [];
        if (await this.isChange(uri)) {
          const { siteName, pageName, history } = parseUri(uri);
          arr.push({
            resourceUri: uri,
            command: {
              title: "diff",
              command: "vscode.diff",
              arguments: [
                uri.with({ query: toNegative(uri.query).toString() }),
                uri.with({ query: toPositive(uri.query).toString() }),
                `${siteName} ${pageName} ${history}`,
              ],
            },
          });
          this.resourceGroups[index].resourceStates = arr;
        } else {
          const i = this.resourceGroups[index].resourceStates.findIndex(
            (v) =>
              v.resourceUri.query === uri.query &&
              v.resourceUri.path === uri.path
          );
          if (i === -1) {
            return;
          }
          const arr = this.resourceGroups[index].resourceStates;
          arr.splice(i, 1);
          this.resourceGroups[index].resourceStates = arr;
        }
        this.sc.count = this.count();
      }, context.subscriptions);
    });
    // this.changedResources = this.sc.createResourceGroup("unsubmit", "unSubmit");
    // const fsWatcher = workspace.createFileSystemWatcher(
    //   `/{${Conf.get()
    //     .getSites()
    //     .map((v) => v.site)
    //     .join(",")}}/**`
    // );
    // fsWatcher.onDidChange(async (uri) => {
    //   const arr: SourceControlResourceState[] = [];
    //   if (await this.isChange(uri)) {
    //     const { siteName, pageName, history } = parseUri(uri);
    //     arr.push({
    //       resourceUri: uri,
    //       command: {
    //         title: "diff",
    //         command: "vscode.diff",
    //         arguments: [
    //           uri.with({ query: toNegative(uri.query).toString() }),
    //           uri.with({ query: toPositive(uri.query).toString() }),
    //           `${siteName} ${pageName} ${history}`,
    //         ],
    //       },
    //     });
    //     this.changedResources.resourceStates = arr;
    //     this.sc.count = arr.length;
    //   } else {
    //     const index = this.changedResources.resourceStates.findIndex(
    //       (v) =>
    //         v.resourceUri.query === uri.query && v.resourceUri.path === uri.path
    //     );
    //     if (index === -1) {
    //       return;
    //     }
    //     const arr = this.changedResources.resourceStates;
    //     arr.splice(index, 1);
    //     this.changedResources.resourceStates = arr;
    //     this.sc.count = arr.length;
    //   }
    // }, context.subscriptions);
    // context.subscriptions.push(fsWatcher);
  }
  private count(): number {
    return this.resourceGroups.reduce((acc, cur) => {
      return acc + cur.resourceStates.length;
    }, 0);
  }
  private async isChange(uri: Uri): Promise<boolean> {
    const fs = workspace.fs;
    try {
      const ori = await fs.readFile(
        uri.with({ query: toNegative(uri.query).toString() })
      );
      const cur = await fs.readFile(
        uri.with({ query: toPositive(uri.query).toString() })
      );
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(ori) !== decoder.decode(cur);
    } catch (e) {
      console.error(e);
      return true;
    }
  }
}
class DiffProvider implements QuickDiffProvider {
  provideOriginalResource(uri: Uri): Uri {
    return uri.with({ query: toNegative(uri.query).toString() });
  }
}
