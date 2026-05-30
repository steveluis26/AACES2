# SPV Mobile App

Aplicación móvil de SPV construida con React Native y Expo para iOS y Android.

## Características

- ✅ **Funcionamiento 100% offline**
- ✅ **Sincronización automática** cuando hay internet
- ✅ **Multi-sectorial** (tiendas, restaurantes, escuelas, consultorios)
- ✅ **Cámara para escaneo** de códigos de barras
- ✅ **Impresión térmica** via Bluetooth/WiFi
- ✅ **Notificaciones push** para recordatorios

## Arquitectura Offline-First

### 1. **Base de Datos Local**
```typescript
// Usando SQLite para almacenamiento local
- Productos e inventario
- Ventas y transacciones
- Clientes y pacientes
- Configuración del negocio
```

### 2. **Sincronización Inteligente**
```typescript
// Cuando hay conexión:
1. Envia cambios pendientes al servidor
2. Descarga actualizaciones de otros dispositivos
3. Resuelve conflictos automáticamente
4. Mantiene copia de seguridad en cloud
```

### 3. **Funcionamiento Offline**
```typescript
// Sin conexión:
✅ Ventas completas
✅ Búsqueda de productos
✅ Gestión de clientes
✅ Reportes locales
✅ Impresión de tickets
```

## Instalación

```bash
# Instalar Expo CLI
npm install -g expo-cli

# Clonar y configurar
cd mobile-app
npm install

# Ejecutar en modo desarrollo
expo start
```

## Estructura del Proyecto

```
spv-mobile/
├── src/
│   ├── components/          # Componentes reutilizables
│   ├── screens/            # Pantallas por sector
│   ├── stores/             # Estado global (Zustand)
│   ├── services/           # APIs y sincronización
│   ├── database/           # SQLite y queries
│   ├── utils/              # Funciones auxiliares
│   └── types/              # TypeScript interfaces
├── assets/                 # Imágenes y recursos
└── app.json               # Configuración de Expo
```

## Características por Sector

### 📱 **Tiendas Minoristas**
- Escaneo de códigos de barras
- Inventario offline completo
- Ventas rápidas con carrito
- Búsqueda por nombre/código
- Impresión de tickets

### 🍽️ **Restaurantes**
- Menú digital con imágenes
- Gestión de mesas visual
- Comandas con modificadores
- Impresión en cocina
- División de cuentas

### 🎓 **Escuelas**
- Lista de alumnos offline
- Registro de pagos
- Historial académico
- Comunicación con padres
- Reportes de asistencia

### 🏥 **Consultorios**
- Calendario de citas
- Fichas médicas offline
- Historial de consultas
- Recetas médicas
- Recordatorios automáticos

## Tecnologías Utilizadas

- **React Native + Expo** - Framework principal
- **SQLite** - Base de datos local
- **Zustand** - Estado global
- **React Query** - Sincronización con servidor
- **Expo Camera** - Escaneo de códigos
- **Expo Print** - Impresión térmica
- **Expo Notifications** - Notificaciones push

## Configuración de Sincronización

```typescript
// Configuración de sync automático
const syncConfig = {
  autoSync: true,           // Sincronizar automáticamente
  syncInterval: 30000,      // Cada 30 segundos
  retryAttempts: 3,         // Reintentos en caso de fallo
  batchSize: 100,           // Tamaño de lotes
  conflictResolution: 'server-wins' // Política de conflictos
}
```

## Manejo de Conflictos

Cuando hay conflicto entre versión local y servidor:

1. **Versión más reciente gana** (por defecto)
2. **Versión del servidor gana** (para configuraciones)
3. **Merge inteligente** (para inventario)
4. **Notificación al usuario** (para ventas)

## Seguridad

- ✅ Encriptación de datos sensibles
- ✅ Autenticación biométrica
- ✅ Sesiones con timeout
- ✅ Backup automático
- ✅ Cumplimiento GDPR

## Performance

- **Arranque rápido**: < 2 segundos
- **Búsqueda instantánea**: < 100ms
- **Ventas offline**: < 500ms
- **Sincronización**: Background sin afectar UX

## Testing

```bash
# Tests unitarios
npm run test

# Tests de sincronización
npm run test:sync

# Tests offline
npm run test:offline
```

## Distribución

### App Stores
- **Apple App Store** - iOS
- **Google Play Store** - Android
- **Huawei AppGallery** - Huawei

### Actualizaciones
- **Over-the-air (OTA)** - Sin aprobación de tiendas
- **Versionado gradual** - Rollback automático si hay errores
- **Tamaño optimizado** - < 25MB por actualización

## Soporte

- 📧 Email: soporte@spv.app
- 💬 Chat en vivo: 24/7
- 📚 Documentación: docs.spv.app
- 🎥 Tutoriales: YouTube.com/spvapp

## Roadmap

### Q1 2025
- [ ] Soporte para wearables
- [ ] Integración con POS físicos
- [ ] Analytics avanzados

### Q2 2025
- [ ] Inteligencia artificial
- [ ] Reconocimiento de voz
- [ ] Pagos con NFC

### Q3 2025
- [ ] Realidad aumentada
- [ ] Integración blockchain
- [ ] Marketplace de plugins