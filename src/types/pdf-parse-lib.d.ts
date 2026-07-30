// pdf-parse's package entry runs debug code that reads a bundled test PDF when
// no parent module is detected (which happens under bundlers). Importing the
// library file directly avoids that, but it ships no types for the subpath — so
// we declare a minimal one here.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(data: Buffer | Uint8Array): Promise<PdfParseResult>;
  export default pdfParse;
}
