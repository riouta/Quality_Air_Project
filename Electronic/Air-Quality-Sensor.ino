#include <lmic.h>
#include <hal/hal.h>
#include <SPI.h>
#include <Wire.h>
#include <math.h>
#include <TinyGPS.h>

// Used for software SPI
#define LIS3DH_CLK 13
#define LIS3DH_MISO 12
#define LIS3DH_MOSI 11


// Used for hardware & software SPI
#define LIS3DH_CS 10

TinyGPS gps;
unsigned long lastUpdate = 0;

unsigned long acc_timer = millis();

const int taskDelay = 100;

// TTN Configuration
static const u1_t PROGMEM APPEUI[8] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
void os_getArtEui (u1_t* buf) { memcpy_P(buf, APPEUI, 8);}

// This should also be in little endian format, see above.
static const u1_t PROGMEM DEVEUI[8] = { 0x79, 0xC1, 0x06, 0xD0, 0x7E, 0xD5, 0xB3, 0x70 };
void os_getDevEui (u1_t* buf) { memcpy_P(buf, DEVEUI, 8);}

// This key should be in big endian format (or, since it is not really a
// number but a block of memory, endianness does not really apply). In
// practice, a key taken from the TTN console can be copied as-is.
static const u1_t PROGMEM APPKEY[16] = {0xE3, 0x5D, 0x11, 0xBB, 0x5D, 0xDE, 0x2A, 0x7A, 0xB1, 0x61, 0xEB, 0x18, 0xDB, 0xDC, 0x3A, 0x9F};
void os_getDevKey (u1_t* buf) {  memcpy_P(buf, APPKEY, 16);}

// payload to send to TTN gateway
static uint8_t payload[16];
static osjob_t sendjob;

// Schedule TX every this many seconds (might become longer due to duty
// cycle limitations).
const unsigned TX_INTERVAL = 30;

// Pin mapping for Adafruit Feather M0 LoRa
const lmic_pinmap lmic_pins = {
    .nss = 8,
    .rxtx = LMIC_UNUSED_PIN,
    .rst = 4,
    .dio = {3, 6, LMIC_UNUSED_PIN},
    .rxtx_rx_active = 0,
    .rssi_cal = 8,              // LBT cal for the Adafruit Feather M0 LoRa, in dB
    .spi_freq = 8000000,
};


void setup() {
    delay(1000);
    while (! Serial);
    Serial.begin(115200);
    Serial1.begin(9600);

    pinMode(A3, INPUT);

    // LMIC init.
    os_init();
    // Reset the MAC state. Session and pending data transfers will be discarded.
    LMIC_reset();
    // Disable link-check mode and ADR, because ADR tends to complicate testing.
    LMIC_setLinkCheckMode(0);
    // Set the data rate to Spreading Factor 7.  This is the fastest supported rate for 125 kHz channels, and it
    // minimizes air time and battery power. Set the transmission power to 14 dBi (25 mW).
    LMIC_setDrTxpow(DR_SF7,14);
    // in the US, with TTN, it saves join time if we start on subband 1 (channels 8-15). This will
    // get overridden after the join by parameters from the network. If working with other
    // networks or in other regions, this will need to be changed.
    //LMIC_selectSubBand(1);

    // Start job (sending automatically starts OTAA too)
    do_send(&sendjob);
}

void loop() {
    // we call the LMIC's runloop processor. This will cause things to happen based on events and time. One
    // of the things that will happen is callbacks for transmission complete or received messages. We also
    // use this loop to queue periodic data transmissions.  You can put other things here in the `loop()` routine,
    // but beware that LoRaWAN timing is pretty tight, so if you do more than a few milliseconds of work, you
    // will want to call `os_runloop_once()` every so often, to keep the radio running.
    
    
    os_runloop_once();

    if (millis() - acc_timer > taskDelay) {
        buildPayload();
    }

    
    gps_func();
}

void onEvent (ev_t ev) {
    switch(ev) {
        case EV_SCAN_TIMEOUT:
            Serial.println(F("EV_SCAN_TIMEOUT"));
            break;
        case EV_BEACON_FOUND:
            Serial.println(F("EV_BEACON_FOUND"));
            break;
        case EV_BEACON_MISSED:
            Serial.println(F("EV_BEACON_MISSED"));
            break;
        case EV_BEACON_TRACKED:
            Serial.println(F("EV_BEACON_TRACKED"));
            break;
        case EV_JOINING:
            Serial.println(F("EV_JOINING"));
            break;
        case EV_JOINED:
            Serial.println(F("EV_JOINED"));
            LMIC_setLinkCheckMode(0);
            break;
        case EV_JOIN_FAILED:
            Serial.println(F("EV_JOIN_FAILED"));
            break;
        case EV_REJOIN_FAILED:
            Serial.println(F("EV_REJOIN_FAILED"));
            break;
        case EV_TXCOMPLETE:            
            Serial.println(F("Payload sent successfully"));
            // Schedule next transmission
            os_setTimedCallback(&sendjob, os_getTime()+sec2osticks(TX_INTERVAL), do_send);
            break;
        case EV_LOST_TSYNC:
            Serial.println(F("EV_LOST_TSYNC"));
            break;
        case EV_RESET:
            Serial.println(F("EV_RESET"));
            break;
        case EV_RXCOMPLETE:
            // data received in ping slot
            Serial.println(F("EV_RXCOMPLETE"));
            break;
        case EV_LINK_DEAD:
            Serial.println(F("EV_LINK_DEAD"));
            break;
        case EV_LINK_ALIVE:
            Serial.println(F("EV_LINK_ALIVE"));
            break;
        case EV_TXSTART:
            Serial.println(F("Starting new transmission"));
            break;
        default:
            Serial.print(F("ERROR: Unknown event "));
            Serial.println(ev);
            break;
    }
}

float latitude = 0.0;
float longitude = 0.0;

void gps_func() {
  while (Serial1.available()) {
    char c = Serial1.read();
    gps.encode(c);
  }

  if (millis() - lastUpdate > 5000) {
    lastUpdate = millis();

    unsigned long age;
    gps.f_get_position(&latitude, &longitude, &age);

    if (latitude == TinyGPS::GPS_INVALID_F_ANGLE) latitude = 0.0;
    if (longitude == TinyGPS::GPS_INVALID_F_ANGLE) longitude = 0.0;

    Serial.print("Latitude: ");
    Serial.println(latitude, 6);

    Serial.print("Longitude: ");
    Serial.println(longitude, 6);

    Serial.print("AIR SENSOR : ");
    Serial.println(analogRead(A3), 1);

    Serial.println();
  }
}

void buildPayload() {
    // Dummy air quality data
    uint16_t co2 = analogRead(A3);  // CO2 concentration in ppm

    uint16_t scaled_co2 = map(co2, 0, 1023, 0, 1000);

    // Encode air quality data
    payload[0] = (scaled_co2 >> 8) & 0xFF; // air MSB
    payload[1] = scaled_co2 & 0xFF;        // air LSB

    // Encode latitude and longitude as IEEE 754 floats
    floatToBytes(latitude, &payload[4]);  // Latitude (4 bytes)
    floatToBytes(longitude, &payload[8]); // Longitude (4 bytes)

    // Fill remaining bytes with zeros if needed
    for (int i = 12; i < 16; i++) {
        payload[i] = 0x00;
    }
/*
    for (int i = 0; i < 16; i++) {
        Serial.print(payload[i], HEX);
        Serial.print(" ");
    }
    Serial.println("build payload END ");
*/
}

// Helper function to encode a float (4 bytes in IEEE 754)
void floatToBytes(float value, uint8_t* buffer) {
    union {
        float f;
        uint32_t i;
    } u;
    u.f = value;

    // Encode in big-endian
    buffer[0] = (u.i >> 24) & 0xFF; // MSB
    buffer[1] = (u.i >> 16) & 0xFF;
    buffer[2] = (u.i >> 8) & 0xFF;
    buffer[3] = u.i & 0xFF;         // LSB
}


void do_send(osjob_t* j){
    // Check if there is not a current TX/RX job running
    if (LMIC.opmode & OP_TXRXPEND) {
        Serial.println(F("OP_TXRXPEND, not sending"));
    } 
    else {
        // prepare upstream data transmission at the next possible time.
        // transmit on port 1 (the first parameter); you can use any value from 1 to 223 (others are reserved).
        // don't request an ack (the last parameter, if not zero, requests an ack from the network).
        // Remember, acks consume a lot of network resources; don't ask for an ack unless you really need it.
        // LMIC_setTxData2(1, payload, sizeof(payload)-1, 0);
        LMIC_setTxData2(1, payload, sizeof(payload), 0);

    }
    // Next TX is scheduled after TX_COMPLETE event.
}