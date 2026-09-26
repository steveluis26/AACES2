"use client"

import Link from "next/link"
import { Correo, Dato, DocumentoLegal, type Seccion } from "@/components/legal/documento-legal"

const secciones: Seccion[] = [
  {
    id: "responsable",
    titulo: "Quién es el responsable",
    contenido: (
      <>
        <p>
          <Dato campo="nombre" />, con domicilio en <Dato campo="domicilio" />, es responsable del tratamiento de los datos
          personales que se recaban a través de la plataforma AACES (el sitio web, el panel de las agencias y las páginas de
          verificación de constancias), conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
        </p>
        <p>Para cualquier tema relacionado con tus datos personales puedes escribirnos a <Correo />.</p>
      </>
    ),
  },
  {
    id: "datos",
    titulo: "Qué datos personales tratamos",
    contenido: (
      <>
        <p><strong>De las agencias capacitadoras y sus usuarios:</strong> nombre, correo electrónico, teléfono, contraseña (guardada cifrada, nunca en texto legible), razón social o nombre comercial, RFC, estado y ciudad, número de registro ante la STPS y el historial de tu suscripción. Los datos de tu tarjeta los captura directamente Mercado Pago; AACES no los recibe ni los guarda.</p>
        <p><strong>De quienes nos contactan o se registran en la lista de espera:</strong> nombre, correo, teléfono, empresa y el mensaje que nos envían.</p>
        <p><strong>De quienes verifican una constancia:</strong> la dirección IP, el navegador y la fecha y hora de la consulta.</p>
        <p><strong>De los trabajadores e instructores que las agencias registran:</strong> nombre, CURP, correo, teléfono, empresa, puesto, ocupación, ciudad, cursos tomados o impartidos, calificación y las constancias emitidas. Sobre estos datos, ver la sección “Datos de trabajadores e instructores”.</p>
        <p>AACES <strong>no recaba datos personales sensibles</strong> (como origen étnico, estado de salud, creencias o preferencias).</p>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "Para qué los usamos",
    contenido: (
      <>
        <p><strong>Finalidades necesarias para prestar el servicio:</strong></p>
        <ul>
          <li>Crear y administrar tu cuenta y la de tu organización.</li>
          <li>Registrar cursos, grupos y participantes, y generar constancias DC-3 con su folio y código QR.</li>
          <li>Permitir que cualquier persona que tenga el código de una constancia verifique su autenticidad.</li>
          <li>Verificar tu registro como agente capacitador consultando, con tu RFC, el buscador público de agentes capacitadores de la STPS.</li>
          <li>Cobrar tu suscripción y los paquetes que compres, y administrar el límite de constancias de tu plan.</li>
          <li>Enviarte avisos del servicio: vencimientos, límite de constancias, pagos y cambios en tu cuenta.</li>
          <li>Proteger la plataforma: prevenir fraudes, suplantaciones y abusos, y conservar el registro de quién realizó cada acción.</li>
          <li>Atender tus mensajes y solicitudes, y cumplir las obligaciones legales que nos apliquen.</li>
        </ul>
        <p><strong>Finalidades adicionales</strong> (no son necesarias para el servicio):</p>
        <ul>
          <li>Enviarte novedades, promociones y encuestas de satisfacción.</li>
          <li>Elaborar estadísticas agregadas para mejorar AACES, sin identificar a nadie.</li>
        </ul>
        <p>Si no quieres que usemos tus datos para las finalidades adicionales, escríbenos a <Correo /> o, cuando te enviemos novedades, usa la liga que incluirán para dejar de recibirlas. Negarte no afecta el servicio.</p>
      </>
    ),
  },
  {
    id: "compartir",
    titulo: "Con quién los compartimos",
    contenido: (
      <>
        <p>No vendemos ni rentamos datos personales. Para operar, nos apoyamos en proveedores que tratan datos por nuestra cuenta y bajo nuestras instrucciones:</p>
        <ul>
          <li><strong>Alojamiento y base de datos</strong> (Render y Vercel), cuyos servidores pueden estar fuera de México.</li>
          <li><strong>Pagos</strong> (Mercado Pago), que procesa tu pago y los datos de tu tarjeta.</li>
          <li><strong>Envío de correos</strong> del servicio.</li>
        </ul>
        <p>Además, algunos datos quedan visibles por la naturaleza del servicio:</p>
        <ul>
          <li><strong>Verificación de constancias:</strong> quien tenga el código o escanee el QR de una constancia puede ver el nombre del trabajador, el curso, sus fechas y vigencia, el agente capacitador y el instructor. Es el propósito de una constancia verificable.</li>
          <li><strong>Marketplace:</strong> el perfil público de la agencia y los cursos que ella decida publicar.</li>
          <li><strong>Consulta a la STPS:</strong> para verificar tu registro enviamos tu RFC al buscador público de la STPS.</li>
        </ul>
        <p>Solo entregaremos datos a autoridades cuando una ley o una orden fundada y motivada lo exija.</p>
      </>
    ),
  },
  {
    id: "arco",
    titulo: "Tus derechos ARCO",
    contenido: (
      <>
        <p>Tienes derecho a <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong> si son inexactos, <strong>Cancelarlos</strong> cuando consideres que no se requieren para las finalidades descritas y <strong>Oponerte</strong> a su uso para fines específicos. También puedes <strong>revocar el consentimiento</strong> que nos hayas dado.</p>
        <p>Para ejercerlos, envía un correo a <Correo /> con:</p>
        <ul>
          <li>Tu nombre y un medio para responderte.</li>
          <li>Una copia de tu identificación oficial (o la de tu representante y el documento que acredite la representación).</li>
          <li>La descripción clara del derecho que quieres ejercer y de los datos involucrados.</li>
          <li>Cualquier documento que ayude a localizar tus datos.</li>
        </ul>
        <p>Te responderemos en un plazo máximo de 20 días hábiles y, si procede, haremos efectiva tu solicitud dentro de los 15 días hábiles siguientes.</p>
        <p>Toma en cuenta que algunos datos debemos conservarlos para cumplir obligaciones legales o para que las constancias ya emitidas sigan siendo verificables durante su vigencia.</p>
      </>
    ),
  },
  {
    id: "trabajadores",
    titulo: "Datos de trabajadores e instructores",
    contenido: (
      <>
        <p>
          Los datos de los trabajadores capacitados y de los instructores los registra cada agencia capacitadora, que es la
          <strong> responsable</strong> de ellos. AACES los trata <strong>por cuenta de la agencia</strong> y solo para prestarle
          el servicio (generar sus constancias y permitir su verificación). No los usamos para fines propios ni los compartimos
          con otras agencias.
        </p>
        <p>
          Cada agencia debe informar a sus trabajadores e instructores cómo usa sus datos mediante su propio aviso de privacidad.
          Si eres trabajador y quieres ejercer tus derechos, dirígete a la agencia que te capacitó; si nos escribes, canalizaremos
          tu solicitud a ella.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies y almacenamiento en tu navegador",
    contenido: (
      <p>
        Usamos únicamente cookies y almacenamiento local <strong>técnicos</strong>: mantener tu sesión iniciada y recordar
        preferencias como la vista de la agenda. No usamos cookies publicitarias ni herramientas de rastreo de terceros. Puedes
        borrarlas desde tu navegador; si lo haces tendrás que volver a iniciar sesión.
      </p>
    ),
  },
  {
    id: "seguridad",
    titulo: "Cómo los protegemos y cuánto tiempo los conservamos",
    contenido: (
      <>
        <p>
          Aplicamos medidas de seguridad administrativas, técnicas y físicas: conexiones cifradas, contraseñas guardadas cifradas,
          acceso de cada agencia únicamente a su propia información y registro de las acciones relevantes.
        </p>
        <p>
          Conservamos los datos mientras tengas una cuenta y el tiempo necesario para cumplir obligaciones legales. Las constancias
          emitidas se conservan para que puedan verificarse durante su vigencia, aunque la agencia deje de usar AACES.
        </p>
      </>
    ),
  },
  {
    id: "cambios",
    titulo: "Cambios a este aviso",
    contenido: (
      <p>
        Podemos actualizar este aviso por cambios en la ley, en nuestros servicios o en nuestras prácticas. Publicaremos la versión
        vigente en esta página con su fecha de actualización y, si el cambio es importante, te avisaremos por correo o dentro de la plataforma.
      </p>
    ),
  },
  {
    id: "autoridad",
    titulo: "Si consideras que no respetamos tus derechos",
    contenido: (
      <p>
        Escríbenos primero a <Correo /> para resolverlo. Si no quedas conforme, puedes acudir a la autoridad competente en materia
        de protección de datos personales en posesión de los particulares. Consulta también nuestros{" "}
        <Link href="/terminos" className="font-medium text-orange-600 hover:underline">Términos y condiciones</Link>.
      </p>
    ),
  },
]

export default function PrivacidadPage() {
  return (
    <DocumentoLegal
      eyebrow="Legal"
      titulo="Aviso de privacidad"
      resumen="Qué datos personales tratamos en AACES, para qué los usamos, con quién los compartimos y cómo puedes ejercer tus derechos."
      secciones={secciones}
      relacionado={{ href: "/terminos", texto: "Términos y condiciones" }}
    />
  )
}
