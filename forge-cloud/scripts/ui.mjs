import {buildSync} from 'esbuild';
import {readFileSync} from 'node:fs';
export function composeHTML(){
 const bundle=buildSync({entryPoints:['server/firebase-client.js'],bundle:true,write:false,format:'iife',globalName:'ForgeFirebase',minify:true,target:'es2022'}).outputFiles[0].text;
 const scripts=['node_modules/marked/lib/marked.umd.js','node_modules/dompurify/dist/purify.min.js','public/markdown.js'];
 const libraries=scripts.map(path=>'<script>'+readFileSync(path,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>').join('\n');
 return readFileSync('public/index.html','utf8').replace('<!-- MARKDOWN_LIBRARIES -->',()=>libraries+'\n<script>'+bundle.replace(/<\/script/gi,'<\\/script')+'</script>');
}
