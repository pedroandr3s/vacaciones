import { NextResponse } from "next/server"
import type { N8nVacationPayload } from "@/lib/n8n-webhook"

/**
 * POST /api/webhook/vacaciones
 * Server-side proxy that forwards vacation data to the n8n webhook.
 */
export async function POST(request: Request) {
  try {
    const webhookUrl = "https://naitus.app.n8n.cloud/webhook/vacaciones-equipo"

    const payload: N8nVacationPayload = await request.json()

    // Validate required fields
    if (!payload.employeeId || !payload.startDate || !payload.endDate) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: employeeId, startDate, endDate" },
        { status: 400 },
      )
    }

    // Forward the payload to n8n
    let n8nResponse: Response
    try {
      n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    } catch (fetchError) {
      // Network-level error (DNS, timeout, unreachable)
      console.error("[webhook] Network error connecting to n8n:", fetchError)
      return NextResponse.json({
        success: false,
        webhookDelivered: false,
        message: "No se pudo conectar con n8n. Verifique que la URL del webhook sea correcta y que n8n este accesible.",
        hint: "El registro de vacaciones se completo localmente.",
      })
    }

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text().catch(() => "Sin respuesta")
      console.error(`[webhook] n8n responded with ${n8nResponse.status}: ${errorText}`)

      // Parse n8n-specific error hints
      let hint = "El registro de vacaciones se completo localmente."
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.hint) {
          hint = `${errorJson.hint} ${hint}`
        }
      } catch {
        // Not JSON, use default hint
      }

      return NextResponse.json({
        success: false,
        webhookDelivered: false,
        message: n8nResponse.status === 404
          ? "El webhook de n8n no esta registrado o no esta escuchando. En modo test, haga clic en 'Execute workflow' en n8n antes de intentar."
          : `n8n respondio con error ${n8nResponse.status}.`,
        hint,
      })
    }

    // Try to parse n8n response (may not always be JSON)
    let n8nData = null
    try {
      n8nData = await n8nResponse.json()
    } catch {
      // n8n might respond with empty body or non-JSON
      n8nData = { status: "received" }
    }

    return NextResponse.json({
      success: true,
      webhookDelivered: true,
      message: "Datos enviados a n8n correctamente",
      n8nResponse: n8nData,
    })
  } catch (error) {
    console.error("[webhook] Error processing request:", error)
    return NextResponse.json({
      success: false,
      webhookDelivered: false,
      message: "Error interno al procesar la solicitud.",
      hint: "El registro de vacaciones se completo localmente.",
    })
  }
}
