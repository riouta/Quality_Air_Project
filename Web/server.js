const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mqtt = require("mqtt");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Your TTN credentials (replace with your actual values)
const options = {
  host: 'au1.cloud.thethings.network:1883', // E.g., "eu1.cloud.thethings.network"
  port: 1883,                 // MQTT port (default: 1883)
  username: 'quality-air-project@ttntion-id',  // TTN App ID
  password: 'NNSXS.V72EVLCYIM6ILOJRKDDF5BT2K7U2CN4GVZMT4QA.VSBSVFH5FX2X3U4WO4WCLE6UQ6Q753AIAUXWM35XS6QLKFCYAESQ',          // TTN API Key
};

const mqttTopic = 'v3/quality-air-project/devices/microcontroleur-feather-m0/up'; // TTN MQTT Topic

// Connect to TTN via MQTT
const client = mqtt.connect(options);

client.on('connect', () => {
  console.log('Connected to TTN MQTT');
  // Subscribe to the uplink topic for your device
  client.subscribe(mqttTopic);
});

client.on('message', (topic, message) => {
  // Parse the message received from TTN (uplink)
  const data = JSON.parse(message.toString());
  console.log("Data received:", data);

  // Emit the received data to connected frontend clients via socket.io
  io.emit('event-name', data);
});

// Serve frontend files
app.use(express.static("public"));

// Start the server
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

