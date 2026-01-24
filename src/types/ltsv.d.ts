declare module 'ltsv' {
  export function parse(text: string): Record<string, string>[];
  export function format(records: Record<string, string>[]): string;
}
