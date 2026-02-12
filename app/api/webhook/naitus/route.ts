import { NextResponse } from "next/server"

/**
 * POST /api/webhook/naitus
 * Proxies a bulk user list to the n8n webhook and returns the response.
 */
const N8N_WEBHOOK_URL = "https://naitus.app.n8n.cloud/webhook/naitus"

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    let n8nResponse: Response
    try {
      n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (fetchError) {
      console.error("[naitus-webhook] Network error:", fetchError)
      return NextResponse.json({
        success: false,
        message: "No se pudo conectar con n8n. Verifique que el webhook esté activo.",
      }, { status: 502 })
    }

    // Read the response body
    let responseData = null
    const contentType = n8nResponse.headers.get("content-type") || ""
    try {
      if (contentType.includes("application/json")) {
        responseData = await n8nResponse.json()
      } else {
        const text = await n8nResponse.text()
        try {
          responseData = JSON.parse(text)
        } catch {
          responseData = { raw: text }
        }
      }
    } catch {
      responseData = { status: "received" }
    }

    if (!n8nResponse.ok) {
      return NextResponse.json({
        success: false,
        message: `n8n respondió con error ${n8nResponse.status}.`,
        data: responseData,
      }, { status: n8nResponse.status })
    }

    return NextResponse.json({
      success: true,
      message: "Datos enviados a n8n correctamente.",
      data: responseData,
    })
  } catch (error) {
    console.error("[naitus-webhook] Error:", error)
    return NextResponse.json({
      success: false,
      message: "Error interno al procesar la solicitud.",
    }, { status: 500 })
  }
}
