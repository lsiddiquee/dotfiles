import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, CircleAlert, GitBranch, ListChecks, Pause, Send, TableProperties } from 'lucide-react';
import DOMPurify from 'dompurify';
import './webview.css';

const vscode = acquireVsCodeApi();
let diagramSequence = 0;

function Diagram({ proposal }) {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    async function render() {
      try {
        const { default: mermaid } = await import('mermaid');
        const foreground = 'var(--vscode-editor-foreground, var(--text))';
        const background = 'var(--vscode-editor-background, var(--surface))';
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', htmlLabels: false,
          er: { useMaxWidth: false }, suppressErrorRendering: true,
          themeCSS: `
            .node rect, .entityBox { fill: ${background}; stroke: ${foreground}; }
            .node text, .label, .edgeLabel .label, .edgeLabel .label text {
              fill: ${foreground}; color: ${foreground};
            }
            .relationshipLine { stroke: ${foreground}; }
            .marker { stroke: ${foreground} !important; }
            .edgeLabel, .labelBkg, .relationshipLabelBox, .edgeLabel .label rect {
              fill: ${background}; background-color: ${background};
            }
          ` });
        const cardinalities = {
          'one-to-one': '||--||', 'one-to-many': '||--|{',
          'one-to-zero-or-many': '||--o{', 'many-to-many': '}o--o{',
        };
        const lines = proposal.relationships.map((relation, index) =>
          `    ${relation.from} ${cardinalities[relation.cardinality]} ${relation.to} : relation_${index + 1}`);
        const { svg } = await mermaid.render(`modelDiagram${++diagramSequence}`, `erDiagram\n    direction LR\n${lines.join('\n')}`);
        if (!disposed && container.current) {
          container.current.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
        }
      } catch {
        if (!disposed) { setFailed(true); }
      }
    }
    if (proposal.relationships.length) { void render(); }
    return () => { disposed = true; };
  }, [proposal]);
  if (!proposal.relationships.length) { return null; }
  return <div className="diagram" ref={container} role="img" aria-label="Model relationship diagram">
    {failed ? 'Diagram unavailable. Relationships are listed below.' : 'Rendering relationships...'}
  </div>;
}

function TextSection({ title, items }) {
  if (!items.length) { return null; }
  return <section><h2>{title}</h2><ul className="rules">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></section>;
}

function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('models');
  const [feedback, setFeedback] = useState('');
  const [answers, setAnswers] = useState({});
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  useEffect(() => {
    function receive(event) {
      const message = event.data;
      if (message?.type === 'proposal') {
        setData(message); setFeedback(''); setAnswers({}); setStale(false); setResult(null); setSaving(false);
      } else if (message?.type === 'stale') {
        setStale(true);
      } else if (message?.type === 'error') {
        setError(message.message); setSaving(false);
      } else if (message?.type === 'saved') {
        setResult(message.result); setSaving(false);
      }
    }
    window.addEventListener('message', receive);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', receive);
  }, []);
  if (!data) { return <main><p role="status">Loading proposal...</p></main>; }
  const { proposal, hash, source, example } = data;
  const locked = stale || saving || result !== null;
  const hasQuestions = proposal.questions.length > 0;
  const answeredCount = proposal.questions.filter(question => answers[question.id]?.trim()).length;
  const hasChanges = Boolean(feedback.trim() || Object.values(answers).some(value => value.trim()));
  const approveDisabled = locked || hasChanges;
  function submit(action) {
    setSaving(true); setError('');
    vscode.postMessage({ type: 'decision', hash, submission: { action, feedback, answers } });
  }
  const tabs = [
    ['models', TableProperties, 'Models'], ['relationships', GitBranch, 'Relationships'],
    ['rules', ListChecks, 'Rules & Migration'],
  ];
  return <main>
    <header className="page-header">
      <div><p className="eyebrow">{example ? 'Practice Review' : 'Model Review'}</p><h1>{proposal.title}</h1>
        <p className="summary">{proposal.summary}</p>
        <p className="source">{source} <span>Revision {hash.slice(0, 12)}</span></p>
      </div>
      <span className={`status ${result?.status === 'approved' ? 'approved' : ''}`}>
        {result ? result.status.replaceAll('_', ' ') : stale ? 'Outdated' : 'Pending review'}
      </span>
    </header>
    {example && <p className="notice">Example decisions are practice only and do not approve a repository change.</p>}
    {stale && <p className="notice warning" role="alert"><CircleAlert size={18} />Proposal changed. Close this review and reopen the current revision.</p>}
    {error && <p className="notice warning" role="alert">{error}</p>}
    {result && <p className="notice" role="status">Decision recorded: {result.status.replaceAll('_', ' ')}. {result.recordPath}</p>}
    <div className="layout">
      <div className="proposal">
        <nav className="tabs" aria-label="Proposal sections">{tabs.map(([id, Icon, label]) =>
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</nav>
        {tab === 'models' && proposal.models.map(model => <section key={model.name}>
          <div className="section-title"><h2>{model.name}</h2><span>{model.fields.length} fields</span></div>
          <p>{model.description}</p>
          <div className="table-scroll"><table><caption className="sr-only">{model.name} fields</caption>
            <thead><tr><th>Field</th><th>Type</th><th>Presence</th><th>Meaning & Constraints</th></tr></thead>
            <tbody>{model.fields.map(field => <tr key={field.name}>
              <th scope="row"><code>{field.name}</code><span className="storage">{field.storage}</span></th>
              <td>{field.type}</td><td>{field.required ? 'Required' : 'Optional'}</td>
              <td><p>{field.description}</p><p className="muted">{field.mutability}</p>
                {field.constraints.length > 0 && <ul>{field.constraints.map((constraint, index) => <li key={index}>{constraint}</li>)}</ul>}
              </td>
            </tr>)}</tbody>
          </table></div>
        </section>)}
        {tab === 'relationships' && <section><h2>Relationships</h2><Diagram proposal={proposal} />
          {proposal.relationships.length === 0 && <p>No relationships proposed.</p>}
          <ol className="relationships">{proposal.relationships.map((relation, index) => <li key={index}>
            <strong>{relation.from} / {relation.to}</strong><span>{relation.cardinality.replaceAll('-', ' ')}</span>
            <p>{relation.description}</p>
          </li>)}</ol>
        </section>}
        {tab === 'rules' && <>
          <TextSection title="Lifecycle" items={proposal.lifecycle} />
          <TextSection title="Invariants" items={proposal.invariants} />
          <TextSection title="Migration & Existing Data" items={proposal.migration} />
          <TextSection title="Assumptions" items={proposal.assumptions} />
        </>}
      </div>
      <aside aria-label="Review decision">
        <h2>Review Decision</h2>
        {hasQuestions && <p className="question-summary">{answeredCount} of {proposal.questions.length} answered. Answers must be incorporated into a revised proposal before approval.</p>}
        <fieldset disabled={locked} className="question-fields">
          {proposal.questions.map(question => <fieldset key={question.id} className="question">
            <legend>{question.prompt}</legend>
            {question.options?.length ? question.options.map(option => <label className="option" key={option}>
              <input type="radio" name={question.id} value={option} checked={answers[question.id] === option}
                onChange={() => setAnswers({ ...answers, [question.id]: option })} />
              <span>{option}</span>{question.recommended === option && <small>Recommended</small>}
            </label>) : <textarea aria-label={question.prompt} rows={3} value={answers[question.id] ?? ''}
              onChange={event => setAnswers({ ...answers, [question.id]: event.target.value })} />}
          </fieldset>)}
          <label className="feedback-label" htmlFor="feedback">Feedback</label>
          <textarea id="feedback" rows={5} value={feedback} onChange={event => setFeedback(event.target.value)} />
        </fieldset>
        <p className="scope">Approval covers the displayed models, fields, relationships, rules and migration mapping only. It never authorizes deleting, resetting or reseeding existing data.</p>
        <div className="actions">
          {hasQuestions ?
            <button type="button" className="primary" disabled={locked || !hasChanges} onClick={() => submit('requestChanges')}><Send size={17} />Submit Answers</button> :
            <>
              <button type="button" className="primary" disabled={approveDisabled} onClick={() => submit('approve')}><Check size={18} />Approve Proposal</button>
              <button type="button" disabled={locked || !hasChanges} onClick={() => submit('requestChanges')}><Send size={17} />Request Changes</button>
            </>}
          <button type="button" disabled={saving || result !== null} onClick={() => submit('defer')}><Pause size={17} />Defer</button>
        </div>
      </aside>
    </div>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
