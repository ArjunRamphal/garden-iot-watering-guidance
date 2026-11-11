/* COMP717A: Grove Moisture Sensor v1.4 -> classic Arduino Uno -> USB.
   Red: 5V; black: GND; yellow: A0; white: leave disconnected.
   No external Arduino libraries. Do not power the sensor from a GPIO pin.
   This sketch sends raw ADC counts, NOT volumetric water content.
*/
#include <Arduino.h>

const uint8_t SENSOR_PIN = A0;
const uint8_t SAMPLE_COUNT = 9;
const unsigned long INTERVAL_MS = 1000UL;
unsigned long previousSample = 0;
uint32_t sequenceNumber = 0;
bool firstSample = true;

void setup() {
  pinMode(SENSOR_PIN, INPUT);
  Serial.begin(115200);
}

void loop() {
  unsigned long now = millis();
  // Unsigned subtraction continues to work when millis() wraps.
  if (!firstSample && (unsigned long)(now - previousSample) < INTERVAL_MS) return;
  firstSample = false;
  previousSample = now;
  uint16_t values[SAMPLE_COUNT];
  analogRead(SENSOR_PIN);  // Discard one conversion before the burst.
  for (uint8_t i = 0; i < SAMPLE_COUNT; ++i) {
    values[i] = analogRead(SENSOR_PIN);
    delay(5);
  }
  // Small, fixed-size insertion sort; no dynamic String allocation.
  for (uint8_t i = 1; i < SAMPLE_COUNT; ++i) {
    uint16_t key = values[i];
    int8_t j = i - 1;
    while (j >= 0 && values[j] > key) {
      values[j + 1] = values[j];
      --j;
    }
    values[j + 1] = key;
  }
  Serial.print(F("{\"v\":1,\"node\":\"SOIL-01\",\"seq\":"));
  Serial.print(sequenceNumber++);
  Serial.print(F(",\"uptime_ms\":"));
  Serial.print(millis());
  Serial.print(F(",\"raw\":"));
  Serial.print(values[SAMPLE_COUNT / 2]);
  Serial.print(F(",\"n\":9,\"min\":"));
  Serial.print(values[0]);
  Serial.print(F(",\"max\":"));
  Serial.print(values[SAMPLE_COUNT - 1]);
  Serial.println(F("}"));
}
