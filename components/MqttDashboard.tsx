import React, { useEffect, useRef, useState } from 'react';
// Utility for escaping HTML
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

const MqttDashboard: React.FC = () => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected' | 'reconnecting'>('connecting');
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
  const logRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());

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

  // WebSocket connection to Node.js bridge
  useEffect(() => {
    const ws = new window.WebSocket(WS_SERVER);
    sysLog('SYSTEM', 'Connecting to local WebSocket server...');

    ws.onopen = () => {
      setStatus('connected');
      setStatusText('CONNECTED');
      sysLog('BROKER', 'Connected via Node.js bridge');
    };

    ws.onmessage = (event) => {
      const { topic, msg } = JSON.parse(event.data);
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

  // Auto-scroll log
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logEntries, autoScroll]);

  function sysLog(label: string, msg: string) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogEntries((prev) => [
      ...prev,
      { time, topic: label, msg, sys: true },
    ]);
  }

  function clearLog() {
    setLogEntries([]);
  }

  // Stats
  const rate = recent.length;
  const topicList = Object.entries(topics).sort((a, b) => b[1] - a[1]);

  // UI
  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
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
              <button className={`btn${autoScroll ? ' on' : ''}`} id="btn-auto" onClick={() => setAutoScroll((a) => !a)}>
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
                <span className={`e-topic${e.sys ? '' : ''}`}>{esc(e.topic)}</span>
                <span className="e-msg">
                  {(() => {
                    // Always pretty-print JSON if possible
                    let parsed = e.msg;
                    if (typeof parsed === 'string') {
                      try {
                        parsed = JSON.parse(parsed);
                      } catch {
                        // Not JSON string, leave as is
                      }
                    }
                    if (typeof parsed === 'object' && parsed !== null) {
                      return <pre style={{fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', margin: 0}}>{JSON.stringify(parsed, null, 2)}</pre>;
                    }
                    return esc(e.msg);
                  })()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar">
          <div className="side-panel">
            <div className="panel-top">
              <span className="panel-title">◈ Topics</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--dim)' }} id="t-count">
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
          <div className="side-panel">
            <div className="panel-top">
              <span className="panel-title">◉ Last Message</span>
            </div>
            <div id="last-msg">
              {lastMsg ? (
                <>
                  <div id="last-t">{esc(lastMsg.topic)}</div>
                  <div>
                    {(() => {
                      let parsed = lastMsg.msg;
                      if (typeof parsed === 'string') {
                        try {
                          parsed = JSON.parse(parsed);
                        } catch {
                          // Not JSON string, leave as is
                        }
                      }
                      if (typeof parsed === 'object' && parsed !== null) {
                        return <pre style={{fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{JSON.stringify(parsed, null, 2)}</pre>;
                      }
                      return esc(lastMsg.msg);
                    })()}
                  </div>
                </>
              ) : (
                <div className="empty">No messages yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer>
        <span>MQTT WS // /topic/# // port 9001</span>
        <span>
          RATE: <span id="rate-out">{rate}/min</span>
        </span>
        <span id="uptime">UPTIME: {uptime}</span>
      </footer>
    </div>
  );
};

export default MqttDashboard;
