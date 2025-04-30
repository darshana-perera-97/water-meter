#include <Arduino.h>

const uint8_t sensorPin = D2; // D2 → GPIO4 on NodeMCU
volatile unsigned long pulseCount = 0;

unsigned long lastTime = 0;
const float litersPerPulse = 2.663f / 1000.0f; // 2.663 L per 1000 pulses

// these will hold your two results:
float flowRateLpm = 0.0f;  // instantaneous flow (L/min)
float totalVolumeL = 0.0f; // cumulative volume (L)

ICACHE_RAM_ATTR void increase()
{
    pulseCount++;
}

void setup()
{
    Serial.begin(115200);
    pinMode(sensorPin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(sensorPin),
                    increase,
                    FALLING);
    lastTime = millis();
}

void loop()
{
    unsigned long now = millis();
    // every 2 seconds
    if (now - lastTime >= 2000)
    {
        // grab & clear count atomically
        noInterrupts();
        unsigned long pulses = pulseCount;
        pulseCount = 0;
        interrupts();

        // calculate volume in this interval (in liters):
        float intervalVolume = pulses * litersPerPulse;
        // add to total:
        totalVolumeL += intervalVolume;

        // convert to L/min: (intervalVolume L) * (60 sec / 2 sec)
        flowRateLpm = intervalVolume * (60.0f / 2.0f);

        // print both
        Serial.print("Flow: ");
        Serial.print(flowRateLpm, 2);
        Serial.print(" L/min   |  Total: ");
        Serial.print(totalVolumeL, 3);
        Serial.println(" L");

        lastTime += 2000;
    }
}
