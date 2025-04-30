#include <Arduino.h>
#if defined(ESP32)
#include <WiFi.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#endif
#include <Firebase_ESP_Client.h>

// Firebase “addons” (make sure these are in your sketch folder under /addons/)
#include "addons/TokenHelper.h" // for token generation callbacks
#include "addons/RTDBHelper.h"  // for RTDB payload helpers

// ———– Wi-Fi credentials ———–
#define WIFI_SSID "Xiomi"
#define WIFI_PASSWORD "12345678"

// ———– Firebase RTDB setup ———–
#define API_KEY "AIzaSyCkLaDFyOhAZXLeBYLZU9c0vQUDFTw8oYk"
#define DATABASE_URL "https://smart-water-meter-e01fd-default-rtdb.firebaseio.com/"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ———– Flow sensor on D2 (GPIO4) ———–
const uint8_t sensorPin = D2;
volatile unsigned long pulseCount = 0;

// Timing & conversion constants
unsigned long lastTime = 0;
const float litersPerPulse = 2.663f / 1000.0f; // each pulse = 0.002663 L

// Results
float flowRateLpm = 0.0f;
float totalVolumeL = 0.0f;

// ISR: increment pulseCount on each falling edge
ICACHE_RAM_ATTR void increase()
{
    pulseCount++;
}

void setup()
{
    Serial.begin(115200);

    // — sensor interrupt setup —
    pinMode(sensorPin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(sensorPin),
                    increase,
                    FALLING);

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

    // anonymous sign-up
    if (Firebase.signUp(&config, &auth, "", ""))
    {
        Serial.println("Firebase signup OK");
    }
    else
    {
        Serial.print("Signup failed: ");
        Serial.println(config.signer.signupError.message.c_str());
    }

    // token callback required by the library
    config.token_status_callback = tokenStatusCallback;
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    // —––– NEW: restore last totalVolumeL from RTDB –––—
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

    lastTime = millis();
}

void loop()
{
    // only proceed if Firebase is ready
    if (!Firebase.ready())
        return;

    unsigned long now = millis();
    // every 2000 ms
    if (now - lastTime >= 2000)
    {
        // atomically grab & clear pulses
        noInterrupts();
        unsigned long pulses = pulseCount;
        pulseCount = 0;
        interrupts();

        // compute this-interval volume and flow rate
        float intervalVol = pulses * litersPerPulse;
        totalVolumeL += intervalVol;
        flowRateLpm = intervalVol * (60.0f / 2.0f);

        // debug print
        Serial.printf("Flow: %.2f L/min   |   Total: %.3f L\n",
                      flowRateLpm, totalVolumeL);

        // — write to Firebase RTDB —
        // flowRate
        if (Firebase.RTDB.setFloat(&fbdo, "/flowRateLpm", flowRateLpm))
        {
            Serial.println("✓ flowRateLpm updated");
        }
        else
        {
            Serial.print("✗ flowRateLpm failed: ");
            Serial.println(fbdo.errorReason().c_str());
        }
        // totalVolume
        if (Firebase.RTDB.setFloat(&fbdo, "/totalVolumeL", totalVolumeL))
        {
            Serial.println("✓ totalVolumeL updated");
        }
        else
        {
            Serial.print("✗ totalVolumeL failed: ");
            Serial.println(fbdo.errorReason().c_str());
        }

        lastTime += 2000;
    }
}
