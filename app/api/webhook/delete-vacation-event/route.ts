import { NextResponse } from "next/server"
import type { N8nDeleteCalendarPayload } from "@/lib/n8n-webhook"

/**
 * POST /api/webhook/delete-vacation-event
 * Proxy server-side que reenvía la solicitud de eliminación de evento de calendario a n8n.
 * Se llama cuando el admin elimina una solicitud de vacaciones aprobada.
 */
export async function POST(request: Request) {
  try {
    const webhookUrl = "https://naitus.app.n8n.cloud/webhook/eliminar-vacacion"

    const payload: N8nDeleteCalendarPayload = await request.json()

    if (!payload.employeeName || !payload.startDate || !payload.endDate) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: employeeName, startDate, endDate" },
        { status: 400 },
      )
    }

    let n8nResponse: Response
    try {
      n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (fetchError) {
      console.error("[delete-vacation-event] Error de red al conectar con n8n:", fetchError)
      return NextResponse.json({
        success: false,
        webhookDelivered: false,
        message: "No se pudo conectar con n8n para eliminar el evento del calendario.",
      })
    }

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text().catch(() => "Sin respuesta")
      console.error(`[delete-vacation-event] n8n respondió con ${n8nResponse.status}: ${errorText}`)
      return NextResponse.json({
        success: false,
        webhookDelivered: false,
        message: `n8n respondió con error ${n8nResponse.status}.`,
      })
    }

    let n8nData = null
    try {
      n8nData = await n8nResponse.json()
    } catch {
      n8nData = { status: "received" }
    }

    return NextResponse.json({
      success: true,
      webhookDelivered: true,
      message: "Solicitud de eliminación enviada a n8n correctamente",
      n8nResponse: n8nData,
    })
  } catch (error) {
    console.error("[delete-vacation-event] Error interno:", error)
    return NextResponse.json({
      success: false,
      webhookDelivered: false,
      message: "Error interno al procesar la solicitud de eliminación.",
    })
  }
}
