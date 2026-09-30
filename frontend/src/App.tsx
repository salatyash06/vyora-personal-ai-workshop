import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, streamChat, TOKEN_KEY, type Conversation, type Message, type Note, type Status, type SystemInfo } from './api';

const describeError = (error: unknown) => error instanceof Error ? error.message : String(error);
const suggestions = ['What can you do?', 'Open calculator', 'System status', 'Save note: Revise 8085 interrupts'];

export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [draftToken, setDraftToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [online, setOnline] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'assistant' | 'notes' | 'settings'>('assistant');
  const [busy, setBusy] = useState<'chat' | 'voice' | 'load' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [spoken, setSpoken] = useState(localStorage.getItem('vyora-speak') === 'true');
  const [devices, setDevices] = useState<{id: number; name: string}[]>([]);
  const [device, setDevice] = useState('');
  const [seconds, setSeconds] = useState(6);
  const abortRef = useRef<AbortController | null>(null);
  const stopped = useRef(false);
  const tail = useRef<HTMLDivElement>(null);
  const loadingHistory = useRef(0);

  useEffect(() => { tail.current?.scrollIntoView({behavior: 'smooth'}); }, [messages]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const [s, sys] = await Promise.all([api<Status>('/status'), api<SystemInfo>('/system')]);
        if (alive) { setStatus(s); setSystem(sys); setOnline(true); }
      } catch { if (alive) setOnline(false); }
      if (alive) timer = setTimeout(poll, 2500);
    }
    void poll();
    void (async () => {
      try {
        let list = await api<Conversation[]>('/conversations');
        if (!list.length) list = [await api<Conversation>('/conversations', {})];
        const history = await api<Message[]>(`/conversations/${list[0].id}/messages`);
        const saved = await api<Note[]>('/notes');
        if (alive) { setConversations(list); setConversationId(list[0].id); setMessages(history); setNotes(saved); }
      } catch (e) { if (alive) setError(describeError(e)); }
    })();
    return () => { alive = false; clearTimeout(timer); abortRef.current?.abort(); };
  }, [token]);

  async function connect(event: FormEvent) {
    event.preventDefault(); setError(''); setConnecting(true);
    try {
      const value = draftToken.trim();
      const result = await api<Status>('/status', undefined, {token: value});
      sessionStorage.setItem(TOKEN_KEY, value); setStatus(result); setToken(value); setOnline(true); setDraftToken('');
    } catch (e) { setError(describeError(e)); }
    finally { setConnecting(false); }
  }

  async function refreshSaved() {
    const [list, saved] = await Promise.all([api<Conversation[]>('/conversations'), api<Note[]>('/notes')]);
    setConversations(list); setNotes(saved);
  }

  async function selectConversation(id: number) {
    const requestId = ++loadingHistory.current;
    setBusy('load'); setError('');
    try {
      const history = await api<Message[]>(`/conversations/${id}/messages`);
      if (requestId === loadingHistory.current) { setConversationId(id); setMessages(history); setTab('assistant'); }
    } catch (e) { setError(describeError(e)); }
    finally { if (requestId === loadingHistory.current) setBusy(null); }
  }

  async function newChat() {
    setBusy('load'); setError('');
    try {
      const item = await api<Conversation>('/conversations', {});
      setConversations(old => [item, ...old]); setConversationId(item.id); setMessages([]); setTab('assistant'); setNotice('');
    } catch (e) { setError(describeError(e)); }
    finally { setBusy(null); }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy || !conversationId || !online) return;
    setInput(''); setError(''); setNotice(''); setBusy('chat'); stopped.current = false;
    const controller = new AbortController(); abortRef.current = controller;
    const responseId = -Date.now();
    setMessages(old => [...old, {id: responseId - 1, role: 'user', content: text}, {id: responseId, role: 'assistant', content: ''}]);
    let reply = '', completed = false;
    try {
      for await (const event of streamChat(conversationId, text, controller.signal)) {
        if (event.type === 'token') {
          reply += event.text;
          setMessages(old => old.map(m => m.id === responseId ? {...m, content: reply} : m));
        } else if (event.type === 'error') throw new Error(event.message);
        else if (event.type === 'cancelled') { stopped.current = true; setNotice('Stopped. An action already performed cannot be undone.'); }
        else if (event.type === 'done') { reply = event.reply; completed = true; }
      }
      if (!completed && !stopped.current) throw new Error('The response ended unexpectedly. Please retry.');
      await refreshSaved();
      if (completed) {
        setMessages(await api<Message[]>(`/conversations/${conversationId}/messages`));
        if (spoken && !stopped.current) await api('/speak', {text: reply.slice(0, 4000)});
      }
    } catch (e) {
      if (stopped.current || (e instanceof DOMException && e.name === 'AbortError')) setNotice('Stopped. Unfinished replies are not saved.');
      else setError(describeError(e));
    } finally { setBusy(null); abortRef.current = null; }
  }

  async function listen() {
    setError(''); setNotice(''); setBusy('voice'); stopped.current = false;
    try {
      const result = await api<{text: string; cancelled: boolean}>('/listen', {seconds, device: device === '' ? null : Number(device)}, {timeout: 180000});
      if (result.cancelled || stopped.current) setNotice('Recording cancelled.');
      else if (result.text) { setInput(result.text.slice(0, 3000)); setNotice('Transcript ready. Check it, then press Send.'); }
      else setNotice('No speech detected. Try a different microphone or speak more clearly.');
    } catch (e) {
      setError(describeError(e));
      await api('/stop', {}).catch(() => {});
    } finally { setBusy(null); }
  }

  async function stop() {
    stopped.current = true;
    try { await api('/stop', {}); setNotice('Stop requested. Transcription may take a moment to finish stopping.'); }
    catch (e) { setError(describeError(e)); }
    finally { abortRef.current?.abort(); }
  }

  function disconnect() {
    sessionStorage.removeItem(TOKEN_KEY); setToken(''); setOnline(false); setMessages([]); setConversationId(null); setStatus(null); setError('');
  }

  const phase = !online ? 'Disconnected' : busy === 'voice'
    ? status?.voice_stage === 'idle' ? 'Preparing microphone' : status?.voice_stage ?? 'Preparing microphone'
    : busy === 'chat' ? 'Thinking' : status?.speaking ? 'Speaking' : 'Ready';

  if (!token) return <main className="connect-screen">
    <section className="connect-card">
      <div className="eyebrow">YOUR PERSONAL AI WORKSPACE</div><h1>VYORA<span>.</span></h1>
      <p>Your voice. Your workspace. Your assistant.</p>
      <div className="orb mini" aria-hidden="true"><div /></div>
      <h2>Connect to your laptop</h2>
      <p>Start the Python backend, then paste the local token from <code>backend/.env</code>.</p>
      <form onSubmit={connect}>
        <label htmlFor="token">Local connection token</label>
        <input id="token" type="password" autoComplete="off" value={draftToken} onChange={e => setDraftToken(e.target.value)} required />
        <button className="primary" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect VYORA →'}</button>
      </form>
      {error && <div className="error" role="alert">{error}</div>}
      <small>Runs on this computer · No paid AI API · Token stays in this tab</small>
    </section>
  </main>;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">VYORA<span>.</span></div><div className="eyebrow">PERSONAL ASSISTANT / V0.1</div>
      <button className="new-chat" onClick={() => void newChat()} disabled={!!busy || !online}>＋ New conversation</button>
      <nav aria-label="Main navigation">
        {(['assistant', 'notes', 'settings'] as const).map(t => <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t === 'assistant' ? '◈' : t === 'notes' ? '▤' : '⚙'} <span>{t[0].toUpperCase() + t.slice(1)}</span></button>)}
      </nav>
      <div className="eyebrow history-label">RECENT CONVERSATIONS</div>
      <div className="history">{conversations.map(c => <button key={c.id} title={c.title} className={conversationId === c.id ? 'active-history' : ''} disabled={!!busy || !online} onClick={() => void selectConversation(c.id)}>{c.title}</button>)}</div>
      <div className="sidebar-bottom"><span className={online ? 'dot online' : 'dot'} />{online ? 'Local backend connected' : 'Backend disconnected'}<small>AI requests stay on your laptop.</small></div>
    </aside>
    <main className="workspace">
      <header><div><div className="eyebrow">YOUR SPACE, IN SYNC</div><h2>{tab === 'assistant' ? 'Command centre' : tab === 'notes' ? 'Your notes' : 'Preferences'}</h2></div><span className="badge">{online ? 'LOCAL' : 'DISCONNECTED'}</span></header>
      {error && <div className="error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {status?.speech_error && <div className="error" role="alert">{status.speech_error}</div>}
      {tab === 'assistant' && <>
        <section className="assistant-hero">
          <div className={`orb ${busy || status?.speaking ? 'working' : ''}`} aria-hidden="true"><div /><i /><b /></div>
          <div className="hero-copy"><div className="eyebrow">VYORA IS WITH YOU</div><h1>Make room for<br /><span>what matters.</span></h1><p>Think out loud. Find your focus. Get things done.</p><div className="phase" aria-live="polite"><span className={online ? 'dot online' : 'dot'} />{phase}</div></div>
        </section>
        <div className="suggestions">{suggestions.map(s => <button key={s} disabled={!!busy} onClick={() => setInput(s)}>{s}</button>)}</div>
        <section className="chat" aria-label="Conversation">
          {!messages.length && <div className="empty"><h3>A fresh start.</h3><p>Ask a question or try “help” to explore local commands.</p></div>}
          {messages.map(m => <article key={m.id} className={`message ${m.role}`}><div className="message-label">{m.role === 'user' ? 'YOU' : 'VYORA'}</div><div className="message-content">{m.content || (busy === 'chat' ? 'Thinking…' : 'No completed response.')}</div></article>)}<div ref={tail} />
        </section>
        <form className="composer" onSubmit={send}>
          <label className="sr-only" htmlFor="message">Message VYORA</label>
          <textarea id="message" placeholder="Ask anything, or type a command…" value={input} maxLength={3000} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); void send();} }} rows={2} disabled={!!busy} />
          <div className="composer-actions"><button type="button" onClick={() => void listen()} disabled={!!busy || !online || !status?.speech_model_ready}>◎ Record {seconds}s</button><span>{input.length}/3000</span><button type="button" className="stop" onClick={() => void stop()} disabled={!online}>■ Stop</button><button className="primary" disabled={!!busy || !online || !input.trim() || !conversationId}>Send ↑</button></div>
        </form>
        <div className="footnote">Voice transcripts wait for your review. Local AI can make mistakes.</div>
      </>}
      {tab === 'notes' && <section className="notes-panel"><p>Save a note by sending <code>save note: your text</code> in Assistant.</p>{!notes.length && <div className="empty">No notes yet.</div>}<div className="note-grid">{notes.map(n => <article className="note" key={n.id}><small>NOTE {String(n.id).padStart(2, '0')}</small><p>{n.content}</p><time>{new Date(n.created_at).toLocaleString()}</time></article>)}</div></section>}
      {tab === 'settings' && <section className="settings-panel">
        <h3>Voice</h3><label className="toggle"><input type="checkbox" checked={spoken} onChange={e => {setSpoken(e.target.checked); localStorage.setItem('vyora-speak', String(e.target.checked));}} />Speak completed replies using Windows voices</label>
        <label htmlFor="duration">Recording length</label><select id="duration" value={seconds} onChange={e => setSeconds(Number(e.target.value))}>{[4, 6, 10, 15].map(n => <option key={n} value={n}>{n} seconds</option>)}</select>
        <label htmlFor="microphone">Microphone</label><select id="microphone" value={device} onChange={e => setDevice(e.target.value)}><option value="">Windows default / backend setting</option>{devices.map(d => <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>)}</select>
        <button disabled={!online || !!busy} onClick={() => {void api<{id: number; name: string}[]>('/audio/devices').then(setDevices).catch(e => setError(describeError(e)));}}>Refresh microphones</button>
        <h3>Local model</h3><p><code>{status?.model ?? 'Unknown'}</code></p><p>Change <code>OLLAMA_MODEL</code> in <code>backend/.env</code>, download that model with Ollama, then restart the backend.</p>
        <h3>Connection</h3><p>Your local token is stored only in this tab’s session storage.</p><button disabled={!!busy} onClick={disconnect}>Disconnect and forget token</button>
      </section>}
    </main>
    <aside className="inspector">
      <div className="eyebrow">SYSTEM PULSE</div><h3>Your laptop, live.</h3>
      <div className="metric"><span>CPU usage</span><strong>{online && system ? `${system.cpu_percent}%` : '—'}</strong><progress value={online ? system?.cpu_percent ?? 0 : 0} max="100" /></div>
      <div className="metric"><span>Memory</span><strong>{online && system ? `${system.memory_used_gb} / ${system.memory_total_gb} GB` : '—'}</strong><progress value={online ? system?.memory_percent ?? 0 : 0} max="100" /></div>
      <div className="metric"><span>Battery</span><strong>{online && system?.battery_percent != null ? `${system.battery_percent}%` : 'Not reported'}</strong></div>
      <div className="divider" /><div className="eyebrow">CONNECTIONS</div><div className="service"><span>Python backend</span><b>{online ? 'Ready' : 'Offline'}</b></div><div className="service"><span>Local AI</span><b>{online && status?.model_ready ? 'Ready' : 'Unavailable'}</b></div><div className="service"><span>Speech model</span><b>{online && status?.speech_model_ready ? 'Downloaded' : 'Not ready'}</b></div>
      <div className="tip"><span>SMALL START. REAL PROGRESS.</span><p>Try “save note: My next idea” to keep a thought for later.</p></div>
      {!status?.model_ready && <p className="muted">Local commands still work without Ollama. Start Ollama and download your selected model to enable AI chat.</p>}
    </aside>
  </div>;
}
