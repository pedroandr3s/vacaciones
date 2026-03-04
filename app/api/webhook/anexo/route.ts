import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const webhookUrl = "https://naitus.app.n8n.cloud/webhook/anexo"

    const payload = await request.json()

    if (!payload.fileName || !payload.fileBase64) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: fileName, fileBase64" },
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
      console.error("[webhook/anexo] Network error connecting to n8n:", fetchError)
      return NextResponse.json({
        success: false,
        message: "No se pudo conectar con n8n. Verifique que el webhook esté activo.",
      })
    }

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text().catch(() => "Sin respuesta")
      console.error(`[webhook/anexo] n8n responded with ${n8nResponse.status}: ${errorText}`)
      return NextResponse.json({
        success: false,
        message: n8nResponse.status === 404
          ? "El webhook de n8n no está registrado. En modo test, haga clic en 'Listen for test event' en n8n antes de intentar."
          : `n8n respondió con error ${n8nResponse.status}.`,
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
      message: "Archivo enviado a n8n correctamente",
      data: n8nData,
    })
  } catch (error) {
    console.error("[webhook/anexo] Error processing request:", error)
    return NextResponse.json({
      success: false,
      message: "Error interno al procesar la solicitud.",
    })
  }
}
