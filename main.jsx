import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, Atom, BarChart3, BookOpen, CheckCircle2, ChevronRight, CircleHelp, Compass, Download, FlaskConical, Gauge, HeartPulse, Home, Info, Layers3, Menu, RadioTower, RefreshCw, ShieldCheck, SlidersHorizontal, Sparkles, Target, Waves, X } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line, Legend } from 'recharts';
import './styles.css';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const pages = [
  {id:'home',label:'Home',icon:Home},
  {id:'top3',label:'Top 3 candidates',icon:Target},
  {id:'predict',label:'Try a prediction',icon:Sparkles},
  {id:'compare',label:'Compare performance',icon:BarChart3},
  {id:'radiation',label:'Radiation patterns',icon:Waves},
  {id:'validation',label:'Model validation',icon:ShieldCheck},
];
const configs = ['Conventional','S1_OFF','S1_ON','S2_OFF','S2_ON','S3_OFF','S3_ON','S4_OFF','S4_ON','S5_OFF','S5_ON','Slot','Split'];
const fmt = (v,n=3) => Number.isFinite(Number(v)) ? Number(v).toFixed(n) : '—';
function App(){
  const [page,setPage] = useState('home');
  const [mode,setMode] = useState('beginner');
  const [mobileNav,setMobileNav] = useState(false);
  const [health,setHealth] = useState(null);
  const [ml,setMl] = useState([]);
  const [evidence,setEvidence] = useState([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [config,setConfig] = useState('S5_OFF');
  const [freq,setFreq] = useState(17.910);
  const [prediction,setPrediction] = useState(null);
  const [advanced,setAdvanced] = useState(false);
  const [radReady,setRadReady] = useState(false);
  const [val,setVal] = useState(null);

  async function getJson(path){
    const r = await fetch(`${API}${path}`);
    const j = await r.json().catch(()=>({detail:'The server returned an unreadable response.'}));
    if(!r.ok) throw new Error(j.detail || `Request failed (${r.status})`);
    return j;
  }
  useEffect(()=>{
    getJson('/api/health').then(setHealth).catch(()=>setHealth({status:'offline',models_loaded:false,rankings_loaded:false}));
    getJson('/api/rankings?kind=ml').then(d=>setMl(d.rows||[])).catch(()=>setMl([]));
    getJson('/api/rankings?kind=evidence').then(d=>setEvidence(d.rows||[])).catch(()=>setEvidence([]));
    getJson('/api/validation').then(setVal).catch(()=>setVal(null));
    getJson('/api/radiation').then(d=>setRadReady((d.images||[]).length>0)).catch(()=>setRadReady(false));
  },[]);
  const bestRows = evidence.length ? evidence.slice(0,3) : [];
  const predictionSupported = health?.models_loaded;
  async function runPrediction(e){
    e?.preventDefault(); setBusy(true); setError(''); setPrediction(null);
    try { const result = await getJson('/api/predict'); /* ensure same API helper semantics */ }
    catch(_) {}
    try {
      const r = await fetch(`${API}/api/predict`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({configuration:config,frequency_GHz:Number(freq)})});
      const j = await r.json();
      if(!r.ok) throw new Error(j.detail || 'Prediction is unavailable.');
      setPrediction(j);
    } catch(err){ setError(err.message || 'Could not reach the prediction service.'); }
    finally {setBusy(false);}
  }
  function go(id){setPage(id);setMobileNav(false);window.scrollTo({top:0,behavior:'smooth'});}
  const title = pages.find(p=>p.id===page)?.label || 'Home';
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'open':''}`}>
      <div className="brand"><div className="brand-mark"><RadioTower size={23}/></div><div><b>Antenna<span>Lab</span></b><small>ML intelligence</small></div><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)} aria-label="Close navigation"><X/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{pages.map(p=><button key={p.id} className={`nav-link ${page===p.id?'active':''}`} onClick={()=>go(p.id)}><p.icon size={18}/><span>{p.label}</span>{page===p.id&&<ChevronRight size={16} className="nav-arrow"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="mini-illustration"><Atom size={25}/><div><b>Curious about antennas?</b><p>Explore the results at your own pace.</p></div></div><div className="api-status"><span className={`status-dot ${health?.status==='ok'?'online':''}`}/>{health?.status==='ok'?'Analysis service connected':'Connecting to analysis service'}</div></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Open navigation"><Menu/></button><div className="crumb">AntennaLab <ChevronRight size={14}/><b>{title}</b></div><div className="mode-switch"><span>View mode</span><button className={mode==='beginner'?'selected':''} onClick={()=>setMode('beginner')}>Simple</button><button className={mode==='technical'?'selected':''} onClick={()=>setMode('technical')}>Technical</button></div></header>
      <div className="content">
        {page==='home'&&<HomePage go={go} health={health} ml={ml} evidence={evidence}/>}
        {page==='top3'&&<TopPage rows={bestRows} ml={ml} evidence={evidence} mode={mode}/>}
        {page==='predict'&&<PredictPage config={config} setConfig={setConfig} freq={freq} setFreq={setFreq} runPrediction={runPrediction} busy={busy} prediction={prediction} error={error} advanced={advanced} setAdvanced={setAdvanced} mode={mode} supported={predictionSupported}/>}
        {page==='compare'&&<ComparePage ml={ml} evidence={evidence} mode={mode}/>}
        {page==='radiation'&&<RadiationPage ready={radReady} mode={mode}/>}
        {page==='validation'&&<ValidationPage data={val} mode={mode}/>}
        <footer><span>ML-Based Reconfigurable Planar Antenna</span><span>Predictions are estimates · HFSS remains the simulation reference</span></footer>
      </div>
    </main>
  </div>
}
function PageIntro({eyebrow,title,desc,icon:Icon}){return <div className="page-intro"><div className="intro-icon"><Icon size={22}/></div><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div></div>}
function HomePage({go,health,ml,evidence}){
 return <><section className="hero"><div className="hero-copy"><div className="pill"><Sparkles size={14}/> Explore antenna performance</div><h1>Good antenna decisions<br/><span>start with clear insights.</span></h1><p>A friendly space to explore antenna configurations, understand performance, and see what machine learning can estimate — without needing to be an expert.</p><div className="hero-actions"><button className="btn primary" onClick={()=>go('top3')}>Explore top candidates <ArrowRight size={17}/></button><button className="btn secondary" onClick={()=>go('predict')}>Try a prediction</button></div><div className="trust-line"><CheckCircle2 size={15}/> Uses saved project data and models when available</div></div><div className="hero-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="antenna-drawing"><div className="antenna-top"/><div className="antenna-stem"/><div className="antenna-base"/><div className="wave wave1"/><div className="wave wave2"/><div className="wave wave3"/></div><div className="floating-chip chip-one"><Activity size={15}/> Performance</div><div className="floating-chip chip-two"><Waves size={15}/> Radiation</div></div></section>
 <div className="section-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h2>What would you like to explore?</h2></div><span className="soft-label">Choose a starting point</span></div>
 <div className="feature-grid">
  <Feature icon={Target} color="peach" title="Find the top 3" desc="Explore the leading candidates from the saved evidence ranking." action="View candidates" click={()=>go('top3')}/>
  <Feature icon={Sparkles} color="lilac" title="Try ML prediction" desc="Choose a configuration and frequency to estimate performance." action="Open predictor" click={()=>go('predict')}/>
  <Feature icon={BarChart3} color="mint" title="Compare results" desc="Put available candidate results side by side." action="Compare data" click={()=>go('compare')}/>
  <Feature icon={Waves} color="blue" title="Explore radiation" desc="View the available angular-cut comparison plots." action="View patterns" click={()=>go('radiation')}/>
 </div>
 <div className="bottom-grid"><div className="card status-card"><div className="card-heading"><div className="round-icon mint"><Layers3 size={18}/></div><div><h3>Project data status</h3><p>Live status from the analysis service</p></div></div><div className="status-row"><span>ML models</span><b className={health?.models_loaded?'text-good':'text-muted'}>{health?.models_loaded?'Available':'Not connected'}</b></div><div className="status-row"><span>Ranking tables</span><b className={health?.rankings_loaded?'text-good':'text-muted'}>{health?.rankings_loaded?'Available':'Not connected'}</b></div><div className="status-row"><span>Evidence candidates</span><b>{evidence.length || '—'}</b></div><p className="tiny-note">If files are not connected yet, the app shows a clear message rather than made-up results.</p></div><div className="card how-card"><div className="card-heading"><div className="round-icon peach"><BookOpen size={18}/></div><div><h3>New to antenna analysis?</h3><p>That's completely okay.</p></div></div><div className="how-step"><span>1</span><div><b>Pick a configuration</b><p>Each option represents a different antenna design or switch state.</p></div></div><div className="how-step"><span>2</span><div><b>Understand the metrics</b><p>Short explanations help translate technical results into plain language.</p></div></div><div className="how-step"><span>3</span><div><b>Check the evidence</b><p>Predictions are clearly separated from HFSS-derived results.</p></div></div></div></div>
 </>
}
function Feature({icon:Icon,color,title,desc,action,click}){return <button className="feature-card" onClick={click}><div className={`round-icon ${color}`}><Icon size={20}/></div><h3>{title}</h3><p>{desc}</p><span>{action}<ArrowRight size={15}/></span></button>}
function EmptyState({title,desc}){return <div className="empty-state"><div className="empty-icon"><CircleHelp size={25}/></div><h3>{title}</h3><p>{desc}</p></div>}
function TopPage({rows,ml,evidence,mode}){
 const [kind,setKind]=useState('evidence');
 const data=kind==='evidence'?evidence:ml;
 const configKey=data.length?Object.keys(data[0]).find(k=>/configuration|config/i.test(k)):null;
 const freqKey=data.length?Object.keys(data[0]).find(k=>/frequency/i.test(k)):null;
 return <><PageIntro eyebrow="CANDIDATE SHORTLIST" title="Meet the leading candidates" desc="A quick, understandable view of the best-ranked options in the saved project results." icon={Target}/><div className="segmented"><button className={kind==='evidence'?'on':''} onClick={()=>setKind('evidence')}>Simulation/radiation evidence</button><button className={kind==='ml'?'on':''} onClick={()=>setKind('ml')}>ML-predicted ranking</button></div><div className="notice"><Info size={18}/><p><b>Two different kinds of evidence.</b> Simulation/radiation-supported candidates use available project evidence. ML ranking is model-generated and should be treated as a shortlist, not proof of a global optimum.</p></div>
 {data.length? <><div className="candidate-list">{data.slice(0,3).map((r,i)=><div className="candidate-card" key={i}><div className={`rank rank-${i+1}`}>{i+1}</div><div className="candidate-main"><div className="eyebrow">CANDIDATE {String(i+1).padStart(2,'0')}</div><h3>{configKey?r[configKey]:'Configuration label unavailable'}</h3><p>{freqKey&&r[freqKey]!=null?`${fmt(r[freqKey])} GHz · `:''}{kind==='ml'?'ML-predicted ranking':'Available simulation/radiation evidence'}</p></div><div className="candidate-metrics">{Object.entries(r).filter(([k,v])=>/s11|gain|vswr/i.test(k)&&v!==null&&v!==''&&!Number.isNaN(Number(v))).slice(0,3).map(([k,v])=><div key={k}><span>{k.replaceAll('_',' ')}</span><b>{fmt(v)}</b></div>)}</div></div>)}</div><p className="tiny-note">Showing the first three rows in the saved table's order. {mode==='technical'?'The app preserves source ranking order and does not create a new score.':'These are the leading entries in the selected saved list.'}</p><DownloadLink rows={data.slice(0,3)}/></>:<EmptyState title="Ranking data isn't connected yet" desc="Copy the existing ranking CSV files into the backend data/rankings folder, then restart the API. No placeholder results are shown."/>}
 </>
}
function DownloadLink({rows}){return <button className="btn secondary" onClick={()=>{const blob=new Blob([JSON.stringify(rows,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='antenna-candidate-shortlist.json';a.click();URL.revokeObjectURL(a.href)}}><Download size={16}/> Download visible shortlist</button>}
function PredictPage({config,setConfig,freq,setFreq,runPrediction,busy,prediction,error,advanced,setAdvanced,mode,supported}){
 return <><PageIntro eyebrow="ML EXPLORER" title="Try an antenna prediction" desc="Choose an antenna setup and a frequency. The saved ML models will estimate its electrical performance when the model files are connected." icon={Sparkles}/><div className="prediction-layout"><form className="card form-card" onSubmit={runPrediction}><div className="card-heading"><div className="round-icon lilac"><SlidersHorizontal size={18}/></div><div><h3>Your settings</h3><p>Start with just two choices.</p></div></div><label htmlFor="config">Antenna configuration</label><select id="config" value={config} onChange={e=>setConfig(e.target.value)}>{configs.map(c=><option key={c}>{c}</option>)}</select><p className="field-help">The design version or switch state you want to explore.</p><label htmlFor="freq">Frequency (GHz)</label><div className="frequency-input"><input id="freq" type="number" min="1" max="20" step="0.001" value={freq} onChange={e=>setFreq(e.target.value)}/><span>GHz</span></div><input aria-label="Frequency slider" className="range" type="range" min="1" max="20" step="0.01" value={freq} onChange={e=>setFreq(e.target.value)}/><div className="range-labels"><span>1 GHz</span><span>20 GHz</span></div>{mode==='technical'&&<><button type="button" className="advanced-toggle" onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal size={15}/>{advanced?'Hide':'Show'} advanced details</button>{advanced&&<div className="advanced-box"><b>Model input features</b><p>Frequency, switch number, switch state and configuration label are sent to the saved regression models.</p><p>Current supported input interval in the UI: 1–20 GHz. This interval alone does not guarantee reliable predictions at every frequency.</p></div>}</>}<button className="btn primary full" disabled={busy||!supported} type="submit">{busy?<><RefreshCw className="spin" size={16}/> Running model…</>:<><Sparkles size={16}/> Predict performance</>}</button>{!supported&&<p className="field-help warning-text">The backend reports that one or more saved model files are unavailable. Add the real model files to enable predictions.</p>}</form><div className="result-panel"><div className="result-panel-head"><div><div className="eyebrow">YOUR RESULTS</div><h2>{prediction?'Prediction ready':'Your results will appear here'}</h2></div><div className="result-spark"><Gauge size={22}/></div></div>{error&&<div className="error-box">{error}</div>}{prediction?<><div className="result-grid">{[['S11',prediction.S11,'dB','Return loss indicator'],['Gain',prediction.Gain,prediction.gain_unit||'unit not confirmed','Signal strength metric'],['VSWR',prediction.VSWR,'ratio','Matching indicator']].map(([name,value,unit,desc])=><div className="result-metric" key={name}><span>{name}</span><strong>{fmt(value)}</strong><small>{unit}</small><p>{desc}</p></div>)}</div><div className={`notice ${prediction.matching_pass?'good-notice':'warning-notice'}`}><Info size={18}/><p>{prediction.matching_pass?'Predicted S11 and VSWR meet the current matching thresholds.':'The predicted values do not meet both current matching thresholds.'} This is a model estimate, not a new HFSS simulation.</p></div><p className="tiny-note">Input: {prediction.configuration} at {fmt(prediction.frequency_GHz)} GHz. Prediction quality depends on the training data and validation limits.</p></>:<div className="result-placeholder"><div className="placeholder-art"><Gauge size={45}/></div><p>After you run a prediction, we'll show the estimated S11, gain and VSWR here with a plain-language explanation.</p><div className="mini-note"><Info size={16}/> Held-out 18–19 GHz S11 generalization was weak in the current evaluation.</div></div>}</div></div><div className="definition-strip"><div><b>What is S11?</b><p>How much signal is reflected back. More negative values are generally better for matching.</p></div><div><b>What is VSWR?</b><p>A measure of impedance matching. A value closer to 1 is generally better.</p></div><div><b>What is gain?</b><p>A measure of how strongly the antenna directs or radiates energy. Units must be confirmed from the source data.</p></div></div></>
}
function ComparePage({ml,evidence,mode}){
 const [kind,setKind]=useState('evidence'); const [metric,setMetric]=useState('S11');
 const rows=kind==='evidence'?evidence:ml;
 const configKey=rows.length?Object.keys(rows[0]).find(k=>/configuration|config/i.test(k)):null;
 const freqKey=rows.length?Object.keys(rows[0]).find(k=>/frequency/i.test(k)):null;
 const metricKey=rows.length?Object.keys(rows[0]).find(k=>{const l=k.toLowerCase();return l.includes(metric.toLowerCase())&&(kind==='ml'?/pred|estimate|score/.test(l):!/pred/.test(l))}):null;
 const chart=rows.slice(0,10).map((r,i)=>({name:`${configKey?r[configKey]:'Candidate '+(i+1)}${freqKey&&r[freqKey]!=null?' · '+fmt(r[freqKey],2):''}`,value:metricKey?Number(r[metricKey]):null})).filter(x=>Number.isFinite(x.value));
 return <><PageIntro eyebrow="SIDE-BY-SIDE VIEW" title="Compare antenna performance" desc="Choose which data set and metric to inspect. Only fields present in your saved project tables are plotted." icon={BarChart3}/><div className="toolbar"><div className="segmented"><button className={kind==='evidence'?'on':''} onClick={()=>setKind('evidence')}>Simulation evidence</button><button className={kind==='ml'?'on':''} onClick={()=>setKind('ml')}>ML predictions</button></div><select value={metric} onChange={e=>setMetric(e.target.value)} aria-label="Metric"><option>S11</option><option>Gain</option><option>VSWR</option></select></div>{chart.length?<div className="card chart-card"><div className="card-heading"><div><h3>{metric} comparison</h3><p>{kind==='ml'?'Predicted values':'Saved simulation/radiation-supported values'} · first 10 rows</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:10,right:20,bottom:60,left:0}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" angle={-22} textAnchor="end" interval={0} height={78} tick={{fontSize:11}}/><YAxis/><Tooltip/><Bar dataKey="value" name={metric} fill="#8a78dc" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div><p className="tiny-note">Source column: <code>{metricKey}</code>. Values are displayed in the units represented by the source table.</p></div>:<EmptyState title="No comparable numeric column found" desc="Connect the ranking CSVs and check that the selected table contains an S11, gain or VSWR column."/>}{mode==='technical'&&<div className="notice"><Info size={18}/><p>Different metrics use different units and directions. Do not compare raw S11, gain and VSWR values as if they were one common score.</p></div>}</>
}
function RadiationPage({ready,mode}){return <><PageIntro eyebrow="RADIATION EXPLORER" title="See how radiation changes by angle" desc="Explore the two saved angular-cut comparison plots from the project. These help illustrate radiation behaviour without claiming a full 3D pattern." icon={Waves}/>{ready?<div className="radiation-grid">{[{name:'Phi = 0° cut',src:'/api/radiation/phi-0',caption:'Angular cut at phi = 0 degrees.'},{name:'Phi = 90° cut',src:'/api/radiation/phi-90',caption:'Angular cut at phi = 90 degrees.'}].map(p=><div className="card radiation-card" key={p.name}><div className="card-heading"><div><h3>{p.name}</h3><p>{p.caption}</p></div><span className="plot-tag">Saved plot</span></div><img src={`${API}${p.src}`} alt={`${p.name} antenna radiation comparison`} onError={e=>{e.currentTarget.style.display='none'}}/><p className="tiny-note">Existing project plot; candidate frequencies and curves should be interpreted from the original figure labels.</p></div>)}</div>:<EmptyState title="Radiation plots aren't connected yet" desc="Copy radiation_comparison_phi_0.png and radiation_comparison_phi_90.png into backend/data/radiation/."/>}<div className="notice"><Info size={18}/><p><b>Important:</b> Two angular cuts are not a complete 3D radiation pattern. They cannot by themselves prove a universally best radiation configuration.</p></div>{mode==='technical'&&<div className="card"><h3>Technical interpretation</h3><p>Review the plot axes, angular range, normalization and legend in the original saved figure. Do not infer missing pattern samples from the image.</p></div>}</>}
function ValidationPage({data,mode}){const metrics=data?.metrics||[];return <><PageIntro eyebrow="TRUST THE EVIDENCE" title="What can the ML model predict reliably?" desc="Validation helps us understand where the model performs well and where its estimates need caution." icon={ShieldCheck}/><div className="notice warning-notice"><Info size={18}/><p><b>Important limitation:</b> The existing held-out 18–19 GHz evaluation showed weak S11 generalization. Model predictions should be corroborated with HFSS rather than treated as ground truth.</p></div>{metrics.length?<div className="card table-card"><h3>Held-out 18–19 GHz results</h3><div className="responsive-table"><table><thead><tr><th>Target</th><th>MAE</th><th>RMSE</th><th>R²</th></tr></thead><tbody>{metrics.map(m=><tr key={m.target}><td><b>{m.target}</b></td><td>{m.mae}</td><td>{m.rmse}</td><td>{m.r2}</td></tr>)}</tbody></table></div><p className="tiny-note">These are saved evaluation metrics from the existing project work, not a fresh re-training run.</p></div>:<EmptyState title="Validation metrics not connected" desc="The API should load the recorded validation metrics from backend/data/validation.json."/>}<div className="definition-strip"><div><b>MAE</b><p>Average size of prediction errors. Lower is generally better.</p></div><div><b>RMSE</b><p>Penalizes larger errors more strongly. Lower is generally better.</p></div><div><b>R²</b><p>Shows how well predictions explain variation on the evaluated data. A negative value indicates poor performance relative to a mean baseline.</p></div></div>{mode==='technical'&&<div className="card"><h3>Known limitations</h3><ul className="plain-list"><li>Radiation-pattern data are sparse compared with electrical-performance data.</li><li>Gain units/reference should be confirmed from the original export.</li><li>Only phi = 0° and phi = 90° cuts are currently compared.</li><li>A project-defined ranking score is not a universal antenna-quality metric.</li><li>Do not claim experimental validation unless physical measurements were performed.</li></ul></div>}</>}
createRoot(document.getElementById('root')).render(<App/>);
