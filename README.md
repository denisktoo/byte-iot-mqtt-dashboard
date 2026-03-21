## BYTE-IOT MQTT Dashboard

This project is a Next.js web dashboard for monitoring MQTT topics in real time, using a Node.js WebSocket bridge for browser compatibility.

### Features
- Live MQTT message stream and topic tracking
- Professional, modern UI
- Node.js WebSocket bridge (see `server.js`)
- MQTT credentials managed via `.env`
- Log messages rendered as pretty-printed JSON

### Usage
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root:
   ```env
   MQTT_BROKER=mqtt://your-broker:1883
   MQTT_USER=your-username
   MQTT_PASS=your-password
   ```
3. Start the Node.js WebSocket bridge:
   ```bash
   node server.js
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### MQTT Connection

### MQTT Connection
- Broker: `MQTT_BROKER` from your `.env` (e.g. `mqtt://your-broker:1883`)
- WebSocket bridge: `ws://localhost:4001` (browser)
- Username: `MQTT_USER` from your `.env`
- Password: `MQTT_PASS` from your `.env`
- Topics: `/topic/#`, `/topic/transittag/heartbeat/#`

---
For customization, edit `components/MqttDashboard.tsx` and `server.js`.
