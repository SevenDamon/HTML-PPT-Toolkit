export function hasEditor(html){return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].some(([,attrs,code])=>!/application\/json/i.test(attrs)&&(/\bsrc=["'][^"']*html-ppt-(?:editor|frame-adapter)\.js(?:[?"'])/i.test(attrs)||/global\.HtmlPptEditor\s*=/.test(code)))}
export function studioDocument(html,assets){
 if(!hasEditor(html))return null;
 if(assets){
  // Refresh only the known shared SDK. Keep host initialization and course scripts intact.
  const script=assets.js.replace(/<\/script/gi,'<\\/script');
  html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(whole,attrs,code)=>{
   if(/\bid=["']editor-bundle["']/i.test(attrs)&&/application\/json/i.test(attrs)){try{const bundle=JSON.parse(code);bundle.js=assets.js;bundle.css=assets.css;return '<script'+attrs+'>'+JSON.stringify(bundle).replace(/<\/script/gi,'<\\/script')+'</script>'}catch{return whole}}
   if(/application\/json/i.test(attrs))return whole;
   if(/\bsrc=["'][^"']*html-ppt-editor\.js(?:[?][^"']*)?["']/i.test(attrs))return '<script'+attrs.replace(/\s*src=["'][^"']*["']/i,'')+'>'+script+'</script>';
   if(/^\s*\(function\s*\(global\)\s*\{/.test(code)&&/global\.HtmlPptEditor\s*=/.test(code)){const end=code.indexOf('})(window);',code.indexOf('global.HtmlPptEditor'));if(end>=0)return '<script'+attrs+'>'+script+code.slice(end+11)+'</script>'}
   return whole;
  });
  html=html.replace(/<link\b[^>]*\bhref=["'][^"']*html-ppt-editor\.css(?:[?][^"']*)?["'][^>]*>/gi,()=>'<style data-shared-editor>'+assets.css+'</style>')
   .replace(/(<style\b[^>]*\bdata-shared-editor\b[^>]*>)[\s\S]*?<\/style>/gi,(_,open)=>open+assets.css+'</style>');
 }
 html=html.replace(/\s*<script\b[^>]*\bdata-html-ppt-profile\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/\s*<script\b[^>]*\bdata-hppt-studio-config\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const config='window.HTML_PPT_EDITOR_PROFILE="full";window.HTML_PPT_EDITOR_CONFIG=Object.assign({},window.HTML_PPT_EDITOR_CONFIG||{},{profile:"full",features:Object.assign({},window.HTML_PPT_EDITOR_CONFIG&&window.HTML_PPT_EDITOR_CONFIG.features,{saveSource:true,pdf:true,pptx:true,exportHtml:true,pageTools:true})});';
 // One persistent profile marker; temporary overrides run before existing runtimes, never add a second editor.
 html=html.replace(/<\/head>/i,'<script data-html-ppt-profile>'+config+'</script>\n</head>');
 html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(whole,attrs,code)=>/application\/json/i.test(attrs)?whole:(/\bsrc=["'][^"']*html-ppt-(?:editor|frame-adapter)\.js/i.test(attrs)||/global\.HtmlPptEditor\s*=/.test(code))?'<script data-hppt-injected data-hppt-studio-config>'+config+'</script>'+whole:whole);
 return html.replace(/<\/body>/i,'<script data-hppt-injected data-hppt-studio-config>'+config+'</script>\n</body>');
}
