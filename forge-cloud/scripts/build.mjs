import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
const ui=readFileSync('public/index.html','utf8');
writeFileSync('dist/worker.js',readFileSync('worker.js','utf8').replace('const HTML = "__HTML__";', () => 'const HTML = '+JSON.stringify(ui)+';'));
console.log('Built dependency-free Worker and embedded workspace UI.');
