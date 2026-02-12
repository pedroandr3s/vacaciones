/**
 * Google Sheets Integration
 * Sends collaborator credentials to the server-side proxy route,
 * which forwards them to a Google Apps Script Web App that writes to the sheet.
 */

export interface SheetCredentialPayload {
  usuario: string
  correo: string
  contrasena: string
}

export interface SheetWriteResult {
  success: boolean
  message: string
}

export async function saveCredentialsToSheet(
  payload: SheetCredentialPayload
): Promise<SheetWriteResult> {
  try {
    const response = await fetch("/api/google-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    return {
      success: data.success ?? false,
      message: data.message ?? "Respuesta inesperada del servidor.",
    }
  } catch (error) {
    console.error("Error al guardar en Google Sheets:", error)
    return {
      success: false,
      message: "Error de conexión al guardar en Google Sheets.",
    }
  }
}

/**
 * Generates a random provisional password.
 * Format: 3 uppercase letters + 4 digits + 1 special char = 8 chars
 */
export function generateProvisionalPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const digits = "23456789"
  const special = "!@#$%"

  let pwd = ""
  for (let i = 0; i < 3; i++) pwd += upper[Math.floor(Math.random() * upper.length)]
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)]
  pwd += special[Math.floor(Math.random() * special.length)]

  return pwd
}
