/* Markdown stays local; sanitize model output before it enters the page. */
window.ForgeMarkdown = {
  render(value) {
    const html = marked.parse(String(value ?? ''), { gfm: true, breaks: false });
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','del','s','blockquote','pre','code','ul','ol','li','a','table','thead','tbody','tr','th','td','input'],
      ALLOWED_ATTR: ['href','title','start','align','type','checked','disabled'],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false
    });
    const template = document.createElement('template');
    template.innerHTML = clean;
    for (const link of template.content.querySelectorAll('a')) {
      const href = link.getAttribute('href');
      if (!href) continue;
      try {
        const url = new URL(href, location.origin);
        if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) { link.removeAttribute('href'); continue; }
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      } catch { link.removeAttribute('href'); }
    }
    for (const input of template.content.querySelectorAll('input')) {
      input.setAttribute('type', 'checkbox');
      input.setAttribute('disabled', '');
    }
    return template.innerHTML;
  }
};
