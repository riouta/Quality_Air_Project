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

// Utility function to convert coordinates to DMS format
function convertToDMS(coordinate, isLatitude) {
  const absolute = Math.abs(coordinate);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

  const direction = isLatitude
    ? coordinate >= 0
      ? "N"
      : "S"
    : coordinate >= 0
    ? "E"
    : "W";

  return `${degrees}°${minutes}'${seconds}" ${direction}`;
}

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

let dataPointCount = 0;
let totalCO2 = 0;


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

    const co2Value = decodedPayload.co2;
    if (co2Value != null) {
      totalCO2 += co2Value;
      dataPointCount++;
    }

    const averageCO2 = (dataPointCount > 0) ? (totalCO2 / dataPointCount).toFixed(2) : 0;


    // Convert coordinates to DMS format
    const latitudeDMS = convertToDMS(decodedPayload.latitude, true);
    const longitudeDMS = convertToDMS(decodedPayload.longitude, false);

    // Emit the data and the data point count to the client
    io.emit("air-quality-data", {
      deviceId: deviceId,
      co2: decodedPayload.co2,
      latitude: decodedPayload.latitude, // Decimal latitude
      longitude: decodedPayload.longitude, // Decimal longitude
      latitudeDMS: latitudeDMS, // DMS latitude for display
      longitudeDMS: longitudeDMS, // DMS longitude for display
      timestamp: Date.now(),
      dataPointCount: dataPointCount, // Send the count
      averageCO2: averageCO2 // Average CO2 value
    });
  } catch (error) {
    console.error("Error parsing message:", error.message);
  }
});


// Start the server on port 3000
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
