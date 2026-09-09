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
 fs.writeFileSync('dist/index.html',html.replace('<div id="root"></div>',`<div id="root">${markup}</div>`).replace('</head>',styles.map(f=>`<link rel="stylesheet" href="/assets/${f}">`).join('\n')+'\n</head>'));
 console.log('Pre-rendered contractor homepage; preserved ClearPath entry.');
} finally { await server.close(); }
