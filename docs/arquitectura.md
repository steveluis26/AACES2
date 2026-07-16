# AACES — Arquitectura v1.1

> Documento de contratos congelados. Todo desarrollo futuro debe respetar las
> definiciones aquí establecidas. No modificar sin actualizar este documento y
> aprobación explícita.

---

## 1. Principios Arquitectónicos

1. **Multi-tenant estricto.** Toda consulta SQL filtra por `organizacion_id`
   obtenido exclusivamente del JWT. El frontend nunca envía IDs de organización.
2. **Producto primero.** Se construye antes lo que el cliente paga (constancias
   verificables). Infraestructura (EventBus, analytics) se agrega cuando existan
   procesos reales que la justifiquen.
3. **Dominios separados.** `Constancia` (activo documental) y `Evento`
   (bitácora de negocio) son tablas distintas con propósitos distintos.
4. **Inmutabilidad probatoria.** Una constancia emitida nunca se modifica. Solo
   se cancela o reemite con nuevo código.
5. **El PDF es una consecuencia.** El acto de emitir crea la constancia en el
   sistema. El PDF es el resultado de un pipeline de generación posterior.
6. **El motor de documentos no conoce tipos de documento.** Operan sobre
   `Template`, `DocumentDefinition` y `Renderer`. No hay acoplamiento a
   Constancia, DC-3, Diploma ni ningún otro tipo específico.

---

## 2. Modelo de Dominio

### 2.1 Entidades

```
Organizacion (1)
  ├── Usuario (N)                — personas que operan el sistema
  ├── Suscripcion (N)            — plan contratado (vigencia, límites)
  ├── Template (N)               — modelos de documento por tipo
  │     └── (cada fila es una versión inmutable;
  │          template_group_id agrupa versiones del mismo template)
  ├── Curso (N)
  │     └── CursoParticipante (N)
  │           └── Participante (N)
  └── Constancia (N)             — activo documental emitido
        ├── codigo_validacion    — UUID único público
        ├── template_id          — apunta a la versión exacta usada
        ├── pdf_hash             — SHA-256 del PDF (inmutable)
        ├── storage_provider     — 'local' | 's3' | 'r2' | 'azure'
        └── storage_key          — ruta relativa en el provider
```

### 2.2 Modelo: `Template`

```yaml
Template:
  id: UUID (PK)
  organizacion_id: UUID (FK → organizaciones.id, NOT NULL)
  template_group_id: UUID       # agrupa todas las versiones del mismo template
  tipo_documento: enum(CONSTANCIA, DC3, DIPLOMA, CREDENCIAL, OTRO)
  version: integer              # autoincrement por (organizacion_id, template_group_id)
  nombre: string(200)
  activa: boolean               # solo una activa por (organizacion_id, tipo_documento)
  recursos: JSONB               # { logo_url, firma1_url, firma2_url,
                                #   fondo_url, sello_url }
  config: JSONB                 # { posicion_qr: {x, y, w, h},
                                #   tipografia: {familia, tamano, color},
                                #   colores: {primario, secundario, fondo},
                                #   margenes: {sup, inf, izq, der},
                                #   alineacion: texto,
                                #   tamano_hoja: string }
  html_template: TEXT           # plantilla HTML con variables {{ }}
  fecha_creacion: timestamptz
  creada_por: UUID (FK → usuarios.id)

  UniqueConstraint(organizacion_id, template_group_id, version)
  Index(organizacion_id, tipo_documento, activa)
```

Reglas:
- **Cada fila es una versión inmutable.** Nunca se hace UPDATE sobre una fila
  existente de Template. Un cambio en el template produce un nuevo INSERT con
  `version + 1` y el mismo `template_group_id`.
- `template_group_id` se genera una sola vez (UUID v4) cuando se crea el
  template por primera vez. Todas las versiones posteriores lo heredan.
- `activa` se cambia dentro de una misma transacción: se desactiva la versión
  anterior y se activa la nueva.
- `recursos` contiene URLs o referencias a archivos subidos (logo, firmas,
  fondo, sello). No almacena binarios.
- `config` contiene parámetros de diseño. El `TemplateEngine` lo interpreta
  al renderizar.
- `html_template` es la plantilla HTML con marcadores `{{ variable }}`.
  El motor de renderizado la procesa.

### 2.3 Modelo: `Constancia`

```yaml
Constancia:
  id: UUID (PK)
  organizacion_id: UUID (FK → organizaciones.id, NOT NULL)
  curso_participante_id: UUID (FK → curso_participante.id, NOT NULL)
  codigo_validacion: UUID      (UNIQUE, público, generado en emisión)
  template_id: UUID (FK → templates.id)  # apunta a la versión exacta usada
  storage_provider: string(50)  # 'local' | 's3' | 'r2' | 'azure'
  storage_key: string(500)      # ruta relativa dentro del provider
  pdf_hash: string(64)          # SHA-256 hex
  html_snapshot: TEXT           # HTML renderizado en el momento de emisión
  metadata: JSONB               # datos usados para generar (nombre, curso, etc.)
  estatus: enum(emitida, cancelada, reemitida)
  emitida_en: timestamptz
  emitida_por: UUID (FK → usuarios.id)
  cancelada_en: timestamptz?
  cancelada_por: UUID?
  motivo_cancelacion: string(500)?
```

Reglas:
- `codigo_validacion` se genera como UUID v4 al momento de emisión. Es el
  identificador público que va en el QR. **No depende del PDF ni de ningún
  otro dato.** Se puede regenerar el PDF mil veces, el código sigue siendo
  el mismo.
- `template_id` apunta a la versión exacta e inmutable del template usado.
  No se necesita `version` aparte: el template ES la versión.
- `storage_provider` + `storage_key` reemplazan a un `pdf_path` fijo.
  Permiten cambiar de proveedor de almacenamiento sin migrar datos.
  Ejemplo: `provider='local', key='2026/07/curso1/abc-123.pdf'`.
- `pdf_hash` se calcula sobre el PDF final (SHA-256 en hex). Sirve para
  verificar integridad del archivo.
- `html_snapshot` guarda el HTML renderizado en el momento exacto de emisión.
  Permite regenerar el PDF con otro motor en el futuro.
- `estatus` nunca vuelve a `emitida` desde `cancelada`. Una reemisión crea
  una nueva fila.
- Una constancia emitida no se modifica jamás. Solo se cancela o reemite.

---

## 3. Interfaces (Contratos)

### 3.1 StorageProvider

```python
class StorageProvider(ABC):
    @abstractmethod
    async def save(self, path: str, content: bytes) -> str: ...
    @abstractmethod
    async def get_stream(self, path: str) -> AsyncIterator[bytes]: ...
    @abstractmethod
    async def read(self, path: str) -> bytes: ...
    @abstractmethod
    async def delete(self, path: str) -> bool: ...
    @abstractmethod
    async def exists(self, path: str) -> bool: ...
    @abstractmethod
    async def url(self, path: str) -> str: ...
```

- `save` retorna la ruta relativa (storage_key).
- `get_stream` retorna el contenido como stream de bytes (para servir PDFs
  sin cargar todo en memoria).
- Primera implementación: `LocalStorageProvider` (disco local).
- Futuras: `S3StorageProvider`, `R2StorageProvider`, `AzureBlobProvider`.
- El `StorageProvider` se inyecta por dependencia; el negocio nunca sabe dónde
  están los archivos.

### 3.2 DocumentService

```python
class DocumentService:
    def __init__(self, template_engine, renderer, qr_service,
                 hash_service, storage_provider)

    async def generate(
        template: Template,
        data: dict,
        qr_data: str
    ) -> DocumentResult: ...
```

Responsabilidades:
1. `QRService.generate(qr_data)` → SVG del QR
2. `TemplateEngine.render(template, data)` → `DocumentDefinition`
3. `Renderer.render(doc_definition, qr_svg)` → bytes del PDF
4. `HashService.sha256(pdf_bytes)` → hash hex
5. `StorageProvider.save(storage_key, pdf_bytes)` → key

Retorna `DocumentResult { storage_provider, storage_key, pdf_hash, html_snapshot }`.

- `DocumentService` es **genérico**. No conoce constancias, cursos, ni
  participantes. No conoce tipos de documento.
- `qr_data` es la URL de verificación (`https://aaces.mx/v/{codigo}`). El QR
  es responsabilidad del DocumentService, no del módulo Constancias. Esto
  permite que Diplomas, DC-3, Credenciales, etc. también tengan QR sin
  duplicar lógica.

### 3.3 TemplateEngine

```python
class TemplateEngine:
    async def render(
        self,
        template: Template,
        data: dict
    ) -> DocumentDefinition: ...
```

- Toma un `Template` (con `html_template` y `config`) y los `data` con las
  variables a interpolar.
- Retorna un `DocumentDefinition` (objeto intermedio que describe el documento:
  HTML renderizado, configuración visual, recursos como logos y firmas).
- El `DocumentDefinition` es la única entrada del `Renderer`.
- Implementación base: Jinja2 para interpolar el HTML.
- **El motor NO conoce HTML.** `TemplateEngine` produce un
  `DocumentDefinition`; `Renderer` lo convierte a PDF. Mañana puedes cambiar
  el renderer (otro engine, browser-based, etc.) sin tocar el TemplateEngine.

```python
@dataclass
class DocumentDefinition:
    html: str                 # HTML renderizado con datos
    recursos: dict            # rutas a logos, firmas, etc.
    config: dict              # configuración visual (márgenes, colores, etc.)
```

### 3.4 Renderer

```python
class Renderer(ABC):
    @abstractmethod
    async def render(
        self,
        doc: DocumentDefinition,
        qr_svg: str
    ) -> bytes: ...
```

- Recibe un `DocumentDefinition` y el QR en SVG.
- Retorna bytes del PDF.
- Implementaciones posibles: `WeasyPrintRenderer`, `PdfKitRenderer`,
  `BrowserRenderer` (Puppeteer/Playwright).
- Separar `TemplateEngine` de `Renderer` permite cambiar la tecnología de
  generación de PDF sin tocar la lógica de plantillas.

### 3.5 QRService

```python
class QRService:
    async def generate(self, data: str) -> str: ...
```

- `data` es la URL de verificación (ej. `https://aaces.mx/v/abc-123`).
- Retorna SVG (no imagen PNG) para insertar directamente en el documento.
- El QR contiene **solo la URL**. Sin datos del participante, curso, etc.

### 3.6 HashService

```python
class HashService:
    async def sha256(self, content: bytes) -> str: ...
```

- Retorna hash SHA-256 en hex (64 caracteres).

---

## 4. ConstanciaService (Sprint 3)

### 4.1 Pipeline `emitir()`

```
EmitirConstancia(curso_participante_id, emitido_por)
  │
  ├─ 1. Validar datos del participante y curso
  ├─ 2. Obtener template activo para CONSTANCIA (organización desde JWT)
  ├─ 3. Generar codigo_validacion = uuid4()
  ├─ 4. Construir data dict con datos del participante + curso
  ├─ 5. DocumentService.generate(template, data, qr_url)
  │     ├─ QRService.generate(qr_url)
  │     ├─ TemplateEngine.render(template, data)
  │     │     └─ retorna DocumentDefinition
  │     ├─ Renderer.render(doc_definition, qr_svg)
  │     │     └─ retorna bytes del PDF
  │     ├─ HashService.sha256(pdf_bytes)
  │     └─ StorageProvider.save(storage_key, pdf_bytes)
  │
  ├─ 6. INSERT constancia (con template_id, storage_provider,
  │       storage_key, pdf_hash, html_snapshot, codigo_validacion)
  ├─ 7. Publicar evento constancia.emitida (Sprint 7+)
  └─ 8. Retornar { constancia_id, codigo, qr_url, pdf_url }
```

Este pipeline es lineal y fácil de seguir: **validar → obtener template →
generar codigo → renderizar documento → calcular hash → guardar archivo →
persistir constancia → responder**.

### 4.2 Modos de operación

| Modo | Flujo |
|------|-------|
| **Síncrono** | Pipeline completo, retorna inmediatamente |
| **Pendiente de firma** | Crear constancia sin PDF, estatus `pendiente` |
| **Cola/Worker** | Crear constancia, encolar generación, estatus `generando` |
| **Email** | Generar PDF + enviar por correo |

La implementación inicial es síncrona. Los otros modos se agregan sin cambiar
la firma de `emitir()` porque el PDF es consecuencia, no el proceso principal.

---

## 5. Verificación (Sprint 4)

```
GET /v/{codigo}
  │
  ├─ Buscar constancia por codigo_validacion
  ├─ Si no existe → 404
  ├─ Si cancelada → mostrar estado "cancelada"
  ├─ Si válida:
  │     ├─ nombre del participante
  │     ├─ nombre del curso
  │     ├─ agencia capacitadora (organización)
  │     ├─ fechas (inicio, fin, duración)
  │     ├─ código de validación
  │     └─ "Verificada mediante AACES"
  └─ Registrar evento verificacion.realizada (Sprint 7+)
```

Reglas:
- El QR contiene solo `https://aaces.mx/v/{codigo}`. Sin datos embebidos.
- La página de verificación es pública. No requiere autenticación.
- El diseño es limpio, profesional, responsive.

---

## 6. Convenciones Técnicas

### 6.1 Identificadores

- Todos los IDs primarios son `UUID v4`.
- El `codigo_validacion` de constancias también es `UUID v4`.
- Las claves foráneas son `UUID` con `ForeignKey` explícito.
- `template_group_id` es UUID v4, generado una sola vez al crear el template.
- Naming en BD: `snake_case`. Naming en Python: `snake_case`. Naming en JSON
  APIs: `snake_case`.

### 6.2 Tiempo

- Todas las columnas de fecha/hora usan `DateTime(timezone=True)`.
- Almacenamiento en UTC. Conversión a zona horaria del cliente solo en
  presentación (frontend).
- Columna por defecto: `server_default=func.now()`.
- Timestamps de actualización: `onupdate=func.now()`.

### 6.3 Enums

Los enums se definen como `CheckConstraint` en BD y como `enum.StrEnum` en
Python (o `enum` nativo si < 3.11). Nunca como columnas VARCHAR sin
constraint.

### 6.4 Versionado de templates

- `version` es integer autoincrement por `(organizacion_id, template_group_id)`.
- Cada fila de `Template` es inmutable. Nunca se hace UPDATE sobre una
  versión existente.
- `template_group_id` agrupa todas las versiones del mismo template lógico.
- El cambio de `activa` se hace en una transacción: desactiva la anterior,
  activa la nueva.

### 6.5 Almacenamiento de archivos

- La constancia guarda `storage_provider` + `storage_key` en lugar de una
  ruta fija. Esto permite cambiar de proveedor sin migrar datos.
- El `StorageProvider` abstrae la ubicación física. Por defecto:
  `LocalStorageProvider` en `./storage/`.
- `storage_key` sigue el patrón `{organizacion_id}/{tipo}/{codigo}.pdf`.
- `get_stream()` permite servir el PDF sin cargarlo completo en memoria.

### 6.6 Código de validación

- Se genera como `uuid4()` al momento de `emitir()`.
- **Nunca cambia**, incluso si se regenera el PDF.
- **No deriva del contenido del PDF** ni de ningún otro identificador.
- La relación correcta: `Constancia → codigo_validacion → PDF → QR`.

### 6.7 Recursos vs Configuración

El modelo `Template` separa dos aspectos:
- **recursos** (`JSONB`): referencias a archivos subidos (logo, firmas, fondo,
  sello). Son activos que se suben una vez y se referencian por URL.
- **config** (`JSONB`): parámetros de diseño (posición QR, tipografía, colores,
  márgenes, alineación, tamaño de hoja).

Esta separación permite construir un editor visual en el futuro sin mezclar
concernientes.

### 6.8 El motor no conoce HTML

El pipeline de documentos sigue esta secuencia:

```
Template
  │
  ▼
TemplateEngine.render(data)
  │
  ▼
DocumentDefinition   ← objeto intermedio (HTML + recursos + config)
  │
  ▼
Renderer.render(doc_def, qr_svg)
  │
  ▼
PDF bytes
```

`TemplateEngine` produce un `DocumentDefinition`. `Renderer` lo convierte
a PDF. Mañana puedes cambiar el `Renderer` (otro engine, browser-based,
etc.) sin tocar `TemplateEngine`.

---

## 7. Estados

### Constancia

```
emitida ──→ cancelada
  │
  └──→ reemitida (crea nueva constancia, la anterior queda cancelada)
```

### Template (activa/inactiva por versión)

```
v1 (inactiva)
v2 (inactiva)
v3 (activa)   ← actual
```

---

## 8. Arquitectura en Capas

```
┌──────────────────────────────────────────────────────┐
│                    FastAPI Routes                      │
│  (validación de input, auth, respuesta HTTP)          │
├──────────────────────────────────────────────────────┤
│                  Service Layer                         │
│  ConstanciaService, DashboardService, ...              │
├──────────────────────────────────────────────────────┤
│               Document Pipeline                        │
│  DocumentService (genérico)                           │
│    ├── TemplateEngine → DocumentDefinition            │
│    ├── Renderer (abstracto)                           │
│    ├── QRService                                      │
│    ├── HashService                                    │
│    └── StorageProvider (interface)                    │
├──────────────────────────────────────────────────────┤
│                    Repository/Models                    │
│  SQLAlchemy models + queries                          │
├──────────────────────────────────────────────────────┤
│                   Storage Backend                      │
│  LocalStorageProvider | S3 | R2 | Azure               │
└──────────────────────────────────────────────────────┘
```

---

## 9. EventBus (Diferido — Sprint 7+)

No se implementa hasta que existan procesos reales que generen eventos.

**Taxonomía de eventos (futura referencia):**

```
constancia.emitida
constancia.cancelada
constancia.reemitida
constancia.descargada
verificacion.realizada
template.creada
template.activada
organizacion.suscripcion.cambiada
```

**Refinamientos acordados:**
- `PlatformEvent` tipado con `event_type`, `version`, `correlation_id`,
  `severidad`, `organizacion_id`, `payload`, `metadata`.
- El payload del evento es ligero (IDs + contexto mínimo).
- Los datos completos se obtienen por consulta al momento de consumir.

---

## 10. Roadmap (Sprints)

| Sprint | Entregable |
|--------|------------|
| 0 | ✅ **Este documento.** Contratos congelados. |
| 1 | Módulo Templates — CRUD, versionado inmutable, recursos (logo, firmas, fondo, sello), config visual. |
| 1.5 | Editor de Templates — subir recursos, preview en vivo, activar versión. |
| 2A | Motor de documentos — TemplateEngine, Renderer (abstracto), QRService, HashService, StorageProvider. |
| 2B | Motor de plantillas — Template → DocumentDefinition → PDF. |
| 3 | Módulo Constancias — emitir(), descargar, cancelar, reemitir. |
| 4 | Página pública de verificación `/v/{codigo}`. |
| 5 | Reportes — exportación Excel/PDF. |
| 6 | Centro de Operaciones con datos reales. |
| 7 | EventBus + consumidores. |
| 8 | Analytics avanzado. |
| 9 | Marketplace + Índice de Confianza. |

---

## 11. Cadena de Valor

```
Organización
  → Templates (identidad documental versionada)
  → Cursos (evento formativo)
  → Participantes (personas)
  → Constancias (activo documental verificable)
  → Verificación QR (confianza pública)
  → Reportes (inteligencia de negocio)
  → Confianza (reputación)
  → Marketplace (red de agencias)
```

Cada eslabón es independiente y entrega valor sin depender del siguiente.

---

## 12. Decisiones Arquitectónicas (Registro Histórico)

### D001 — Multi-tenant estricto
`organizacion_id` se obtiene exclusivamente del JWT. El frontend nunca envía
IDs de organización. Sin excepciones.

### D002 — Template como nombre del modelo (no PlantillaConstancia)
El modelo se llama `Template` con `tipo_documento: enum`. No `Plantilla`,
no `PlantillaConstancia`. Esto permite que el motor de documentos opere sobre
cualquier tipo (Constancia, DC-3, Diploma, Credencial, OTRO) sin duplicar
tablas ni lógica.

### D003 — Versión inmutable con template_group_id
Cada cambio de template crea una nueva fila (INSERT, nunca UPDATE).
`template_group_id` agrupa versiones del mismo template lógico.
`version` es autoincrement por `(organizacion_id, template_group_id)`.
La constancia guarda `template_id` que apunta a una versión exacta e
inmutable.

### D004 — Separación recursos / configuración
`Template.recursos` (JSONB): logo, firmas, fondo, sello (referencias a
archivos).
`Template.config` (JSONB): posición QR, tipografía, colores, márgenes,
alineación, tamaño.
Separación preparada para futuro editor visual.

### D005 — TemplateEngine → DocumentDefinition → Renderer
El motor de documentos no conoce HTML:
`TemplateEngine.render()` produce un `DocumentDefinition` (objeto intermedio).
`Renderer.render()` toma el `DocumentDefinition` + QR y produce PDF bytes.
Permite cambiar la tecnología de generación de PDF sin tocar la lógica de
plantillas.

### D006 — QR es responsabilidad de DocumentService
`DocumentService.generate()` inyecta el QR en el pipeline. El módulo
Constancias no genera QR. Esto permite que Diplomas, DC-3 y otros tipos
tengan QR sin duplicar lógica.

### D007 — StorageProvider con get_stream()
Además de `save`, `read`, `delete`, `exists`, `url`, se agrega `get_stream()`
para servir archivos sin cargarlos completos en memoria.

### D008 — storage_provider + storage_key
La constancia guarda `storage_provider` (ej. 'local', 's3', 'r2') y
`storage_key` (ruta relativa) en lugar de un `pdf_path` fijo. Permite
cambiar de proveedor de almacenamiento sin migrar datos.

### D009 — Código de validación independiente del PDF
`codigo_validacion` es UUID v4 generado al emitir. No deriva del PDF ni de
ningún otro identificador. Se puede regenerar el PDF mil veces, el código
sigue siendo el mismo.

### D010 — Pipeline emitir() simplificado
validar → obtener template → generar código → renderizar documento →
calcular hash → guardar archivo → persistir constancia → responder.
El PDF es consecuencia, no el proceso principal.

### D011 — Sprint 1.5: Editor de Templates
No solo CRUD. Incluye: subir logo/fondo/firmas, preview en vivo,
activar versión. Es lo que el usuario realmente va a usar.
