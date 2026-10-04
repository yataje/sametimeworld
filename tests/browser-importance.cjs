// Optional browser regression: node tests/browser-importance.cjs (requires Playwright Chromium).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const source=fs.readFileSync('src/main.js','utf8'),css=fs.readFileSync('src/style.css','utf8');
const ctx={searchArrivalId:null,seriesState:{active:null},escapeHTML:String,displayTimelinePlace:()=> '서울',eventDetails:()=>({description:'설명'}),eventPrecision:()=> 'day',eventDayComparable:()=>true};
vm.createContext(ctx);
for(const [name,next] of [['timelineCardHTML','timelineRegionCards'],['searchSuggestionHTML','hideSearchSuggestions']])vm.runInContext(source.slice(source.indexOf(`function ${name}(`),source.indexOf(`function ${next}(`)),ctx);
const colors=['rgb(116, 125, 140)','rgb(184, 194, 209)','rgb(79, 195, 247)','rgb(255, 176, 32)','rgb(255, 77, 79)'];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.setContent('<style>'+css+'</style><div id="rows"></div><div class="search-suggestions" id="search"></div>');
   for(const reverse of [false,true]){
    const events=Array.from({length:5},(_,i)=>({id:i+1,date:'1900',title:'사건',category:'정치',importance:reverse?5-i:i+1}));
    ctx.searchArrivalId=3;
    await page.evaluate(({timeline,search})=>{document.querySelector('#rows').innerHTML=timeline;document.querySelector('#search').innerHTML=search;},{timeline:events.map(x=>ctx.timelineCardHTML(x,2)).join(''),search:events.map(x=>ctx.searchSuggestionHTML(x)).join('')});
    for(const selector of ['.event-importance','.ss-meta>span']){
     const actual=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,color:getComputedStyle(n).color})));
     assert.deepEqual(actual,events.map(x=>({text:`★ ${x.importance}`,color:colors[x.importance-1]})));
    }
    assert.equal(await page.locator('.ss-meta').first().innerText(),`정치 · ★ ${events[0].importance}`);
   }
   await page.close();console.log(`PASS: ${width}px, all five colors after initial render and replacement`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
