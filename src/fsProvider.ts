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
export class File implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
  data: Uint8Array;
  name: string;
  constructor(name: string) {
    this.type = FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.data = Buffer.from("");
  }
}
export class Directory implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  entries: Map<string, File | Directory>;

  constructor(name: string) {
    this.type = FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = new Map();
  }
}
export type Entry = File | Directory;
export class EwivFS implements FileSystemProvider {
  constructor() {
    console.log("init");
  }
  root = new Directory("");
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
    for (const [name, child] of entry.entries) {
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
    const entry = new Directory(basename);
    parent.entries.set(entry.name, entry);
    parent.mtime = Date.now();
    parent.size += 1;
    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Created, uri }
    );
  }
  readFile(uri: Uri): Uint8Array {
    const data = this._lookupFile(uri, false).data;
    if (data) {
      return data;
    }
    throw FileSystemError.FileNotFound(uri);
  }
  createFile(uri: Uri, content: Uint8Array): void {
    this._createDirectory(uri.with({ path: path.posix.dirname(uri.path) }));
    this.writeFile(uri, content, { create: true, overwrite: false });
  }
  writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
    const basename = path.posix.basename(uri.path);
    const parent = this._lookupParentDirectory(uri);
    let entry = parent.entries.get(basename);
    if (entry instanceof Directory) {
      throw FileSystemError.FileIsADirectory(uri);
    }
    if (!entry && !options.create) {
      throw FileSystemError.FileNotFound(uri);
    }
    if (entry && options.create && !options.overwrite) {
      throw FileSystemError.FileExists(uri);
    }
    if (!entry) {
      entry = new File(basename);
      parent.entries.set(basename, entry);
    } else {
      entry.mtime = Date.now();
    }
    entry.size = content.byteLength;
    entry.data = content;
    this._fireSoon({ type: FileChangeType.Changed, uri });
    return;
  }
  delete(uri: Uri): void {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    const basename = path.posix.basename(uri.path);
    const parent = this._lookupDirectory(dirname, false);
    if (!parent.entries.has(basename)) {
      throw FileSystemError.FileNotFound(uri);
    }
    parent.entries.delete(basename);
    parent.mtime = Date.now();
    parent.size = -1;
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
    oldParent.entries.delete(entry.name);
    entry.name = newName;
    newParent.entries.set(newName, entry);
    this._fireSoon(
      { type: FileChangeType.Deleted, uri: oldUri },
      { type: FileChangeType.Created, uri: newUri }
    );
  }
  private _lookup(uri: Uri, silent: false): Entry;
  private _lookup(uri: Uri, silent: boolean): Entry | undefined;
  private _lookup(uri: Uri, silent: boolean): Entry | undefined {
    const parts = uri.path.split("/");
    let entry: Entry = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child: Entry | undefined;
      if (entry instanceof Directory) {
        child = entry.entries.get(part);
      }
      if (!child) {
        if (!silent) {
          throw FileSystemError.FileNotFound(uri);
        } else {
          return undefined;
        }
      }
      entry = child;
    }
    return entry;
  }
  private _createDirectory(uri: Uri): void {
    const parts = uri.path.split("/");
    let entry: Entry = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child: Entry;
      if (entry instanceof File) {
        throw FileSystemError.FileExists(uri);
      }
      if (!entry.entries.has(part)) {
        child = new Directory(part);
        entry.entries.set(child.name, child);
        entry.mtime = Date.now();
        entry.size += 1;
      } else {
        child = <Entry>entry.entries.get(part);
      }
      entry = child;
    }
  }
  private _lookupFile(uri: Uri, silent: boolean): File {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw FileSystemError.FileIsADirectory(uri);
  }
  private _lookupDirectory(uri: Uri, silent: boolean): Directory {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw FileSystemError.FileNotADirectory(uri);
  }
  private _lookupParentDirectory(uri: Uri): Directory {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
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
