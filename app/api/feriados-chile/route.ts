import { NextResponse } from "next/server"

/**
 * GET /api/feriados-chile?year=2026
 * Fetches Chilean holidays from the Boostr API for a given year.
 * https://api.boostr.cl/holidays/{year}.json
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get("year") || new Date().getFullYear().toString()

  try {
    const response = await fetch(`https://api.boostr.cl/holidays/${year}.json`, {
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: `La API de feriados respondió con error ${response.status}.`,
        data: [],
      }, { status: response.status })
    }

    const json = await response.json()

    if (json.status === "success" && Array.isArray(json.data)) {
      const holidays = json.data.map((h: { date: string; title: string; inalienable: boolean }) => ({
        date: h.date,
        name: h.title,
        inalienable: h.inalienable,
      }))

      return NextResponse.json({
        success: true,
        data: holidays,
      })
    }

    return NextResponse.json({
      success: false,
      message: "Formato de respuesta inesperado de la API.",
      data: [],
    })
  } catch (error) {
    console.error("[feriados-chile] Error:", error)
    return NextResponse.json({
      success: false,
      message: "No se pudo conectar con la API de feriados chilenos.",
      data: [],
    }, { status: 502 })
  }
}
