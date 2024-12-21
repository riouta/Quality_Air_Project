function decodeUplink(input) {
    return {
        data: {
            // air quality
            co2: (input.bytes[0] << 8) | input.bytes[1], // CO2 in ppm (2 octets)

            // GPS
            latitude: bytesToFloat(input.bytes.slice(4, 8)), // Latitude (4 octets)
            longitude: bytesToFloat(input.bytes.slice(8, 12)) // Longitude (4 octets)
        }
    };
}

// Helper function to decode floats (4 octets en IEEE 754)
function bytesToFloat(bytes) {
    var bits = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    var sign = (bits >>> 31 === 0) ? 1.0 : -1.0;
    var exponent = ((bits >>> 23) & 0xFF) - 127;
    var mantissa = (bits & 0x7FFFFF) | 0x800000;
    return sign * mantissa * Math.pow(2, exponent - 23);
}
