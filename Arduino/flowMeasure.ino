#include <Arduino.h>

const uint8_t sensorPin = D2; // D2 → GPIO4
volatile unsigned long pulseCount = 0;

void ICACHE_RAM_ATTR increase()
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
}

void loop()
{
    static unsigned long lastTime = 0;
    if (millis() - lastTime >= 2000)
    {
        noInterrupts();
        unsigned long pulses = pulseCount;
        pulseCount = 0;
        interrupts();

        float flowLpm = (2.663f * pulses / 1000.0f) * 30.0f;
        Serial.print(flowLpm, 2);
        Serial.println(" L/min");

        lastTime += 2000;
    }
}
