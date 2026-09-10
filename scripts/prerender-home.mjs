import fs from 'node:fs';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
try {
 const {default:CashWorkspace}=await server.ssrLoadModule('/src/cash-workspace/CashWorkspace.jsx');
 const html=fs.readFileSync('dist/index.html','utf8');
 fs.writeFileSync('dist/legacy-index.html',html);
 const markup=renderToString(React.createElement(CashWorkspace));
 const styles=fs.readdirSync('dist/assets').filter(f=>/^CashWorkspace.*\.css$/.test(f));
 fs.writeFileSync('dist/bondsba-index.html',html.replace('<div id="root"></div>',`<div id="root">${markup}</div>`).replace('</head>',styles.map(f=>`<link rel="stylesheet" href="/assets/${f}">`).join('\n')+'\n</head>'));
 const clearpathTitle = 'SBA Guaranty Readiness | ClearPath — Powered by BondSBA';
 const clearpathDescription = 'Prepare cleaner SBA guaranty-backed loan submissions with eligibility, document checklist, repayment readiness, and lender packet support.';
 const clearpathMarkup = '<main style="max-width:1000px;margin:80px auto;padding:24px;font-family:system-ui"><p>ClearPath · Powered by BondSBA</p><h1>SBA loan readiness, from first estimate to lender review.</h1><p>' + clearpathDescription + '</p><nav aria-label="SBA tools"><a href="/sba-loan-calculator">Loan calculator</a> · <a href="/sba-eligibility-screener">Eligibility screener</a> · <a href="/sba-document-checklist">Document checklist</a></nav><p>Planning tools do not guarantee approval. Your lender makes the credit decision.</p></main>';
 const clearpathHtml = html
  .replace(/<script>([\s\S]*?)<\/script>/g, '')
  .replace(/<title>[\s\S]*?<\/title>/, '<title>' + clearpathTitle + '</title>')
  .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*/g, '$1' + clearpathDescription)
  .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*/g, '$1' + clearpathTitle)
  .replaceAll('https://bondsba.com/', 'https://clearpathsbaloan.com/')
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">' + JSON.stringify({'@context':'https://schema.org','@type':'WebSite',name:'ClearPath',url:'https://clearpathsbaloan.com/'}) + '</script>')
  .replace('<div id="root"></div>', '<div id="root">' + clearpathMarkup + '</div>');
 fs.writeFileSync('dist/clearpath-index.html', clearpathHtml);
 // With no default index file, explicit host rewrites run instead of a shared static homepage.
 fs.unlinkSync('dist/index.html');
 console.log('Generated separate BondSBA and ClearPath homepages.');
} finally { await server.close(); }
