const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const settings = require('../src/main/settings.cjs');
test('reject unsupported settings and strip extra properties', () => {
  for (const value of [null, {}, {printer:'x',width:70}, {printer:12,width:80}]) assert.throws(() => settings.validate(value));
  assert.deepEqual(settings.validate({printer:'Kitchen',width:58,html:'bad'}), {printer:'Kitchen',width:58});
});
test('settings survive restart, missing and corrupt settings handled distinctly', async () => {
  const dir = await fs.mkdtemp(path.join(__dirname,'mindu-test-'));
  const file = path.join(dir,'printer.json');
  try {
    assert.deepEqual(await settings.read(file), {printer:'',width:80});
    await settings.write(file, {printer:'სამზარეულო',width:80});
    assert.deepEqual(await settings.read(file), {printer:'სამზარეულო',width:80});
    await fs.writeFile(file, '{bad');
    await assert.rejects(settings.read(file), /could not be read/);
  } finally { await fs.rm(dir, {recursive:true,force:true}); }
});

