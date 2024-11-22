const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mqtt = require("mqtt");
const fs = require("fs"); // For exporting data to CSV

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

const activeDevices = new Set(); // Track unique device IDs
const airQualityData = []; // Store air quality data

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

  const { end_device_ids, uplink_message } = data;
  const deviceId = end_device_ids.device_id;
  const airQuality = uplink_message.decoded_payload.air_quality;

  // Add to active devices
  activeDevices.add(deviceId);

  // Add air quality data with timestamp
  airQualityData.push({ deviceId, airQuality, timestamp: new Date() });

  /// Emit the updated data to the frontend
  io.emit('event-name', {
    activeDevices: Array.from(activeDevices),
    airQualityData,
    averageAirQuality: computeAverageAirQuality(),
  });
});

function computeAverageAirQuality() {
  const today = new Date().toISOString().split("T")[0];
  const todayData = airQualityData.filter(
    (entry) => entry.timestamp.toISOString().split("T")[0] === today
  );
  const sum = todayData.reduce((acc, entry) => acc + entry.airQuality, 0);
  return todayData.length > 0 ? sum / todayData.length : 0;
}

// Export data to CSV
app.get('/export', (req, res) => {
  const csvData = "Device ID, Air Quality, Timestamp\n" +
    airQualityData.map(entry => `${entry.deviceId}, ${entry.airQuality}, ${entry.timestamp}`).join("\n");
  fs.writeFileSync("air_quality_data.csv", csvData);
  res.download("air_quality_data.csv");
});

// Serve frontend files
app.use(express.static("public"));

// Start the server
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

