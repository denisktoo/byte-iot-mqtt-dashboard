import React, { useEffect, useRef, useState } from 'react';

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface TopicMap {
  [topic: string]: number;
}

const WS_SERVER = 'ws://localhost:4001';

const DEVICE_TYPES = ['tracker', 'transittag'] as const;
type DeviceType = typeof DEVICE_TYPES[number];

const MqttDashboard: React.FC = () => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [statusText, setStatusText] = useState('CONNECTING');
  const [total, setTotal] = useState(0);
  const [topics, setTopics] = useState<TopicMap>({});
  const [recent, setRecent] = useState<number[]>([]);
  const [lastMsg, setLastMsg] = useState<{ topic: string; msg: string } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logEntries, setLogEntries] = useState<Array<{ time: string; topic: string; msg: string; sys?: boolean }>>([
    { time: '--:--:--', topic: 'SYSTEM', msg: 'Initialising WebSocket bridge...', sys: true },
  ]);
  const [uptime, setUptime] = useState('00:00:00');

  // Command panel state
  const [deviceType, setDeviceType] = useState<DeviceType>('tracker');
  const [imei, setImei] = useState('');
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());
  const wsRef = useRef<WebSocket | null>(null);

  // Uptime timer
  useEffect(() => {
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - startTime.current) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, '0');
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const sc = String(s % 60).padStart(2, '0');
      setUptime(`${h}:${m}:${sc}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket connection
  useEffect(() => {
    const ws = new window.WebSocket(WS_SERVER);
    wsRef.current = ws;
    sysLog('SYSTEM', 'Connecting to local WebSocket server...');

    ws.onopen = () => {
      setStatus('connected');
      setStatusText('CONNECTED');
      sysLog('BROKER', 'Connected via Node.js bridge');
    };

    ws.onmessage = (event) => {
      const { topic, msg, sys } = JSON.parse(event.data);

      if (sys) {
        sysLog(topic, msg);
        return;
      }

      setTotal((t) => t + 1);
      setTopics((prev) => ({ ...prev, [topic]: (prev[topic] || 0) + 1 }));
      setRecent((prev) => {
        const now = Date.now();
        return [...prev, now].filter((t) => now - t < 60000);
      });
      setLastMsg({ topic, msg });
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      setLogEntries((prev) => {
        const next = [...prev, { time, topic, msg }];
        return next.length > 300 ? next.slice(next.length - 300) : next;
      });
    };

    ws.onerror = () => {
      setStatus('error');
      setStatusText('ERROR');
      sysLog('ERROR', 'WebSocket connection failed');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setStatusText('DISCONNECTED');
      sysLog('SYSTEM', 'Disconnected from WebSocket server');
    };

    return () => ws.close();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logEntries, autoScroll]);

  function sysLog(label: string, msg: string) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogEntries((prev) => [...prev, { time, topic: label, msg, sys: true }]);
  }

  function clearLog() {
    setLogEntries([]);
  }

  // For Live Stream — no wrapping
  function renderMsg(msg: string) {
    try {
      const parsed = JSON.parse(msg);
      if (typeof parsed === 'object' && parsed !== null) {
        return (
          <pre style={{ fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', margin: 0 }}>
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      }
    } catch {
      // not JSON
    }
    return esc(msg);
  }

  // For Last Message — with wrapping
  function renderMsgWrapped(msg: string) {
    try {
      const parsed = JSON.parse(msg);
      if (typeof parsed === 'object' && parsed !== null) {
        return (
          <pre style={{ fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      }
    } catch {
      // not JSON
    }
    return esc(msg);
  }

  // Send command to device via WebSocket → Node.js → MQTT
  function sendCommand() {
    if (!imei.trim()) {
      sysLog('ERROR', 'IMEI is required');
      return;
    }
    if (!command.trim()) {
      sysLog('ERROR', 'Command is required');
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      sysLog('ERROR', 'Not connected to WebSocket server');
      return;
    }

    const topic = `/topic/${deviceType}/${imei.trim()}`;
    const payload = JSON.stringify({ topic, msg: command.trim() });

    setSending(true);
    wsRef.current.send(payload);
    sysLog('PUBLISH', `→ ${topic} : ${command.trim()}`);

    setTimeout(() => setSending(false), 1000);
    setCommand('');
  }

  const rate = recent.length;
  const topicList = Object.entries(topics).sort((a, b) => b[1] - a[1]);

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24">
              <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
            </svg>
          </div>
          <div className="brand">
            <h1>BYTE-IOT</h1>
            <p>MQTT Terminal</p>
          </div>
        </div>
        <div className="status-pill">
          <div className={`dot ${status}`} id="dot"></div>
          <span id="status-txt">{statusText}</span>
        </div>
      </header>

      <div className="stats">
        <div className="stat" id="s-total">
          <div className="stat-lbl">Total Messages</div>
          <div className="stat-val" id="v-total">{total}</div>
        </div>
        <div className="stat" id="s-topics">
          <div className="stat-lbl">Active Topics</div>
          <div className="stat-val g" id="v-topics">{topicList.length}</div>
        </div>
        <div className="stat" id="s-rate">
          <div className="stat-lbl">Msg / Min</div>
          <div className="stat-val o" id="v-rate">{rate}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Broker</div>
          <div className="stat-val sm">byte-iot.net:1883</div>
        </div>
      </div>

      <div className="layout">
        <div className="terminal-wrap">
          <div className="panel-top">
            <span className="panel-title">▶ Live Stream — /topic/#</span>
            <div className="btns">
              <button className={`btn${autoScroll ? ' on' : ''}`} onClick={() => setAutoScroll((a) => !a)}>
                Auto-scroll
              </button>
              <button className="btn" onClick={clearLog}>Clear</button>
            </div>
          </div>
          <div id="log" ref={logRef}>
            {logEntries.length === 0 && (
              <div className="entry sys">
                <span className="e-time">--:--:--</span>
                <span className="e-topic">SYSTEM</span>
                <span className="e-msg">No log entries</span>
              </div>
            )}
            {logEntries.map((e, i) => (
              <div className={`entry${e.sys ? ' sys' : ''}`} key={i}>
                <span className="e-time">{e.time}</span>
                <span className="e-topic">{esc(e.topic)}</span>
                <span className="e-msg">{renderMsg(e.msg)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar">
          {/* Topics panel */}
          <div className="side-panel">
            <div className="panel-top">
              <span className="panel-title">◈ Topics</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--dim)' }}>
                {topicList.length} active
              </span>
            </div>
            <div id="topic-list">
              {topicList.length === 0 ? (
                <div className="empty">Waiting for messages…</div>
              ) : (
                topicList.map(([t, c]) => (
                  <div className="t-item" key={t}>
                    <span className="t-name" title={t}>{esc(t)}</span>
                    <span className="t-cnt">{c}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Command panel */}
          <div className="side-panel">
            <div className="panel-top">
              <span className="panel-title">◎ Send Command</span>
            </div>
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>

              {/* Device type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  Device Type
                </label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    padding: '4px 6px',
                    borderRadius: 3,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {DEVICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* IMEI */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  IMEI
                </label>
                <input
                  type="text"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  placeholder="e.g. 863471065047747"
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    padding: '4px 6px',
                    borderRadius: 3,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Command */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  Command
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                  placeholder="e.g. health / checking"
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    padding: '4px 6px',
                    borderRadius: 3,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Topic preview */}
              <div style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'monospace' }}>
                → /topic/{deviceType}/{imei || '{IMEI}'}
              </div>

              {/* Send button */}
              <button
                className="btn on"
                onClick={sendCommand}
                disabled={sending || status !== 'connected'}
                style={{
                  marginTop: 4,
                  opacity: sending || status !== 'connected' ? 0.5 : 1,
                  cursor: sending || status !== 'connected' ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'SENDING...' : 'SEND →'}
              </button>
            </div>
          </div>

          {/* Last message panel */}
          <div className="side-panel">
            <div className="panel-top">
              <span className="panel-title">◉ Last Message</span>
            </div>
            <div id="last-msg">
              {lastMsg ? (
                <>
                  <div id="last-t">{esc(lastMsg.topic)}</div>
                  <div>{renderMsgWrapped(lastMsg.msg)}</div>
                </>
              ) : (
                <div className="empty">No messages yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer>
        <span>MQTT WS // /topic/# // port 4001</span>
        <span>RATE: <span id="rate-out">{rate}/min</span></span>
        <span id="uptime">UPTIME: {uptime}</span>
      </footer>
    </div>
  );
};

export default MqttDashboard;
