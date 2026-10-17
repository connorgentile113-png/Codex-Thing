"""Optional browser regression test: pip install playwright; use CHROMIUM_PATH if needed."""
import asyncio,json,os,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=subprocess.check_output(['node','--input-type=module','-e',"import {composeHTML} from './scripts/ui.mjs'; process.stdout.write(composeHTML())"],cwd=ROOT,text=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def route(request):
   if '/api/' in request.request.url:await request.fulfill(status=401,content_type='application/json',body='{"error":"Sign in"}')
   else:await request.fulfill(content_type='text/html',body=HTML)
  await page.route('https://forge.test/**',route)
  await page.goto('https://forge.test/',wait_until='networkidle')
  result=await page.evaluate('''() => {
    const raw='# Heading\\n\\n**Bold** and *italic* with `inline`\\n\\n- Item\\n\\n1. Ordered\\n\\n```js\\nconsole.log("<safe>");\\n```\\n\\n| Name | Result |\\n| --- | --- |\\n| Cloud | Works |\\n\\n[GitHub](https://github.com)\\n\\n- [x] Done\\n\\n<img src=x onerror="window.XSS=1"><script>window.XSS=2</scr'+'ipt>[bad](javascript:alert(1))<svg onload="window.XSS=3"></svg>';
    const node=document.createElement('div');node.innerHTML=ForgeMarkdown.render(raw);document.body.append(node);
    return {heading:!!node.querySelector('h1'),bold:!!node.querySelector('strong'),italic:!!node.querySelector('em'),lists:node.querySelectorAll('ul,ol').length,table:!!node.querySelector('table'),code:node.querySelector('pre code').textContent,safeLink:node.querySelector('a').rel,disabled:node.querySelector('input').disabled,unsafe:node.querySelectorAll('script,img,svg,[onerror],[onload],a[href^="javascript:"]').length,xss:window.XSS||0};
  }''')
  assert result['heading'] and result['bold'] and result['italic'] and result['table'] and result['lists']==3,result
  assert '<safe>' in result['code'] and 'noopener' in result['safeLink'] and result['disabled'],result
  assert result['unsafe']==0 and result['xss']==0 and not errors,(result,errors)
  print('Markdown formatting and malicious-HTML regression checks passed.')
  await browser.close()
asyncio.run(main())
