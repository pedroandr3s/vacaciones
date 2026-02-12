import { NextResponse } from "next/server"

/**
 * POST /api/google-sheets
 * Appends a row to the Google Sheet with collaborator credentials.
 * Uses Google Apps Script Web App as a proxy to write to the sheet.
 *
 * Sheet: https://docs.google.com/spreadsheets/d/16CpyXu4WOanlXOX24kYvfmN_zEpCy2Ylcb7yYFImT44
 * Columns: Usuario | Correo | Contraseña Provisoria
 */

const APPS_SCRIPT_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || ""

export async function POST(request: Request) {
  try {
    const { usuario, correo, contrasena } = await request.json()

    if (!usuario || !correo || !contrasena) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: usuario, correo, contrasena" },
        { status: 400 }
      )
    }

    if (!APPS_SCRIPT_URL) {
      console.warn("[google-sheets] GOOGLE_SHEETS_WEBHOOK_URL not configured, skipping sheet write")
      return NextResponse.json({
        success: false,
        message: "Google Sheets webhook URL no configurada. Los datos se guardaron solo en Firebase.",
      })
    }

    let sheetResponse: Response
    try {
      sheetResponse = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario,
          correo,
          contrasena,
        }),
      })
    } catch (fetchError) {
      console.error("[google-sheets] Network error:", fetchError)
      return NextResponse.json({
        success: false,
        message: "No se pudo conectar con Google Sheets. Los datos se guardaron en Firebase.",
      })
    }

    if (!sheetResponse.ok) {
      const errorText = await sheetResponse.text().catch(() => "Sin respuesta")
      console.error(`[google-sheets] Error ${sheetResponse.status}: ${errorText}`)
      return NextResponse.json({
        success: false,
        message: `Google Sheets respondió con error ${sheetResponse.status}. Los datos se guardaron en Firebase.`,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Datos guardados en Google Sheets correctamente.",
    })
  } catch (error) {
    console.error("[google-sheets] Error processing request:", error)
    return NextResponse.json({
      success: false,
      message: "Error interno al procesar la solicitud.",
    })
  }
}
