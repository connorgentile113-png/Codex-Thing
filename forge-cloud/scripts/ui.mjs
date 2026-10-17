import {readFileSync} from 'node:fs';
export function composeHTML(){
 const scripts=['node_modules/marked/lib/marked.umd.js','node_modules/dompurify/dist/purify.min.js','public/markdown.js'];
 const libraries=scripts.map(path=>'<script>'+readFileSync(path,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>').join('\n');
 return readFileSync('public/index.html','utf8').replace('<!-- MARKDOWN_LIBRARIES -->',()=>libraries);
}
