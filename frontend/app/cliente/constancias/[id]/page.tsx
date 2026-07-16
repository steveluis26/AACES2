"use client"

import { useQuery } from "react-query"
import { toast } from "sonner"
import { DocumentTab, DocumentViewModel } from "@/viewmodels/document"
import { DocumentHeader } from "@/components/documentos/DocumentHeader"
import { DocumentActions } from "@/components/documentos/DocumentActions"
import { DocumentSkeleton } from "@/components/documentos/DocumentSkeleton"
import { EmptyDocumentState } from "@/components/documentos/EmptyDocumentState"
import { PreviewPanel } from "@/components/documentos/PreviewPanel"
import { QRCodeCard } from "@/components/documentos/QRCodeCard"
import { Timeline } from "@/components/documentos/Timeline"
import { InfoGrid } from "@/components/documentos/InfoGrid"
import { HashViewer } from "@/components/documentos/HashViewer"
import { VerificationBadge } from "@/components/documentos/VerificationBadge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchConstanciaDetalle,
  cancelarConstancia,
  verificationUrl,
} from "@/adapters/constancia.adapter"

const TAB_LABELS: Record<DocumentTab, string> = {
  [DocumentTab.INFORMATION]: "Información",
  [DocumentTab.DOCUMENT]: "Documento",
  [DocumentTab.VERIFICATIONS]: "Verificaciones",
  [DocumentTab.TECHNICAL]: "Técnico",
}

export default function ConstanciaDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: doc, isLoading, error } = useQuery<DocumentViewModel>(
    ["constancia", params.id],
    () => fetchConstanciaDetalle(params.id),
    { retry: 1 }
  )

  const handleCancelar = async () => {
    try {
      await cancelarConstancia(params.id)
      toast.success("Constancia cancelada")
    } catch {
      toast.error("No se pudo cancelar la constancia")
    }
  }

  if (isLoading) return <DocumentSkeleton />
  if (error || !doc) {
    return (
      <EmptyDocumentState
        titulo="Constancia no encontrada"
        descripcion="No pudimos cargar la información de esta constancia. Verifica el ID e intenta de nuevo."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6 px-4 lg:px-6">
      <DocumentHeader
        tipo={doc.tipoDocumento}
        estado={doc.estado}
        codigoValidacion={doc.codigoValidacion}
        folio={doc.folio}
      >
        <DocumentActions
          documentoId={doc.id}
          pdfUrl={doc.activoDocumental.pdfUrl}
          codigoValidacion={doc.codigoValidacion}
          capabilities={doc.capabilities}
          onCancelar={handleCancelar}
        />
      </DocumentHeader>

      <Tabs defaultValue={DocumentTab.INFORMATION}>
        <TabsList>
          {Object.values(DocumentTab).map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {TAB_LABELS[tab]}
              {tab === DocumentTab.VERIFICATIONS &&
                doc.verificaciones.total > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({doc.verificaciones.total})
                  </span>
                )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={DocumentTab.INFORMATION} className="mt-6">
          <InfoGrid
            secciones={[
              {
                titulo: "Participante",
                campos: [
                  { label: "Nombre", value: doc.participante.nombre, span: 2 },
                  {
                    label: "Empresa",
                    value: doc.participante.empresa ?? "-",
                  },
                  { label: "Puesto", value: doc.participante.puesto ?? "-" },
                  { label: "Correo", value: doc.participante.correo ?? "-" },
                ],
              },
              {
                titulo: "Curso",
                campos: [
                  { label: "Nombre", value: doc.curso.nombre, span: 2 },
                  {
                    label: "Duración",
                    value: doc.curso.duracionHoras
                      ? `${doc.curso.duracionHoras} horas`
                      : "-",
                  },
                  {
                    label: "Modalidad",
                    value: doc.curso.modalidad ?? "-",
                  },
                  { label: "Ciudad", value: doc.curso.ciudad ?? "-" },
                ],
              },
              {
                titulo: "Organización",
                campos: [
                  {
                    label: "Razón social",
                    value: doc.organizacion.nombre,
                  },
                  {
                    label: "Nombre comercial",
                    value: doc.organizacion.nombreComercial ?? "-",
                  },
                ],
              },
            ]}
          />
        </TabsContent>

        <TabsContent value={DocumentTab.DOCUMENT} className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PreviewPanel pdfUrl={doc.activoDocumental.pdfUrl} />
            </div>
            <div className="space-y-4">
              <QRCodeCard
                codigo={doc.codigoValidacion}
                verificationUrl={verificationUrl(doc.codigoValidacion)}
              />
              <DocumentActions
                documentoId={doc.id}
                pdfUrl={doc.activoDocumental.pdfUrl}
                codigoValidacion={doc.codigoValidacion}
                capabilities={doc.capabilities}
                onCancelar={handleCancelar}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value={DocumentTab.VERIFICATIONS} className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {doc.verificaciones.total} verificación
                {doc.verificaciones.total !== 1 ? "es" : ""} en total
              </span>
              {doc.verificaciones.ultimaFecha && (
                <>
                  <span className="text-xs">·</span>
                  <span>
                    Última:{" "}
                    {new Date(
                      doc.verificaciones.ultimaFecha
                    ).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              )}
            </div>

            <Timeline eventos={doc.timeline} />

            {doc.verificaciones.ultimas.length > 0 && (
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">
                          Fecha
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">
                          Tipo
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">
                          Resultado
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">
                          IP
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.verificaciones.ultimas.map((v) => (
                        <tr key={v.id} className="border-b last:border-0">
                          <td className="px-4 py-2 text-xs">
                            {new Date(v.fecha).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2 text-xs">{v.tipo}</td>
                          <td className="px-4 py-2">
                            <VerificationBadge
                              resultado={v.resultado}
                              size="sm"
                            />
                          </td>
                          <td className="px-4 py-2 text-xs font-mono">
                            {v.ip ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value={DocumentTab.TECHNICAL} className="mt-6">
          <InfoGrid
            secciones={[
              {
                titulo: "Activo digital",
                campos: [
                  {
                    label: "Hash SHA-256",
                    value: (
                      <HashViewer
                        hash={doc.activoDocumental.hashSha256}
                      />
                    ),
                    span: 2,
                  },
                  {
                    label: "Tipo",
                    value: doc.activoDocumental.tipoDocumento,
                  },
                  {
                    label: "Template",
                    value: `${doc.template.nombre} v${doc.template.version}`,
                  },
                ],
              },
              {
                titulo: "Identificadores",
                campos: [
                  { label: "ID interno", value: doc.id },
                  {
                    label: "Código de validación",
                    value: doc.codigoValidacion,
                  },
                  { label: "Folio", value: doc.folio ?? "—" },
                ],
              },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
