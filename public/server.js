import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, parse as parseUrl } from 'node:url';

const PORT=8787;
const __filename=fileURLToPath(import.meta.url);
const ROOT=path.dirname(__filename);
const CFG_PATH=path.join(ROOT,'rates-config.json');

function readBody(req){return new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(d));});}
function send(res,status,body,type){res.writeHead(status,{'Content-Type':type||'application/json'});res.end(body);} 
function readCfg(){try{return JSON.parse(fs.readFileSync(CFG_PATH,'utf8'));}catch(e){return {currency:'HKD',service_standard_name:'VKS Standard',service_express_name:'VKS Express',default_threshold_hkd:0,default_fee_hkd:0,default_threshold_op:'lt',express:{type:'multiplier',value:1.5,free_when_standard_free:true},area_overrides:{}}}}
function writeCfg(cfg){fs.writeFileSync(CFG_PATH,JSON.stringify(cfg,null,2),'utf8');}

function getDistricts(){return {regions:{'Hong Kong Island':['Central and Western','Wan Chai','Eastern','Southern'],'Kowloon':['Yau Tsim Mong','Sham Shui Po','Kowloon City','Wong Tai Sin','Kwun Tong'],'New Territories':['Tsuen Wan','Tuen Mun','Yuen Long','North','Tai Po','Sha Tin','Kwai Tsing','Sai Kung','Islands']}}}

function inDateRange(now,from,to){if(from){const f=new Date(from);if(now<f)return false}if(to){const t=new Date(to);if(now>t)return false}return true}
function pickOverride(cfg,country,region,district){const ov=cfg.area_overrides||{};const keys=[`${(country||'HK')}/${region||''}/${district||''}`.toLowerCase(),`${(country||'HK')}/${region||''}`.toLowerCase(),`${(country||'HK')}`.toLowerCase(),`${district||''}`.toLowerCase(),`${region||''}`.toLowerCase()];for(const k of keys){if(ov[k])return ov[k]}return null}
function shouldApply(op,threshold,subtotal){if(typeof threshold!=='number')return false;if((op||'lt')==='lt')return subtotal<threshold;return subtotal>=threshold}
function calcRates(cfg,body){const dest=(body.rate&&body.rate.destination)||{};const items=(body.rate&&body.rate.items)||[];let subtotalHkd=0,grams=0,count=0;items.forEach(i=>{subtotalHkd+=(i.price||0)/100*(i.quantity||0);grams+=(i.grams||0)*(i.quantity||0);count+=(i.quantity||0)});const district=(dest.city||'').toLowerCase();const region=(dest.province||dest.region||'').toLowerCase();const override=pickOverride(cfg,'HK',region,district)||{};const now=new Date();let std=0;if(override.active!==false&&(!override.min_weight_grams||grams>=override.min_weight_grams)&&(!override.max_weight_grams||grams<=override.max_weight_grams)&&(!override.min_items||count>=override.min_items)&&(!override.max_items||count<=override.max_items)&&inDateRange(now,override.active_from,override.active_to)){const op=override.threshold_op||cfg.default_threshold_op||'lt';const th=typeof override.threshold_hkd==='number'?override.threshold_hkd:(cfg.default_threshold_hkd||0);const fe=typeof override.fee_hkd==='number'?override.fee_hkd:(cfg.default_fee_hkd||0);std= th===0?fe:(shouldApply(op,th,subtotalHkd)?fe:0)}const exp=(override.express||cfg.express||null);let ex=null;if(exp){if(exp.free_when_standard_free&&std===0){ex=0}else if((exp.type||'multiplier')==='multiplier'){ex=Math.round(std*(exp.value||1))}else{ex=Math.round(exp.value||0)}}const currency=(cfg.currency||'HKD');const rates=[];rates.push({service_name:(cfg.service_standard_name||'VKS Standard'),service_code:'standard',currency,total_price:Math.round(std*100)});if(ex!==null){rates.push({service_name:(cfg.service_express_name||'VKS Express'),service_code:'express',currency,total_price:Math.round(ex*100)})}return {rates}}

function parseCSV(text){const lines=text.split(/\r?\n/).filter(l=>l.trim().length>0);if(lines.length===0)return [];
  let start=0;const header=lines[0].toLowerCase();if(header.includes('district')||header.includes('region')||header.includes('threshold'))start=1;
  const rows=[];for(let i=start;i<lines.length;i++){const raw=lines[i];const parts=raw.split(',').map(s=>s.trim().replace(/^"|"$/g,''));if(parts.length<3)continue;const country=(parts[0]||'HK');const region=(parts[1]||'');const district=(parts[2]||'');const threshold=parts[3]?Number(parts[3]):NaN;const fee=parts[4]?Number(parts[4]):NaN;const active=parts[5]?String(parts[5]).toLowerCase()!=='false':true;rows.push({country,region,district,threshold_hkd:Number.isNaN(threshold)?undefined:threshold,fee_hkd:Number.isNaN(fee)?undefined:fee,active});}
  return rows;
}

function serveStatic(req,res,p){let f=path.join(ROOT,decodeURIComponent(p));if(f.endsWith('/'))f=path.join(f,'index.html');if(!f.startsWith(ROOT))return send(res,403,'Forbidden','text/plain');fs.stat(f,(e,st)=>{if(e||!st.isFile())return send(res,404,'Not Found','text/plain');const ext=path.extname(f).toLowerCase();const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.xml':'application/xml','.txt':'text/plain','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};fs.readFile(f,(err,data)=>{if(err)return send(res,500,'Error','text/plain');send(res,200,data,types[ext]||'application/octet-stream')});});}

const server=http.createServer(async(req,res)=>{
  const u=parseUrl(req.url,true);
  if(req.method==='GET'&&u.pathname==='/config/rates'){const cfg=readCfg();return send(res,200,JSON.stringify(cfg));}
  if(req.method==='PUT'&&u.pathname==='/config/rates'){const body=await readBody(req);let cfg;try{cfg=JSON.parse(body||'{}');}catch(e){cfg=readCfg();}writeCfg(cfg);return send(res,200,JSON.stringify(cfg));}
  if(req.method==='POST'&&u.pathname==='/config/rates/import-csv'){const text=await readBody(req);const rows=parseCSV(text||'');const cfg=readCfg();cfg.area_overrides=cfg.area_overrides||{};rows.forEach(r=>{const key=(r.country+'/'+r.region+'/'+r.district).toLowerCase();cfg.area_overrides[key]={country:r.country,region:r.region,district:r.district,active:r.active};if(typeof r.threshold_hkd==='number')cfg.area_overrides[key].threshold_hkd=r.threshold_hkd; if(typeof r.fee_hkd==='number')cfg.area_overrides[key].fee_hkd=r.fee_hkd;});writeCfg(cfg);return send(res,200,JSON.stringify(cfg));}
  if(req.method==='GET'&&u.pathname==='/hk/districts'){return send(res,200,JSON.stringify(getDistricts()));}
  if(req.method==='GET'&&u.pathname==='/spec'){try{const p=path.join(ROOT,'VKS Shipping Rate apps User Requirement.xml');const data=fs.readFileSync(p,'utf8');const msg=(data.slice(0,2048)||'');return send(res,200,JSON.stringify({text:msg}));}catch(e){return send(res,200,JSON.stringify({text:'Open the XML via the link on the right panel.'}));}}
  if(req.method==='POST'&&u.pathname==='/carrier/rates'){const body=await readBody(req);let json={};try{json=JSON.parse(body||'{}');}catch(e){}const cfg=readCfg();const out=calcRates(cfg,json);return send(res,200,JSON.stringify(out));}
  return serveStatic(req,res,u.pathname);
});

server.listen(PORT,()=>{console.log('listening on http://localhost:'+PORT+'/');});
