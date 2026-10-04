'use client';

import { useEffect, useRef, useState } from 'react';
import { EvidenceGraph } from './EvidenceGraph';
import type { AnalysisResult } from '@/lib/types';

type ServiceStatus = { llm: boolean; publicRecords: boolean; voice: boolean };

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<ServiceStatus>({ llm: false, publicRecords: false, voice: false });
  const [activeTab, setActiveTab] = useState<'symptoms' | 'chain'>('symptoms');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const progressIndicator = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const range = document.documentElement.scrollHeight - window.innerHeight;
        const progress = range > 0 ? Math.min(100, (window.scrollY / range) * 100) : 0;
        progressIndicator.current?.style.setProperty('transform', `scaleX(${progress / 100})`);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('motion-ready');
    const items = [...document.querySelectorAll<HTMLElement>('.reveal-on-scroll:not(.is-visible)')];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: '0px 0px -36px 0px' });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [result, activeTab]);

  async function demo() {
    await run('/api/demo');
  }

  async function cleanDemo() {
    await run('/api/demo?case=clean');
  }

  async function run(url: string, files?: File[]) {
    setBusy(true);
    setError('');
    try {
      let response: Response;
      if (files) {
        const fd = new FormData();
        files.forEach((file) => fd.append('files', file));
        fd.set('primaryIndex', '0');
        response = await fetch('/api/analyze', { method: 'POST', body: fd });
      } else {
        response = await fetch(url);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The analysis could not be completed.');
      setResult(data);
      setActiveTab('symptoms');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The analysis could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  function filesChosen(files: FileList | null) {
    if (files?.length) void run('/api/analyze', Array.from(files));
  }

  async function createBrief() {
    if (!result) return;
    setBriefBusy(true);
    setBriefError('');
    try {
      const summary = `Automated review signal ${result.score.overall}. Findings: ${result.findings.map((f) => `${f.title}. ${f.whatWasFound}.`).join(' ')} ${result.score.meaning}`;
      const response = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: summary }),
      });
      if (!response.ok) {
        const body = await response.json();
        if (body.privacy) {
          setResult((current) => current ? { ...current, privacy: { ...current.privacy, externalCalls: [...current.privacy.externalCalls, body.privacy] } } : current);
        }
        throw new Error(body.error ?? 'The spoken briefing is unavailable.');
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const blob = await response.blob();
      setAudioUrl(URL.createObjectURL(blob));
      let redactions: Record<string, number> = {};
      try { redactions = JSON.parse(response.headers.get('x-redaction-counts') ?? '{}'); } catch { /* Header is advisory. */ }
      setResult((current) => current ? {
        ...current,
        privacy: {
          ...current.privacy,
          externalCalls: [...current.privacy.externalCalls, {
            service: response.headers.get('x-privacy-service') ?? 'ElevenLabs',
            purpose: response.headers.get('x-privacy-purpose') ?? 'Spoken briefing',
            redactions,
          }],
        },
      } : current);
    } catch (cause) {
      setBriefError(cause instanceof Error ? cause.message : 'The spoken briefing is unavailable.');
    } finally {
      setBriefBusy(false);
    }
  }

  const labelTone = (label: string) => label === 'POTENTIAL_CONCERN' ? 'concern' : label === 'UNKNOWN' ? 'unknown' : label === 'INTERPRETATION' ? 'interpretation' : 'fact';

  return (
    <main className="shell">
      <div className="scroll-progress" aria-hidden="true"><i ref={progressIndicator} /></div>
      <header className="top">
        <a className="brand" href="#top" aria-label="DataDoctor home">
          <BrandMark />
          <span>Data<span className="brandlight">Doctor</span></span>
          <span className="brandtag">EVIDENCE INTELLIGENCE</span>
        </a>
        <div className="topright">
          <span className="live-indicator"><i /> PRIVATE BY DESIGN</span>
          <a href="#investigation">Start a review <span aria-hidden="true">↘</span></a>
        </div>
      </header>

      {!result ? (
        <>
          <section className="intro" id="top">
            <div className="intro-stars" aria-hidden="true" />
            <div className="intro-glow" aria-hidden="true" />
            <div className="intro-copy">
              <div className="intro-brand reveal-on-scroll reveal-delay-1"><BrandMark large /><span>DataDoctor</span></div>
              <p className="intro-kicker reveal-on-scroll reveal-delay-2"><i /> INDEPENDENT EVIDENCE INTELLIGENCE</p>
              <h1 className="reveal-on-scroll reveal-delay-3">Look closer.<br /><span>Know what supports the claim.</span></h1>
              <p className="intro-lede reveal-on-scroll reveal-delay-4">Investigate the sources behind a report. See what connects, what’s missing, and what deserves a second look.</p>
              <div className="intro-actions reveal-on-scroll reveal-delay-5">
                <a className="button primary-cta" href="#investigation">Start an investigation <span className="buttonarrow" aria-hidden="true">↘</span></a>
                <button className="button intro-demo" onClick={demo} disabled={busy}>{busy ? 'Opening demo…' : 'Explore the demo'} <span aria-hidden="true">↗</span></button>
              </div>
              <div className="intro-footnote reveal-on-scroll reveal-delay-6"><span className="intro-lock">◇</span> Your documents are processed in memory and never stored.</div>
            </div>
            <div className="intro-art reveal-on-scroll reveal-delay-3" aria-hidden="true">
              <div className="art-aura" />
              <div className="art-orbit art-orbit-one"><i /><i /><i /></div>
              <div className="art-orbit art-orbit-two"><i /><i /></div>
              <svg className="art-network" viewBox="0 0 480 480" fill="none">
                <circle className="network-ring" cx="240" cy="240" r="174" />
                <circle className="network-ring ring-two" cx="240" cy="240" r="124" />
                <path className="network-line" d="M89 174 183 221 278 104 379 179 303 286 163 341 89 174Zm94 47 110 65 86-107M183 221l-20 120m115-237 25 182M89 174l190-70" />
                <path className="network-sweep" d="M70 240h340M240 70v340" />
                <circle className="network-node node-primary" cx="240" cy="240" r="29" />
                <circle className="network-node" cx="89" cy="174" r="6" />
                <circle className="network-node node-blue" cx="183" cy="221" r="8" />
                <circle className="network-node" cx="278" cy="104" r="6" />
                <circle className="network-node node-pink" cx="379" cy="179" r="7" />
                <circle className="network-node" cx="303" cy="286" r="6" />
                <circle className="network-node node-blue" cx="163" cy="341" r="7" />
                <path className="network-pulse" d="M64 240h52l22-34 30 69 25-43h61" />
              </svg>
              <div className="art-center"><BrandMark large /><span>TRACE<br />THE SOURCE</span></div>
              <div className="art-tag tag-top"><i /> SOURCE LINKS <b>04</b></div>
              <div className="art-tag tag-bottom">LIVE EVIDENCE MAP <span>●</span></div>
            </div>
            <a className="intro-scroll reveal-on-scroll" href="#investigation"><span className="scroll-track"><i /></span> SCROLL TO BEGIN</a>
            <div className="intro-index">01 <span>/</span> 03</div>
          </section>

          <section className="intake" id="investigation">
            <div className="intake-heading">
              <div className="reveal-on-scroll"><p className="eyebrow"><span className="eyebrowline" /> YOUR WORKSPACE <span className="eyebrowsep">/</span> 01</p><h2>Start with the evidence.</h2><p>Upload a report and any sources it cites. DataDoctor will map the claims back to what supports them.</p></div>
              <div className="download-pair"><a className="download" href="/demo/primary-report.pdf" download>Download low-score sample <span aria-hidden="true">↓</span></a><a className="download" href="/demo/clean-sea-life-report.pdf" download>Download clean sea-life report <span aria-hidden="true">↓</span></a></div>
            </div>
            <div className="intake-grid">
              <div className="intake-side reveal-on-scroll">
                <div className="side-meta"><span>DOCUMENT INTAKE</span><span>DD / 001</span></div>
                <div className={`drop ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); filesChosen(e.dataTransfer.files); }}>
                  <div className="drop-orbit" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><span className="upload-glyph">↑</span></div>
                  <p className="drop-kicker">BEGIN A NEW REVIEW</p>
                  <h3>Choose a report<br />and its cited sources.</h3>
                  <p className="drop-copy">Drop files here or browse your device to begin.</p>
                  <button className="button secondary browse" onClick={() => input.current?.click()} disabled={busy}>Select documents <span aria-hidden="true">＋</span></button>
                  <input ref={input} hidden type="file" multiple accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(e) => filesChosen(e.target.files)} />
                  <p className="file-limit">PDF, TXT, MD <span>·</span> 10 MB each <span>·</span> up to 6 files</p>
                </div>
                <div className="console-footer"><span><i className="statusdot" /> READY FOR INPUT</span><span>PRIVATE SESSION</span></div>
              </div>
              <aside className="intake-aside reveal-on-scroll reveal-delay-2">
                <p className="drop-kicker">WHAT DATA DOCTOR LOOKS FOR</p>
                <div className="intake-feature"><span>01</span><div><b>Source relationships</b><small>See where cited research leads.</small></div><i>↗</i></div>
                <div className="intake-feature"><span>02</span><div><b>Evidence gaps</b><small>Find claims that need more support.</small></div><i>↗</i></div>
                <div className="intake-feature"><span>03</span><div><b>Hidden instructions</b><small>Reveal text aimed at AI reviewers.</small></div><i>↗</i></div>
                <div className="intake-demo"><span className="demo-orb">✳</span><div><b>Low-score example</b><small>Explore the chemistry report and its evidence map.</small></div><button onClick={demo} disabled={busy} aria-label="Run low-score demo case">↗</button></div>
                <div className="intake-demo"><span className="demo-orb">✧</span><div><b>Clean example</b><small>Review a sea otter ecology paper with no flagged concerns.</small></div><button onClick={cleanDemo} disabled={busy} aria-label="Run clean sea-life demo case">↗</button></div>
              </aside>
            </div>
            {error && <div role="alert" className="error"><b>We couldn’t analyze that document</b><p>{error}</p></div>}
            <div className="capabilities reveal-on-scroll">
              <div className="cap-intro"><span className="eyebrowline" /> OPTIONAL CONNECTIONS</div>
              <ServicePill label="AI extraction" active={status.llm} />
              <ServicePill label="Public records" active={status.publicRecords} />
              <ServicePill label="Voice briefing" active={status.voice} />
              <span className="service-note">CORE REVIEW WORKS WITHOUT API KEYS</span>
            </div>
          </section>
        </>
      ) : (
        <section className="results">
          <div className="resulthead reveal-on-scroll">
            <div>
              <p className="eyebrow"><span className="eyebrowline" /> INVESTIGATION REPORT <span className="eyebrowsep">/</span> CASE FILE</p>
              <h1>{result.docs.find((doc) => doc.role === 'primary')?.pages[0]?.text.match(/^#\s*(.+)$/m)?.[1] ?? result.docs.find((doc) => doc.role === 'primary')?.fileName}</h1>
              <p className="muted"><span className="resultpulse" /> {result.docs.length} document{result.docs.length === 1 ? '' : 's'} reviewed <span className="dotsep">·</span> Analysis completed in memory</p>
            </div>
            <button className="button secondary new-review" onClick={() => { setResult(null); setError(''); }}>＋ New investigation</button>
          </div>

          <div className="scoregrid reveal-on-scroll reveal-delay-2">
            <div className="scorecard">
              <div className="score-ring-wrap"><span className="score-orbit" /><div className="ring" style={{ '--score': `${result.score.overall}%` } as React.CSSProperties}><span>{result.score.overall}<small>/100</small></span></div><span className="ring-caption">AUTOMATED SIGNAL</span></div>
              <div className="score-copy"><p className="eyebrow">SCREENING SUMMARY</p><h2>Review signal</h2><p>{result.score.meaning}</p><span className="score-caveat">Open each factor to see coverage, limits, and document-backed findings.</span></div>
            </div>
            <div className="categories"><div className="categories-head"><span>REQUESTED REVIEW FACTORS</span><span>CHECK</span></div>{result.score.categories.map((category, index) => <details key={category.name} open={index === 0}><summary><span>{category.name}</span><span className={`dimension-status ${category.status}`}>{category.score === null ? 'NOT ASSESSED' : `PARTIAL · ${category.score}/100`}</span></summary>{category.score !== null && <div className="bar"><i style={{ width: `${category.score}%` }} /></div>}<p className="dimension-guidance">{category.guidance}</p><ul>{category.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></details>)}</div>
          </div>

          {result.findings.filter((finding) => finding.type === 'hidden_instruction').map((finding) => (
            <article className="hiddenalert reveal-on-scroll" key={finding.id}>
              <div className="alerticon">!</div><div className="alertbody"><p className="eyebrow">HIDDEN TEXT REVEALED <span className="eyebrowsep">/</span> PAGE {finding.evidence[0]?.page}</p><h2>{finding.title}</h2>
                <blockquote>{finding.evidence[0]?.quote}</blockquote>
                <button className="textbutton" onClick={() => { setSelectedFindingId(finding.id); setActiveTab('chain'); }}>Trace in evidence chain <span>↗</span></button>
                <p className="alert-method">Detection method: {finding.evidence[0]?.method}. Hidden text was excluded from claim extraction.</p><Evidence f={finding} />
              </div>
            </article>
          ))}

          <div className="tabrow reveal-on-scroll" role="tablist" aria-label="Investigation views"><div className="tabs-label">INVESTIGATION DETAIL</div><button role="tab" aria-selected={activeTab === 'symptoms'} className={activeTab === 'symptoms' ? 'selected' : ''} onClick={() => setActiveTab('symptoms')}><span className="tab-icon">⌁</span> Findings <small>{result.findings.length}</small></button><button role="tab" aria-selected={activeTab === 'chain'} className={activeTab === 'chain' ? 'selected' : ''} onClick={() => setActiveTab('chain')}><span className="tab-icon">⌘</span> Evidence chain</button><span className="graph-count">{result.graph.nodes.length} NODES <i /> {result.graph.edges.length} LINKS</span></div>
          {activeTab === 'symptoms' ? <div className="findings">{[...result.findings].filter((finding) => finding.type !== 'hidden_instruction').sort((a, b) => ({ high: 0, medium: 1, low: 2, info: 3 }[a.severity] - ({ high: 0, medium: 1, low: 2, info: 3 }[b.severity]))).map((finding, index) => <article className="finding reveal-on-scroll" style={{ '--reveal-delay': `${Math.min(index % 4, 3) * 65}ms` } as React.CSSProperties} key={finding.id}>
            <div className="findingtop"><span className="finding-index">SIGNAL {String(index + 1).padStart(2, '0')}</span><span className={`chip ${labelTone(finding.label)}`}><i />{finding.label.replace('_', ' ')}</span><span className={`severity severity-${finding.severity}`}>{finding.severity}</span></div>
            <h3>{finding.title}</h3><p>{finding.whatWasFound}</p><div className="why"><b>WHY IT MATTERS</b><p>{finding.whyItMatters}</p></div><p className="uncertain"><span>LIMITS</span> {finding.uncertainty}</p>
            <details className="finding-evidence"><summary><span>Evidence references</span><b>{String(finding.evidence.length).padStart(2, '0')} <i>＋</i></b></summary><Evidence f={finding} /></details>
            <button className="textbutton" onClick={() => { setSelectedFindingId(finding.id); setActiveTab('chain'); }}>Trace finding <span>↗</span></button>
          </article>)}</div> : <EvidenceGraph result={result} selectedFindingId={selectedFindingId} />}

          <div className="sectiontitle reveal-on-scroll"><div><p className="eyebrow"><span className="eyebrowline" /> RECOMMENDED ACTIONS</p><h2>Treatment plan</h2></div><span>YOUR NEXT INVESTIGATION STEPS</span></div>
          <div className="treatment reveal-on-scroll">{[...new Set(result.findings.flatMap((finding) => finding.recommendedActions))].map((action, index) => <label key={index}><input type="checkbox"/><span className="treatment-no">{String(index + 1).padStart(2, '0')}</span><span>{action}</span><i>↗</i></label>)}</div>

          <div className="twocol reveal-on-scroll"><section><div className="sectiontitle"><div><p className="eyebrow"><span className="eyebrowline" /> PROCESS TRACE</p><h2>Lab log</h2></div></div><div className="log">{result.labLog.map((entry, index) => <div key={index}><span className="log-index">{String(index + 1).padStart(2, '0')}</span><span className="log-stage">{entry.stage}</span><span>{entry.detail}</span><b>{entry.ms}<small> ms</small></b></div>)}</div></section><section><div className="sectiontitle"><div><p className="eyebrow"><span className="eyebrowline" /> TRANSPARENCY RECORD</p><h2>Privacy receipt</h2></div></div><div className="receipt"><div className="receipt-seal">◇</div><div><span className="receipt-status"><i /> IN-MEMORY SESSION</span><b>{result.privacy.statement}</b><p>Storage status <strong>None</strong></p><p>{result.privacy.externalCalls.length ? result.privacy.externalCalls.map((call) => `${call.service}: ${call.purpose}`).join(' · ') : 'No external services were contacted.'}</p></div></div></section></div>

          <div className="printrow reveal-on-scroll">{result.mode.voice && <div className="briefing"><button className="button secondary" onClick={createBrief} disabled={briefBusy}>{briefBusy ? 'Preparing briefing…' : 'Create spoken briefing'}</button>{audioUrl && <audio controls src={audioUrl} aria-label="Doctor's briefing audio" />}{briefError && <p role="alert">{briefError}</p>}</div>}<button className="button secondary print-button" onClick={() => window.print()}><span>↗</span> Export report</button></div>
        </section>
      )}

      <footer id="about"><span>DataDoctor <i>—</i> Evidence, examined.</span><p>DataDoctor does not tell you what to believe. It tells you what to investigate before you believe it.</p><span className="footer-right">PRIVACY FIRST <i /> DOCUMENTS ARE ANALYZED IN MEMORY</span></footer>
    </main>
  );
}

function BrandMark({ large = false }: { large?: boolean }) {
  return <span className={`brandmark ${large ? 'brandmark-large' : ''}`} aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path className="mark-orbit" d="M20 3.5 34.3 11.7v16.6L20 36.5 5.7 28.3V11.7L20 3.5Z"/><path className="mark-pulse" d="M9 21h6l3.4-7 5.1 13 3.3-7H31"/><circle className="mark-core" cx="20" cy="20" r="2.1"/></svg></span>;
}

function ServicePill({ label, active }: { label: string; active: boolean }) {
  return <span className={`service-pill ${active ? 'active' : ''}`}><i />{label}<small>{active ? 'ON' : 'OFF'}</small></span>;
}

function Evidence({ f }: { f: AnalysisResult['findings'][number] }) {
  return <ul className="evidence">{f.evidence.map((evidence, index) => <li key={index}>{evidence.kind === 'quote' ? <><blockquote>“{evidence.quote}”</blockquote><span>{evidence.fileName}{evidence.page ? ` · page ${evidence.page}` : ''}{evidence.method ? ` · ${evidence.method}` : ''}</span></> : <a href={evidence.url} target="_blank" rel="noreferrer">{evidence.note ?? evidence.url}</a>}</li>)}</ul>;
}
