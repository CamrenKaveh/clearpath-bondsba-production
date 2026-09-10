import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const target=process.env.TEST_URL||'http://127.0.0.1:4191';
const b=await chromium.launch({headless:true,channel:'chrome'});
try{
 const p=await b.newPage();await p.route('https://**/*',r=>new URL(r.request().url()).host===new URL(target).host?r.continue():r.abort());
 await p.goto(target+'/wip-schedule-errors',{waitUntil:'networkidle'});
 await p.getByRole('link',{name:'Open the WIP check',exact:true}).first().click();
 await p.getByRole('heading',{name:'Bring your spreadsheet. Check the totals.'}).waitFor();assert.equal(await p.getByRole('tab',{name:/WIP check/}).getAttribute('aria-selected'),'true');
 await p.getByRole('textbox',{name:'Job name',exact:true}).first().fill('Guide entry test');await p.getByRole('button',{name:'Save on browser',exact:true}).click();
 await p.reload({waitUntil:'networkidle'});assert.equal(await p.getByRole('textbox',{name:'Job name',exact:true}).first().inputValue(),'Guide entry test');
 await p.goto(target+'/?view=unknown#workspace',{waitUntil:'networkidle'});assert.equal(await p.getByRole('tab',{name:/Cash forecast/}).getAttribute('aria-selected'),'true');
 await p.goto(target+'/?view=wip#workspace',{waitUntil:'networkidle'});assert.equal(await p.getByRole('textbox',{name:'Job name',exact:true}).first().inputValue(),'Guide entry test');
 console.log('PASS guide CTA opens WIP, reload retains view and saved job, unknown view defaults to cash.');
}finally{await b.close();}
