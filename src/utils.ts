import { Uri } from "vscode";

export const sign = (num: number): string =>
  num > 0 ? `+${num}` : String(num);
export const toPositive = (str: string): number => {
  const num = parseInt(str);
  return num > 0 ? num : -num;
};
export const toNegative = (str: string): number => {
  return -toPositive(str);
};
export interface UriInfo {
  siteName: string;
  pageName: string;
  history?: number;
}
export const parseUri = (uri: Uri): UriInfo => {
  const paths = uri.path.split("/");
  return {
    siteName: paths[1],
    pageName: paths.slice(2).join("/"),
    history: parseInt(uri.query),
  };
};
