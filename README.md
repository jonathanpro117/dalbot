# DarkBot duplicación rápida

Guía en español para clonar y compilar el repositorio público de **DarkBot** (`https://github.com/darkbot-reloaded/DarkBot`).

## Prerrequisitos
- Git
- Java 17 (JDK)
- Gradle (el repo incluye `gradlew`, no necesitas instalarlo aparte)

## Pasos para duplicar el proyecto
1. Clona el repositorio oficial:
   ```bash
   git clone https://github.com/darkbot-reloaded/DarkBot.git
   cd DarkBot
   ```
2. Verifica que Java 17 esté disponible:
   ```bash
   java -version
   ```
   Si la versión es menor a 17, instala o selecciona el JDK 17 antes de continuar.
3. Compila con Gradle usando el wrapper incluido (no necesitas tener Gradle instalado):
   ```bash
   ./gradlew clean build
   ```
   Esto descarga dependencias y genera el JAR en `build/libs/` (p. ej. `DarkBot.jar` o `DarkBot-<versión>.jar`).
4. Ejecuta el bot con Java usando el JAR recién construido:
   ```bash
   java -jar build/libs/DarkBot.jar
   ```
   Si el nombre del archivo incluye versión, ajusta el comando, por ejemplo `java -jar build/libs/DarkBot-1.131.7.jar`.
5. Copia tus archivos de configuración (`config.json`, `credentials.json`, etc.) al mismo directorio del JAR si necesitas conservar ajustes previos.

## Consejos
- Si la descarga de librerías falla, revisa tu conexión y permisos de escritura; el bot crea carpetas `lib/` y `plugins/` en el directorio de trabajo.
- Para inspeccionar o modificar el código, abre el proyecto en IntelliJ IDEA o VS Code con extensión Java; ambos reconocen automáticamente el proyecto Gradle.
- Usa `./gradlew run` si quieres lanzar el bot directamente desde el entorno de desarrollo.
- En Windows, puedes usar los mismos comandos con Git Bash o PowerShell (reemplaza `./gradlew` por `gradlew.bat`).
- Si cambias de máquina, solo necesitas repetir el `git clone` y el `./gradlew build`; las dependencias y plugins se descargarán solos en la primera ejecución.
