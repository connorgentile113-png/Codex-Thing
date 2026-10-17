import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {composeHTML} from './ui.mjs';
mkdirSync('dist',{recursive:true});
const source=readFileSync('worker.js','utf8').replace('const HTML = "__HTML__";',()=> 'const HTML = '+JSON.stringify(composeHTML())+';');
buildSync({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'worker.js'},outfile:'dist/worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
console.log('Built Worker with bundled Firebase transport and Markdown.');
