import "server-only";

export async function getVerifiedPdfPageCount(data: Uint8Array) {
  if (data.byteLength < 8 || data.byteLength > 25 * 1024 * 1024) throw new Error("PDF size is invalid.");
  const header = new TextDecoder().decode(data.subarray(0, 5));
  if (header !== "%PDF-") throw new Error("The uploaded file is not a PDF.");

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data, useSystemFonts: false, disableFontFace: true });
  try {
    const document = await task.promise;
    const pageCount = document.numPages;
    await task.destroy();
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 10_000) throw new Error("PDF page count is outside the supported range.");
    return pageCount;
  } catch {
    throw new Error("We could not read this PDF. Password-protected or damaged files are not supported.");
  }
}
