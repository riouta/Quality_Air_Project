
// Définition de la broche analogique connectée au capteur
#define AIR_QUALITY_PIN A3

void setup() {
  Serial.begin(9600); // Initialisation de la communication série
}

void loop() {
  // Lire la valeur analogique
  int sensorValue = analogRead(AIR_QUALITY_PIN);

  // Convertir la valeur en tension (optionnel)
  float voltage = sensorValue * (5.0 / 1023.0);

  // Afficher les valeurs
  Serial.print("Valeur brute : ");
  Serial.print(sensorValue);
  Serial.print(" | Tension : ");
  Serial.print(voltage);
  Serial.println(" V");

  delay(1000); // Pause entre les lectures
}
