#include <Arduino.h>
#if defined(ESP32)
#include <WiFi.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#endif
#include <Firebase_ESP_Client.h>

// Firebase “addons”
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// — Wi-Fi credentials —
#define WIFI_SSID "Xiomi"
#define WIFI_PASSWORD "12345678"

// — Firebase RTDB setup —
#define API_KEY "AIzaSyCkLaDFyOhAZXLeBYLZU9c0vQUDFTw8oYk"
#define DATABASE_URL "https://smart-water-meter-e01fd-default-rtdb.firebaseio.com/"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// — Flow sensor on D2 (GPIO4) —
const uint8_t sensorPin = D2;
volatile unsigned long pulseCount = 0;

// — Valve control pin —
// Pick any free digital pin; here we use D1 (GPIO5)
const uint8_t valveControlPin = D1;

/// Timing & conversion constants
const float litersPerPulse = 2.663f / 1000.0f; // each pulse = 0.002663 L

/// State variables
unsigned long lastFlowTime = 0;
unsigned long lastCounterTime = 0;
float flowRateLpm = 0.0f;
float totalVolumeL = 0.0f;
unsigned long counter = 0;
bool valveState = false;

// ISR: increment pulseCount on each falling edge
ICACHE_RAM_ATTR void increase()
{
    pulseCount++;
}

void setup()
{
    Serial.begin(115200);

    // — Sensor interrupt setup —
    pinMode(sensorPin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(sensorPin), increase, FALLING);

    // — Valve pin setup —
    pinMode(valveControlPin, OUTPUT);
    digitalWrite(valveControlPin, LOW); // default to “closed”

    // — Wi-Fi connect —
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connecting to Wi-Fi");
    while (WiFi.status() != WL_CONNECTED)
    {
        Serial.print('.');
        delay(300);
    }
    Serial.println();
    Serial.print("Connected! IP = ");
    Serial.println(WiFi.localIP());

    // — Firebase sign-up & init —
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;
    if (Firebase.signUp(&config, &auth, "", ""))
    {
        Serial.println("Firebase signup OK");
    }
    else
    {
        Serial.print("Signup failed: ");
        Serial.println(config.signer.signupError.message.c_str());
    }
    config.token_status_callback = tokenStatusCallback;
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    // — Restore last totalVolumeL from RTDB —
    if (Firebase.RTDB.getFloat(&fbdo, "/totalVolumeL"))
    {
        totalVolumeL = fbdo.floatData();
        Serial.print("Restored totalVolumeL = ");
        Serial.println(totalVolumeL, 3);
    }
    else
    {
        Serial.print("Could not restore totalVolumeL: ");
        Serial.println(fbdo.errorReason().c_str());
        totalVolumeL = 0.0f;
    }

    // Initialize timers
    lastFlowTime = millis();
    lastCounterTime = millis();
}

void loop()
{
    if (!Firebase.ready())
        return;
    unsigned long now = millis();

    // — Every 1 second: increment counter, send it & read /valve —
    if (now - lastCounterTime >= 1000)
    {
        lastCounterTime += 1000;

        // increment & send counter
        counter++;
        Serial.printf("Counter: %lu\n", counter);
        if (Firebase.RTDB.setInt(&fbdo, "/counter", counter))
        {
            Serial.println("✓ counter updated");
        }
        else
        {
            Serial.print("✗ counter failed: ");
            Serial.println(fbdo.errorReason().c_str());
        }

        // read valve state (assumes boolean in RTDB)
        if (Firebase.RTDB.getBool(&fbdo, "/valve"))
        {
            valveState = fbdo.boolData();
            Serial.print("Valve state: ");
            Serial.println(valveState ? "OPEN" : "CLOSED");

            // — Drive the valve control pin! —
            // If you’re using a relay or MOSFET, HIGH might open;
            // invert if your hardware logic is opposite.
            digitalWrite(valveControlPin, valveState ? HIGH : LOW);
        }
        else
        {
            Serial.print("✗ get valve failed: ");
            Serial.println(fbdo.errorReason().c_str());
        }
    }

    // — Every 2 seconds: compute & send flow data —
    if (now - lastFlowTime >= 2000)
    {
        lastFlowTime += 2000;

        // grab & clear pulses
        noInterrupts();
        unsigned long pulses = pulseCount;
        pulseCount = 0;
        interrupts();

        // compute volume & flow rate
        float intervalVol = pulses * litersPerPulse;
        totalVolumeL += intervalVol;
        flowRateLpm = intervalVol * (60.0f / 2.0f);

        Serial.printf("Flow: %.2f L/min   |   Total: %.3f L\n",
                      flowRateLpm, totalVolumeL);

        // send flowRateLpm
        if (Firebase.RTDB.setFloat(&fbdo, "/flowRateLpm", flowRateLpm))
        {
            Serial.println("✓ flowRateLpm updated");
        }
        else
        {
            Serial.print("✗ flowRateLpm failed: ");
            Serial.println(fbdo.errorReason().c_str());
        }

        // send totalVolumeL
        if (Firebase.RTDB.setFloat(&fbdo, "/totalVolumeL", totalVolumeL))
        {
            Serial.println("✓ totalVolumeL updated");
        }
        else
        {
            Serial.print("✗ totalVolumeL failed: ");
            Serial.println(fbdo.errorReason().c_str());
        }
    }
}
