export const sign = (num: number): string =>
  num > 0 ? `+${num}` : String(num);
