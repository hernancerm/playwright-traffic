/** The two requests hurlfmt's curl parser cannot read. Nothing here is sent. */

import { curl } from '../mod.ts';

export const uploaded = curl('POST', 'https://example.test/files')
  .form({ a: '1' })
  .assert('status == 200');

export const multiline = curl('POST', 'https://example.test/text')
  .body('line1\nline2')
  .assert('status == 200');
