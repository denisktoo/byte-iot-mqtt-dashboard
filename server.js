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
});

mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  mqttClient.subscribe('/topic/#');
});

// WebSocket server for Next.js clients
const wss = new WebSocket.Server({ port: 4001 });
console.log('✅ WebSocket server running on port 4001');

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket client connected');
  ws.on('close', () => clients.delete(ws));
});

// Forward MQTT messages to all Next.js clients
mqttClient.on('message', (topic, message) => {
  const data = JSON.stringify({ topic, msg: message.toString() });
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
});