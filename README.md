# DosBocados · Punto de venta

App de punto de venta para DosBocados: toma de pedidos por mesa, para llevar y WhatsApp, tickets de cocina y de cobro, cobro y corte de caja. Corre en una tablet Android y guarda todo en la tablet aunque falle el internet.

## Instalar en la tablet

1. En GitHub, abre la pestaña **Actions** del repositorio y entra a la última ejecución de **Android APK** que esté en verde.
2. Al final de la página, en **Artifacts**, descarga `dosbocados-apk` (es un .zip con el archivo `app-debug.apk`).
3. Pasa el `.apk` a la tablet y ábrelo. Android pedirá permitir "instalar apps de origen desconocido" la primera vez.

## Desarrollo

Requisitos: Node 22. Para compilar el APK en tu computadora también necesitas Java 21 y el Android SDK (Android Studio los instala).

```sh
npm install
npm run dev            # abre la app en el navegador
npm run build          # revisa tipos y genera la versión web
npm run android:sync   # copia la versión web al proyecto Android
cd android && ./gradlew assembleDebug   # genera el APK
```

## Stack

React + TypeScript + Vite, empaquetado para Android con Capacitor.
