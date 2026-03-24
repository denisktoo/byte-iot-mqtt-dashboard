const mqtt = require('mqtt');
const WebSocket = require('ws');
require('dotenv').config();

const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;

// Connect to MQTT broker
const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: `server_${Math.random().toString(16).slice(2, 10)}`,
});

mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  mqttClient.subscribe('/topic/#', (err) => {
    if (err) console.error('❌ Subscribe error:', err);
    else console.log('✅ Subscribed to /topic/#');
  });
});

mqttClient.on('error', (err) => {
  console.error('❌ MQTT error:', err.message);
});

mqttClient.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT broker...');
});

// WebSocket server for Next.js clients
const wss = new WebSocket.Server({ port: 4001 });
console.log('✅ WebSocket server running on port 4001');

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`🔌 Browser client connected (total: ${clients.size})`);

  // Receive commands FROM browser and publish to MQTT
  ws.on('message', (data) => {
    try {
      const { topic, msg } = JSON.parse(data);
      if (!topic || !msg) {
        console.warn('⚠️ Invalid command received:', data.toString());
        return;
      }
      mqttClient.publish(topic, msg, { qos: 1 }, (err) => {
        if (err) {
          console.error('❌ Publish error:', err.message);
          ws.send(JSON.stringify({
            topic: 'SYSTEM',
            msg: `Publish failed: ${err.message}`,
            sys: true,
          }));
        } else {
          console.log(`📤 Published → ${topic}: ${msg}`);
          // Confirm back to browser
          ws.send(JSON.stringify({
            topic: 'SYSTEM',
            msg: `✔ Command sent to ${topic}`,
            sys: true,
          }));
        }
      });
    } catch (err) {
      console.error('❌ Failed to parse browser message:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 Browser client disconnected (total: ${clients.size})`);
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket client error:', err.message);
  });
});

// Forward MQTT messages to all browser clients
mqttClient.on('message', (topic, message) => {
  const data = JSON.stringify({ topic, msg: message.toString() });
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
});
