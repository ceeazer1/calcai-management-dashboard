// Simple client-side include for the sidebar across pages
(function(){
  async function includeFragments(){
    const nodes = document.querySelectorAll('[data-include]');
    await Promise.all(Array.from(nodes).map(async (el)=>{
      const url = el.getAttribute('data-include');
      try{
        const res = await fetch(url, { credentials: 'same-origin' });
        if(res.ok){ el.outerHTML = await res.text(); }
      }catch(e){ console.warn('include failed for', url, e); }
    }));
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', includeFragments);
  else includeFragments();
})();

