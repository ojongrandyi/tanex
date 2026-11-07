// French typography (CONTENT_FR header): a non-breaking space before ":" and inside « »,
// a narrow non-breaking space before ";", "!" and "?". DOM-free; shared with the server.

const NBSP = ' ';
const NNBSP = ' ';

/** Replaces the ordinary space before French high punctuation with the right non-breaking one. */
export function frenchSpacing(text: string): string {
  return text
    .replace(/[   ]+:/g, `${NBSP}:`)
    .replace(/[   ]+([;!?])/g, `${NNBSP}$1`)
    .replace(/«[   ]*/g, `«${NBSP}`)
    .replace(/[   ]*»/g, `${NBSP}»`);
}
