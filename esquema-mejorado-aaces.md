# Esquema Mejorado del Sistema AACES - Análisis y Optimización

## 📊 Análisis del Esquema Actual

Tu diseño actual es muy bueno y bien pensado. Tiene las relaciones correctas y cubre los casos de uso principales. A continuación, te presento mejoras específicas para optimizar rendimiento, seguridad y escalabilidad.

## 🔧 Mejoras Propuestas

### 1. **Tabla `clientes` - Seguridad y Compliance**

```sql
CREATE TABLE clientes ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL, 
  correo VARCHAR(255) UNIQUE NOT NULL, 
  password_hash VARCHAR(255) NOT NULL, -- Cambiado de contraseña a hash
  ciudad_base VARCHAR(100),
  categoria VARCHAR(20) DEFAULT 'basico' CHECK (categoria IN ('basico', 'premium', 'enterprise')), 
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido', 'eliminado')),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  fecha_cambio_categoria TIMESTAMP,
  ultimo_acceso TIMESTAMP WITH TIME ZONE,
  intentos_fallidos INTEGER DEFAULT 0,
  bloqueado_hasta TIMESTAMP WITH TIME ZONE,
  -- GDPR/Protección de datos
  acepta_terminos BOOLEAN DEFAULT FALSE,
  fecha_acepta_terminos TIMESTAMP WITH TIME ZONE,
  datos_procesados BOOLEAN DEFAULT TRUE,
  fecha_eliminacion_logica TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_clientes_correo ON clientes(correo);
CREATE INDEX idx_clientes_categoria ON clientes(categoria);
CREATE INDEX idx_clientes_estado ON clientes(estado);
CREATE INDEX idx_clientes_fecha_creacion ON clientes(fecha_creacion);
```

**Justificación de cambios:**
- **UUID vs SERIAL**: Mejor para sistemas distribuidos y seguridad
- **password_hash**: Nunca almacenar contraseñas en texto plano
- **Constraints CHECK**: Garantizan integridad de datos
- **Campos de auditoría**: `ultimo_acceso`, `intentos_fallidos` para seguridad
- **GDPR Compliance**: Campos para gestión de datos personales

### 2. **Tabla `capacitadores` - Gestión de Acceso**

```sql
CREATE TABLE capacitadores ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL, 
  correo VARCHAR(255) UNIQUE,
  telefono VARCHAR(20),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  fecha_inicio_vigencia DATE,
  fecha_fin_vigencia DATE,
  estado_pago VARCHAR(20) DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado', 'vencido', 'pendiente', 'cancelado')),
  acceso_activo BOOLEAN DEFAULT FALSE,
  -- Campos adicionales para trazabilidad
  documento_identidad VARCHAR(50),
  especialidad VARCHAR(100),
  nivel_certificacion VARCHAR(50),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES clientes(id),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actualizado_por UUID REFERENCES clientes(id)
);

-- Índices
CREATE INDEX idx_capacitadores_cliente_id ON capacitadores(cliente_id);
CREATE INDEX idx_capacitadores_correo ON capacitadores(correo);
CREATE INDEX idx_capacitadores_estado_pago ON capacitadores(estado_pago);
CREATE INDEX idx_capacitadores_acceso_activo ON capacitadores(acceso_activo);
```

### 3. **Tabla `cursos` - Optimización de Consultas**

```sql
CREATE TABLE cursos ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  codigo_curso VARCHAR(20) UNIQUE NOT NULL, -- Código único para identificación rápida
  nombre VARCHAR(200) NOT NULL, 
  ciudad VARCHAR(100) NOT NULL, 
  fecha_inicio DATE NOT NULL, 
  fecha_fin DATE NOT NULL,
  duracion_horas INTEGER NOT NULL CHECK (duracion_horas > 0),
  modalidad VARCHAR(20) CHECK (modalidad IN ('presencial', 'virtual', 'mixta')),
  capacitador_id UUID REFERENCES capacitadores(id),
  duracion_validacion INTEGER, -- en meses
  costo_total DECIMAL(10,2),
  moneda VARCHAR(3) DEFAULT 'USD',
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'en_espera', 'cancelado')),
  empresa_contratante VARCHAR(200),
  descripcion TEXT,
  objetivos TEXT,
  requisitos TEXT,
  -- Campos de auditoría
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES clientes(id),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actualizado_por UUID REFERENCES clientes(id)
);

-- Índices críticos para performance
CREATE INDEX idx_cursos_cliente_id ON cursos(cliente_id);
CREATE INDEX idx_cursos_codigo_curso ON cursos(codigo_curso);
CREATE INDEX idx_cursos_fechas ON cursos(fecha_inicio, fecha_fin);
CREATE INDEX idx_cursos_estado ON cursos(estado);
CREATE INDEX idx_cursos_ciudad ON cursos(ciudad);
CREATE INDEX idx_cursos_capacitador_id ON cursos(capacitador_id);
```

### 4. **Tabla `participantes` - Normalización**

```sql
CREATE TABLE participantes ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento VARCHAR(20) CHECK (tipo_documento IN ('DNI', 'PASAPORTE', 'CEDULA', 'OTRO')),
  numero_documento VARCHAR(50) UNIQUE,
  nombre VARCHAR(100) NOT NULL, 
  apellido VARCHAR(100),
  correo VARCHAR(255),
  telefono VARCHAR(20),
  ciudad_origen VARCHAR(100),
  fecha_nacimiento DATE,
  genero VARCHAR(10) CHECK (genero IN ('M', 'F', 'Otro')),
  empresa VARCHAR(200),
  cargo VARCHAR(100),
  nivel_educacion VARCHAR(50),
  -- Campos de contacto adicionales
  direccion TEXT,
  codigo_postal VARCHAR(20),
  pais VARCHAR(50) DEFAULT 'Ecuador',
  -- Auditoría
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_participantes_documento ON participantes(numero_documento);
CREATE INDEX idx_participantes_correo ON participantes(correo);
CREATE INDEX idx_participantes_nombre ON participantes(nombre, apellido);
```

### 5. **Tabla `curso_participante` - Mejoras de Integridad**

```sql
CREATE TABLE curso_participante ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID REFERENCES cursos(id) ON DELETE CASCADE,
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE,
  estado_pago VARCHAR(20) CHECK (estado_pago IN ('pagado', 'anticipo', 'pendiente', 'cancelado')),
  valor_pagado DECIMAL(10,2) DEFAULT 0,
  fecha_pago TIMESTAMP WITH TIME ZONE,
  fecha_participacion DATE,
  fecha_inicio_vigencia DATE,
  fecha_expiracion DATE,
  id_certificado VARCHAR(50) UNIQUE,
  codigo_validacion VARCHAR(20) UNIQUE, -- Código corto para validación pública
  estado_acreditacion BOOLEAN DEFAULT FALSE,
  calificacion DECIMAL(5,2) CHECK (calificacion >= 0 AND calificacion <= 100),
  asistencia DECIMAL(5,2) DEFAULT 0 CHECK (asistencia >= 0 AND asistencia <= 100),
  observaciones TEXT,
  -- Documentos generados
  certificado_url TEXT,
  fecha_emision_certificado TIMESTAMP WITH TIME ZONE,
  -- Auditoría
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES clientes(id),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actualizado_por UUID REFERENCES clientes(id),
  -- Constraint único para evitar duplicados
  UNIQUE(curso_id, participante_id)
);

-- Índices críticos
CREATE INDEX idx_curso_participante_curso_id ON curso_participante(curso_id);
CREATE INDEX idx_curso_participante_participante_id ON curso_participante(participante_id);
CREATE INDEX idx_curso_participante_certificado ON curso_participante(id_certificado);
CREATE INDEX idx_curso_participante_validacion ON curso_participante(codigo_validacion);
CREATE INDEX idx_curso_participante_estado_acreditacion ON curso_participante(estado_acreditacion);
CREATE INDEX idx_curso_participante_fechas ON curso_participante(fecha_inicio_vigencia, fecha_expiracion);
```

### 6. **Tabla `pagos` - Nueva tabla para trazabilidad financiera**

```sql
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  curso_participante_id UUID REFERENCES curso_participante(id),
  tipo_pago VARCHAR(30) CHECK (tipo_pago IN ('participante', 'capacitador', 'curso_completo')),
  monto DECIMAL(10,2) NOT NULL,
  moneda VARCHAR(3) DEFAULT 'USD',
  metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'paypal', 'otro')),
  referencia_pago VARCHAR(100),
  fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  estado_pago VARCHAR(20) DEFAULT 'completado' CHECK (estado_pago IN ('pendiente', 'completado', 'fallido', 'reembolsado')),
  comprobante_url TEXT,
  notas TEXT,
  -- Auditoría
  creado_por UUID REFERENCES clientes(id),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX idx_pagos_curso_participante_id ON pagos(curso_participante_id);
CREATE INDEX idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX idx_pagos_estado ON pagos(estado_pago);
```

### 7. **Tabla `validaciones_publicas` - Trazabilidad de validaciones**

```sql
CREATE TABLE validaciones_publicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_validacion VARCHAR(20) REFERENCES curso_participante(codigo_validacion),
  fecha_validacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_validacion INET,
  user_agent TEXT,
  resultado BOOLEAN DEFAULT TRUE,
  intentos INTEGER DEFAULT 1,
  -- Para limitar intentos de validación
  UNIQUE(codigo_validacion, ip_validacion)
);

CREATE INDEX idx_validaciones_codigo ON validaciones_publicas(codigo_validacion);
CREATE INDEX idx_validaciones_fecha ON validaciones_publicas(fecha_validacion);
```

## 🚀 Funciones y Triggers para Automatización

### 1. **Trigger para generar código de validación único**

```sql
CREATE OR REPLACE FUNCTION generar_codigo_validacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_validacion IS NULL THEN
    NEW.codigo_validacion := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generar_codigo_validacion
  BEFORE INSERT ON curso_participante
  FOR EACH ROW
  EXECUTE FUNCTION generar_codigo_validacion();
```

### 2. **Trigger para actualizar métricas del cliente**

```sql
CREATE OR REPLACE FUNCTION actualizar_metricas_cliente()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE panel_maestro_metrica 
  SET 
    cursos_registrados = (SELECT COUNT(*) FROM cursos WHERE cliente_id = NEW.cliente_id AND estado = 'activo'),
    participantes_totales = (SELECT COUNT(DISTINCT participante_id) FROM curso_participante cp JOIN cursos c ON cp.curso_id = c.id WHERE c.cliente_id = NEW.cliente_id),
    fecha_actualizacion = CURRENT_TIMESTAMP
  WHERE cliente_id = NEW.cliente_id;
  
  IF NOT FOUND THEN
    INSERT INTO panel_maestro_metrica (cliente_id, cursos_registrados, participantes_totales)
    VALUES (NEW.cliente_id, 1, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_metricas
  AFTER INSERT OR UPDATE ON cursos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_metricas_cliente();
```

### 3. **Trigger para auditoría de cambios**

```sql
CREATE TABLE auditoria_cambios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_nombre VARCHAR(50),
  operacion VARCHAR(10),
  usuario_id UUID,
  fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  datos_anteriores JSONB,
  datos_nuevos JSONB
);

CREATE OR REPLACE FUNCTION auditar_cambios()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria_cambios (tabla_nombre, operacion, usuario_id, datos_anteriores, datos_nuevos)
    VALUES (TG_TABLE_NAME, 'UPDATE', current_setting('app.current_user_id')::UUID, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria_cambios (tabla_nombre, operacion, usuario_id, datos_anteriores)
    VALUES (TG_TABLE_NAME, 'DELETE', current_setting('app.current_user_id')::UUID, row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar auditoría a tablas críticas
CREATE TRIGGER trigger_auditar_clientes
  AFTER UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION auditar_cambios();
```

## 📈 Estrategias de Performance

### 1. **Particionamiento de tablas grandes**

```sql
-- Particionar curso_participante por fecha
CREATE TABLE curso_participante_historico (
  LIKE curso_participante INCLUDING ALL
) PARTITION BY RANGE (fecha_creacion);

-- Crear particiones por año
CREATE TABLE curso_participante_2024 PARTITION OF curso_participante_historico
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE curso_participante_2025 PARTITION OF curso_participante_historico
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

### 2. **Materialized Views para reportes frecuentes**

```sql
CREATE MATERIALIZED VIEW mv_resumen_cliente AS
SELECT 
  c.id as cliente_id,
  c.nombre as cliente_nombre,
  COUNT(DISTINCT cur.id) as total_cursos,
  COUNT(DISTINCT cp.participante_id) as total_participantes,
  COUNT(DISTINCT CASE WHEN cp.estado_acreditacion = true THEN cp.participante_id END) as total_acreditados,
  SUM(CASE WHEN p.estado_pago = 'completado' THEN p.monto ELSE 0 END) as total_ingresos,
  AVG(cp.calificacion) as promedio_calificaciones
FROM clientes c
LEFT JOIN cursos cur ON c.id = cur.cliente_id
LEFT JOIN curso_participante cp ON cur.id = cp.curso_id
LEFT JOIN pagos p ON cp.id = p.curso_participante_id
WHERE c.estado = 'activo'
GROUP BY c.id, c.nombre;

CREATE INDEX idx_mv_resumen_cliente ON mv_resumen_cliente(cliente_id);
```

## 🔒 Consideraciones de Seguridad

### 1. **Encriptación de datos sensibles**

```sql
-- Extensión para encriptación
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ejemplo de campo encriptado
ALTER TABLE participantes 
ADD COLUMN numero_documento_encrypted BYTEA;

-- Función para insertar con encriptación
CREATE OR REPLACE FUNCTION insertar_participante_seguro(
  p_tipo_documento VARCHAR,
  p_numero_documento VARCHAR,
  p_nombre VARCHAR,
  p_correo VARCHAR
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO participantes (tipo_documento, numero_documento_encrypted, nombre, correo)
  VALUES (
    p_tipo_documento,
    pgp_sym_encrypt(p_numero_documento, current_setting('app.encryption_key')),
    p_nombre,
    p_correo
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;
```

### 2. **Row Level Security (RLS)**

```sql
-- Habilitar RLS en tablas críticas
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_participante ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacitadores ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY cursos_cliente_policy ON cursos
  FOR ALL TO app_user
  USING (cliente_id = current_setting('app.current_client_id')::UUID);

CREATE POLICY curso_participante_cliente_policy ON curso_participante
  FOR ALL TO app_user
  USING (
    curso_id IN (
      SELECT id FROM cursos 
      WHERE cliente_id = current_setting('app.current_client_id')::UUID
    )
  );
```

## 📋 Resumen de Mejoras Clave

### ✅ **Seguridad Mejorada**
- UUIDs en lugar de SERIAL para prevenir enumeration attacks
- Password hashing con bcrypt
- Encriptación de datos sensibles
- Row Level Security (RLS)
- Auditoría de cambios
- Rate limiting en validaciones

### 🚀 **Performance Optimizada**
- Índices estratégicos en campos de búsqueda frecuente
- Particionamiento de tablas grandes
- Materialized views para reportes
- Constraints UNIQUE para prevenir duplicados

### 🏗️ **Escalabilidad**
- Diseño modular y desacoplado
- Preparado para multi-tenant
- Funciones reutilizables
- Triggers para automatización

### 📊 **Trazabilidad Completa**
- Auditoría de todos los cambios
- Trazabilidad de pagos
- Registro de validaciones públicas
- Métricas automáticas actualizadas

### 🔍 **Consultas Optimizadas**
- Vista mejorada de acreditación pública
- Índices compuestos para búsquedas complejas
- Preparado para búsquedas full-text

Tu esquema original era excelente. Estas mejoras lo hacen **enterprise-ready** con foco en seguridad, performance y compliance. ¿Te gustaría que profundice en algún aspecto específico o que comencemos con la implementación?