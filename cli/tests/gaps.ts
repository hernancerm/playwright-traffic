/** The two requests hurlfmt's curl parser cannot read. Nothing here is sent. */

import { curl, type Registry } from '@curler/builder';

const R: Registry = {};

R['uploaded'] = curl('POST', 'https://example.test/files')
  .form({ a: '1' })
  .assert('status == 200');

R['multiline'] = curl('POST', 'https://example.test/text')
  .body('line1\nline2')
  .assert('status == 200');

export default R;
