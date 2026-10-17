import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {composeHTML} from './ui.mjs';
mkdirSync('dist',{recursive:true});
const ui=composeHTML();
writeFileSync('dist/worker.js',readFileSync('worker.js','utf8').replace('const HTML = "__HTML__";', () => 'const HTML = '+JSON.stringify(ui)+';'));
console.log('Built Worker with embedded Markdown parser and sanitizer.');
