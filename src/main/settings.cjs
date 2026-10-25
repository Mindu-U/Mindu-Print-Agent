const fs = require('node:fs/promises');
const path = require('node:path');
function validate(value) {
  if (!value || typeof value.printer !== 'string' || value.printer.length > 512 || ![58, 80].includes(value.width)) throw new Error('Choose a printer and a supported paper width.');
  return { printer: value.printer, width: value.width };
}
async function read(file) {
  try { return validate(JSON.parse(await fs.readFile(file, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT') return { printer: '', width: 80 };
    throw new Error('Saved settings could not be read. Select your printer and save again.');
  }
}
async function write(file, value) {
  const settings = validate(value);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file + '.tmp', JSON.stringify(settings), 'utf8');
  await fs.rename(file + '.tmp', file);
  return settings;
}
module.exports = { validate, read, write };
