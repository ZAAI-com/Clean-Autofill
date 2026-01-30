declare module 'psl' {
  interface ParsedDomain {
    tld: string | null;
    sld: string | null;
    domain: string | null;
    subdomain: string | null;
    listed: boolean;
    input: string;
    error?: { code: string; message: string };
  }

  function parse(domain: string): ParsedDomain;
  function get(domain: string): string | null;
  function isValid(domain: string): boolean;

  export { parse, get, isValid, ParsedDomain };

  const psl: { parse: typeof parse; get: typeof get; isValid: typeof isValid };
  export default psl;
}
