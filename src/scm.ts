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
import { NODE } from "./fsProvider";
import { toNegative, toPositive, parseUri } from "./utils";
export class mySCM implements Disposable {
  dispose(): void {
    this.sc.dispose();
  }
  private sc: SourceControl;
  private changedResources: SourceControlResourceGroup;
  constructor(context: ExtensionContext) {
    this.sc = scm.createSourceControl("ewiv", "ewiv");
    this.sc.quickDiffProvider = new DiffProvider();
    this.changedResources = this.sc.createResourceGroup("unsubmit", "unSubmit");
    const fsWatcher = workspace.createFileSystemWatcher("/Mooncell/**");
    fsWatcher.onDidChange(async (uri) => {
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
        this.changedResources.resourceStates = arr;
        this.sc.count = arr.length;
      } else {
        const index = this.changedResources.resourceStates.findIndex(
          (v) =>
            v.resourceUri.query === uri.query && v.resourceUri.path === uri.path
        );
        if (index === -1) {
          return;
        }
        const arr = this.changedResources.resourceStates;
        arr.splice(index, 1);
        this.changedResources.resourceStates = arr;
        this.sc.count = arr.length;
      }
    }, context.subscriptions);
    context.subscriptions.push(fsWatcher);
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
