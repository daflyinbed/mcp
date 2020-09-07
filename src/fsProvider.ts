import {
  FileStat,
  FileType,
  FileSystemProvider,
  Event,
  Uri,
  Disposable,
  FileSystemError,
  EventEmitter,
  FileChangeEvent,
  FileChangeType,
} from "vscode";
import * as path from "path";
export class NODE implements FileStat {
  // type: FileType;
  ctime: number;
  mtime: number;
  // size: number;

  data: Uint8Array;
  name: string;
  initType: FileType | undefined;
  // 子页面
  children: Map<string, NODE>;
  // 历史版本
  history: Map<number, NODE>;

  constructor(name: string, type?: FileType) {
    // this.type = FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.initType = type;
    // this.size = 0;

    this.name = name;
    this.children = new Map();
    this.history = new Map();
    this.data = Buffer.from("");
  }
  public get type(): FileType {
    if (this.ctime === this.mtime && this.initType) {
      return this.initType;
    }
    if (
      (this.history.size === 1 || this.history.size === 0) &&
      this.children.size === 0
    ) {
      return FileType.File;
    } else {
      return FileType.Directory;
    }
  }
  public get size(): number {
    let result = 0;
    if (this.type === FileType.File) {
      if (this.history.size === 0) {
        // 这个节点存了具体wikitext
        result = this.data.length;
      } else {
        // 这个节点是因为只有一个历史版本 所以算FILE
        for (const k of this.history.keys()) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          result = this.history.get(k)!.size;
        }
      }
    } else {
      result = this.children.size;
    }
    return result;
  }
}
export class EwivFS implements FileSystemProvider {
  constructor() {
    console.log("init");
  }
  root = new NODE("");
  watch(
    uri: Uri,
    options: { recursive: boolean; excludes: string[] }
  ): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => {});
    // throw new Error("Method not implemented.");
  }
  stat(uri: Uri): FileStat {
    return this._lookup(uri, false);
  }
  has(uri: Uri): boolean {
    return !!this._lookup(uri, true);
  }
  readDirectory(uri: Uri): [string, FileType][] {
    const entry = this._lookupDirectory(uri, false);
    const result: [string, FileType][] = [];
    for (const [name, child] of entry.children) {
      result.push([name, child.type]);
    }
    return result;
  }
  createDirectory(uri: Uri): void {
    const basename = path.posix.basename(uri.path);
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    const parent = this._lookupDirectory(dirname, false);
    if (!parent) {
      throw FileSystemError.FileNotFound(parent);
    }
    const entry = new NODE(basename, FileType.Directory);
    parent.children.set(entry.name, entry);
    parent.mtime = Date.now();
    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Created, uri }
    );
  }
  readFile(uri: Uri): Uint8Array {
    const data = this._lookupFile(uri, false).data;
    return data;
  }
  createFile(uri: Uri, content: Uint8Array): void {
    this._createDirectory(
      Uri.parse(`${uri.scheme}:${path.posix.dirname(uri.path)}`)
    );
    this.writeFile(uri, content, { create: true, overwrite: false });
  }
  writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
    const basename = path.posix.basename(uri.path);
    const parent = this._lookupParentDirectory(uri);
    let entry = parent.children.get(basename);
    if (!entry && !options.create) {
      throw FileSystemError.FileNotFound(uri);
    }
    if (entry && options.create && !options.overwrite) {
      throw FileSystemError.FileExists(uri);
    }
    if (!entry) {
      entry = new NODE(basename);
      parent.children.set(basename, entry);
    } else {
      entry.mtime = Date.now();
    }
    const node = new NODE(uri.query);
    node.data = content;
    entry.history.set(parseInt(uri.query), node);
    // entry.size = content.byteLength;
    // entry.data = content;
    this._fireSoon({ type: FileChangeType.Changed, uri });
    return;
  }
  delete(uri: Uri): void {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    const basename = path.posix.basename(uri.path);
    const parent = this._lookupDirectory(dirname, false);
    if (!parent.children.has(basename)) {
      throw FileSystemError.FileNotFound(uri);
    }
    parent.children.delete(basename);
    parent.mtime = Date.now();
    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Deleted, uri }
    );
  }
  rename(
    oldUri: Uri,
    newUri: Uri,
    options: { overwrite: boolean }
  ): void | Thenable<void> {
    if (!options.overwrite && this._lookup(newUri, true)) {
      throw FileSystemError.FileExists(newUri);
    }
    const entry = this._lookup(oldUri, false);
    const oldParent = this._lookupParentDirectory(oldUri);
    const newParent = this._lookupParentDirectory(newUri);
    const newName = path.posix.basename(newUri.path);
    oldParent.children.delete(entry.name);
    entry.name = newName;
    newParent.children.set(newName, entry);
    this._fireSoon(
      { type: FileChangeType.Deleted, uri: oldUri },
      { type: FileChangeType.Created, uri: newUri }
    );
  }
  private _createDirectory(uri: Uri): void {
    const parts = uri.path.split("/");
    let entry = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child: NODE;
      if (!entry.children.has(part)) {
        child = new NODE(part);
        entry.children.set(child.name, child);
        entry.mtime = Date.now();
      } else {
        child = <NODE>entry.children.get(part);
      }
      entry = child;
    }
  }
  private _lookup(uri: Uri, silent: false): NODE;
  private _lookup(uri: Uri, silent: boolean): NODE | undefined;
  private _lookup(uri: Uri, silent: boolean): NODE | undefined {
    const parts = uri.path.split("/");
    let entry: NODE = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      const child = entry.children.get(part);
      if (!child) {
        if (!silent) {
          throw FileSystemError.FileNotFound(uri);
        } else {
          return undefined;
        }
      }
      entry = child;
    }
    if (parseInt(uri.query)) {
      const temp = entry.history.get(parseInt(uri.query));
      if (!temp) {
        throw FileSystemError.FileNotFound(uri);
      }
      entry = temp;
    }
    return entry;
  }
  private _lookupFile(uri: Uri, silent: boolean): NODE {
    const entry = this._lookup(uri, silent);
    if (entry?.type === FileType.File) {
      return entry;
    }
    if (entry?.history.size !== 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const keys = Array.from(entry!.history.keys());
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const latest = entry!.history.get(keys.sort((a, b) => a - b)[0]);
      if (latest) {
        return latest;
      }
    }
    throw FileSystemError.FileNotFound(uri);
  }
  private _lookupDirectory(uri: Uri, silent: boolean): NODE {
    const entry = this._lookup(uri, silent);
    if (entry) {
      return entry;
    }
    throw FileSystemError.FileNotFound(uri);
  }
  private _lookupParentDirectory(uri: Uri): NODE {
    const dirname = Uri.parse(`${uri.scheme}:${path.posix.dirname(uri.path)}`);
    return this._lookupDirectory(dirname, false);
  }
  private _emitter = new EventEmitter<FileChangeEvent[]>();
  private _bufferedEvents: FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timer;
  readonly onDidChangeFile: Event<import("vscode").FileChangeEvent[]> = this
    ._emitter.event;
  private _fireSoon(...events: FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);
    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }
    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }
}
