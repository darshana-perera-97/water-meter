// Blink.ino
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);  // Initialize the onboard LED pin as output
}

void loop() {
  digitalWrite(LED_BUILTIN, LOW);   // Turn LED on (LOW is active)
  delay(1000);                      // Wait 1 second
  digitalWrite(LED_BUILTIN, HIGH);  // Turn LED off
  delay(1000);                      // Wait 1 second
}
