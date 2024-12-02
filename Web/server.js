const express = require("express");
const mqtt = require("mqtt");
const http = require("http");
const socketIo = require("socket.io");

// Create an Express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// TTN MQTT credentials
const options = {
  host: "eu1.cloud.thethings.network", // TTN MQTT server for Europe region
  port: 1883,                          // Default MQTT port
  username: "air-quality-pjt@ttn",     // TTN Application ID
  password: "NNSXS.HVGDTP7MF47OJYKDKKU7QHVJTHCH4SVHEEW2HRY.PE5ABVZX73A3DOJQZHG4G7VMRQSD5R5G5ICHC2BMXTDR2BMDPDCA" // TTN API Key
};

const mqttTopic = "v3/air-quality-pjt@ttn/devices/air-quality-pjt/up"; // Uplink topic for the TTN device

// Connect to the MQTT broker
const mqttClient = mqtt.connect(options);

// Serve the HTML files
app.use(express.static("public")); // Make sure the HTML is in the 'public' folder

// Set up MQTT event listener
mqttClient.on("connect", () => {
  console.log("Connected to TTN MQTT");

  // Subscribe to the uplink topic
  mqttClient.subscribe(mqttTopic, (err) => {
    if (err) {
      console.error("Failed to subscribe to topic:", err.message);
    } else {
      console.log(`Subscribed to topic: ${mqttTopic}`);
    }
  });
});

// Listen for messages from TTN and emit data to the front-end
mqttClient.on("message", (topic, message) => {
  console.log(`Message received on topic ${topic}:`);

  try {
    // Parse the JSON payload
    const data = JSON.parse(message.toString());
    console.log("Decoded Data:", data);

    // Extract relevant fields
    const { end_device_ids, uplink_message } = data;
    const deviceId = end_device_ids.device_id;
    const decodedPayload = uplink_message.decoded_payload;

    // Emit the data to the front-end via socket.io
    io.emit("air-quality-data", {
      deviceId: deviceId,
      co2: decodedPayload.co2,
      pm25: decodedPayload.pm25,
      latitude: decodedPayload.latitude,
      longitude: decodedPayload.longitude,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Error parsing message:", error.message);
  }
});

// Start the server on port 3000
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
