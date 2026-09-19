-- V008: catálogo de cursos + paquetes por organización
--
-- Las organizaciones (capacitadores) definen una vez los cursos que imparten
-- (nombre, duración, vigencia, precio, ciudad/estado, modalidad) y los
-- reutilizan al programar cursos, sin reescribir datos en cada constancia.
-- `publicado` (default false) marca qué cursos del catálogo la org quiere
-- mostrar en el futuro directorio público (búsqueda por curso + ciudad/estado).
-- Los paquetes agrupan cursos del catálogo con precio propio definido por la org.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DO para constraints/índices.

CREATE TABLE IF NOT EXISTS aaces.catalogo_cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    duracion_horas INTEGER NOT NULL DEFAULT 8,
    vigencia_meses INTEGER NOT NULL DEFAULT 24,
    precio NUMERIC(10,2) NOT NULL DEFAULT 0,
    moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
    ciudad VARCHAR(100),
    estado VARCHAR(100),
    modalidad VARCHAR(20) NOT NULL DEFAULT 'presencial',
    publicado BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_modalidad_catalogo CHECK (modalidad IN ('presencial', 'virtual', 'mixta')),
    CONSTRAINT check_duracion_catalogo CHECK (duracion_horas > 0),
    CONSTRAINT check_vigencia_catalogo CHECK (vigencia_meses > 0),
    CONSTRAINT check_precio_catalogo CHECK (precio >= 0)
);

CREATE TABLE IF NOT EXISTS aaces.paquetes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10,2) NOT NULL DEFAULT 0,
    moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
    publicado BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_precio_paquete CHECK (precio >= 0)
);

CREATE TABLE IF NOT EXISTS aaces.paquete_cursos (
    paquete_id UUID NOT NULL REFERENCES aaces.paquetes(id) ON DELETE CASCADE,
    catalogo_curso_id UUID NOT NULL REFERENCES aaces.catalogo_cursos(id) ON DELETE CASCADE,
    PRIMARY KEY (paquete_id, catalogo_curso_id)
);

-- Vínculo opcional: un curso programado puede nacer de una entrada del catálogo.
-- El prellenado es una copia editable; el catálogo no se modifica.
DO $$
BEGIN
    -- La columna debe existir antes del FK (tablas legacy no la tienen).
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'aaces' AND table_name = 'cursos'
          AND column_name = 'catalogo_curso_id'
    ) THEN
        ALTER TABLE aaces.cursos ADD COLUMN catalogo_curso_id UUID;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cursos_catalogo_curso'
    ) THEN
        ALTER TABLE aaces.cursos
            ADD CONSTRAINT fk_cursos_catalogo_curso
            FOREIGN KEY (catalogo_curso_id) REFERENCES aaces.catalogo_cursos(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_catalogo_org ON aaces.catalogo_cursos(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_publicado ON aaces.catalogo_cursos(publicado) WHERE publicado = true;
CREATE INDEX IF NOT EXISTS idx_catalogo_ciudad ON aaces.catalogo_cursos(ciudad);
CREATE INDEX IF NOT EXISTS idx_catalogo_estado ON aaces.catalogo_cursos(estado);
CREATE INDEX IF NOT EXISTS idx_paquetes_org ON aaces.paquetes(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_publicado ON aaces.paquetes(publicado) WHERE publicado = true;
