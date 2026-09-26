"use client"

import Link from "next/link"
import { Correo, Dato, DocumentoLegal, type Seccion } from "@/components/legal/documento-legal"

const secciones: Seccion[] = [
  {
    id: "aceptacion",
    titulo: "Aceptación",
    contenido: (
      <p>
        Estos términos regulan el uso de AACES, plataforma operada por <Dato campo="nombre" />. Al crear una cuenta o usar la
        plataforma aceptas estos términos y nuestro <Link href="/privacidad" className="font-medium text-orange-600 hover:underline">Aviso de privacidad</Link>.
        Si usas AACES en nombre de una organización, declaras que tienes facultades para obligarla.
      </p>
    ),
  },
  {
    id: "servicio",
    titulo: "El servicio",
    contenido: (
      <>
        <p>
          AACES es un software para agencias capacitadoras: administra cursos, grupos, participantes e instructores; genera
          constancias DC-3 con folio y código QR; y permite a cualquier persona verificarlas en línea.
        </p>
        <p>
          AACES es una herramienta. <strong>No es la Secretaría del Trabajo y Previsión Social ni actúa en su nombre</strong>, y
          no sustituye las obligaciones que la ley impone a la agencia o a las empresas en materia de capacitación.
        </p>
      </>
    ),
  },
  {
    id: "cuenta",
    titulo: "Tu cuenta",
    contenido: (
      <ul>
        <li>La información de registro debe ser verdadera y estar actualizada, en especial la razón social y el RFC.</li>
        <li>Eres responsable de mantener segura tu contraseña y de lo que se haga con tu cuenta.</li>
        <li>Avísanos de inmediato a <Correo /> si detectas un uso no autorizado.</li>
      </ul>
    ),
  },
  {
    id: "veracidad",
    titulo: "Veracidad de las constancias",
    contenido: (
      <>
        <p>La agencia es la única responsable de la información que captura y de las constancias que emite. En particular, se obliga a:</p>
        <ul>
          <li>Emitir constancias solo a quienes efectivamente tomaron y acreditaron el curso.</li>
          <li>Declarar con verdad su registro como agente capacitador, los cursos que tiene registrados ante la STPS y su plantilla de instructores.</li>
          <li>Indicar como instructor a la persona que realmente impartió el curso.</li>
        </ul>
        <p>
          AACES verifica el registro del agente consultando fuentes públicas de la STPS y muestra en la página de verificación qué
          datos fueron verificados y cuáles fueron <strong>declarados por la agencia</strong>. Cuando detecta incongruencias avisa
          antes de emitir y guarda registro de quién decidió continuar. Estas funciones ayudan, pero no garantizan la veracidad de
          lo que declara la agencia.
        </p>
        <p>
          Está prohibido usar AACES para emitir constancias falsas, suplantar a otro agente capacitador o engañar a terceros. En esos
          casos podremos suspender la cuenta de inmediato, marcar como canceladas las constancias involucradas y dar aviso a las autoridades.
        </p>
      </>
    ),
  },
  {
    id: "planes",
    titulo: "Planes, pagos y límites",
    contenido: (
      <>
        <ul>
          <li>Los precios se muestran en pesos mexicanos con IVA incluido y pueden cambiar; los cambios no afectan el periodo que ya pagaste.</li>
          <li>Los pagos se procesan con Mercado Pago. El plan mensual se cobra automáticamente cada mes hasta que lo canceles; el plan anual se paga por adelantado.</li>
          <li>Cada plan incluye un número de constancias por periodo. Una constancia cuenta la primera vez que un participante recibe folio y código QR; reimprimirla, regenerarla o reemitirla no cuenta, y cancelarla no la devuelve al periodo.</li>
          <li>Las constancias no usadas en un periodo no se acumulan. Los paquetes extra no caducan y se usan cuando se agota el periodo.</li>
          <li>La prueba gratuita dura el tiempo y el número de constancias indicados al registrarte.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cancelacion",
    titulo: "Cancelación y falta de pago",
    contenido: (
      <>
        <p>Puedes cancelar cuando quieras desde tu panel. No hacemos reembolsos proporcionales, pero conservas tu plan hasta el final del periodo que ya pagaste.</p>
        <p>
          Si la suscripción deja de estar vigente, la cuenta pasa a <strong>modo solo lectura</strong>: puedes consultar tu
          información y reimprimir las constancias ya emitidas, pero no crear ni editar, ni emitir constancias nuevas. Tus cursos
          dejan de aparecer en el Marketplace.
        </p>
        <p>
          <strong>Las constancias ya emitidas se mantienen verificables hasta que termine su vigencia</strong>, aunque dejes de pagar,
          porque son un servicio que ya pagaste y del que dependen los trabajadores y sus empresas.
        </p>
      </>
    ),
  },
  {
    id: "datos",
    titulo: "Datos de trabajadores e instructores",
    contenido: (
      <>
        <p>
          Respecto de los datos de trabajadores e instructores que registras, <strong>tu agencia es la responsable</strong> y AACES
          actúa como encargado: los trata solo por tu cuenta y para prestarte el servicio, con medidas de seguridad, y no los usa
          para fines propios.
        </p>
        <p>Te corresponde:</p>
        <ul>
          <li>Contar con tu propio aviso de privacidad e informar a los trabajadores e instructores cómo tratas sus datos.</li>
          <li>Obtener, cuando se requiera, su consentimiento, incluido el de que sus datos se muestren al verificar la constancia.</li>
          <li>Atender las solicitudes de derechos que te hagan; nosotros te canalizaremos las que nos lleguen.</li>
        </ul>
      </>
    ),
  },
  {
    id: "marketplace",
    titulo: "Marketplace",
    contenido: (
      <p>
        Solo aparecen los cursos que la agencia decide publicar, siempre que tenga una suscripción de pago vigente y su registro
        ante la STPS esté verificado. La agencia es responsable del contenido, los precios y la prestación de los cursos que
        publica; AACES no es parte de la contratación entre la agencia y la empresa.
      </p>
    ),
  },
  {
    id: "disponibilidad",
    titulo: "Disponibilidad y responsabilidad",
    contenido: (
      <>
        <p>
          Trabajamos para que AACES esté disponible y funcione correctamente, pero puede haber interrupciones por mantenimiento o
          causas fuera de nuestro control, como fallas de proveedores o de las páginas de la STPS.
        </p>
        <p>
          En la medida que la ley lo permita, AACES no responde por daños indirectos ni por el contenido que capturan las agencias,
          y nuestra responsabilidad total se limita a lo que hayas pagado en los últimos doce meses.
        </p>
      </>
    ),
  },
  {
    id: "cambios",
    titulo: "Cambios y ley aplicable",
    contenido: (
      <>
        <p>Podemos modificar estos términos. Publicaremos la versión vigente en esta página y, si el cambio es importante, te avisaremos con anticipación.</p>
        <p>Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para dudas escríbenos a <Correo />.</p>
      </>
    ),
  },
]

export default function TerminosPage() {
  return (
    <DocumentoLegal
      eyebrow="Legal"
      titulo="Términos y condiciones"
      resumen="Las reglas para usar AACES: tu cuenta, la veracidad de las constancias, los planes y pagos, y qué pasa si dejas de pagar."
      secciones={secciones}
      relacionado={{ href: "/privacidad", texto: "Aviso de privacidad" }}
    />
  )
}
