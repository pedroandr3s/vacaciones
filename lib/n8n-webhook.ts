/**
 * n8n Webhook Integration
 * Builds and sends vacation data payloads to an external n8n workflow.
 * The actual HTTP call goes through /api/webhook/vacaciones to keep
 * the webhook URL server-side only.
 */

export interface N8nVacationPayload {
  // Employee identification
  employeeId: string
  employeeName: string
  employeeEmail: string
  employeePosition: string
  contractType: "chile" | "contractor_extranjero"

  // Leave details
  leaveType: "vacacion_remunerada" | "permiso_sin_goce"
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  totalBusinessDays: number
  notes: string

  // Balance breakdown BEFORE the leave
  balanceBefore: {
    legalDays: number
    legalUsed: number
    legalAvailable: number
    naitusDays: number
    debtDays: number
    totalAvailable: number
  }

  // Balance breakdown AFTER the leave
  balanceAfter: {
    legalConsumed: number
    naitusConsumed: number
    debtGenerated: number
    projectedLegal: number
    projectedNaitus: number
    projectedDebt: number
    totalAvailableAfter: number
  }

  // Metadata
  registeredBy: "admin" | "employee"
  registeredAt: string // ISO timestamp
}

export interface N8nWebhookResult {
  success: boolean
  message: string
}

/**
 * Sends the vacation payload to the server-side proxy route,
 * which forwards it to the n8n webhook.
 */
export async function sendVacationToN8n(
  payload: N8nVacationPayload,
): Promise<N8nWebhookResult> {
  try {
    const response = await fetch("/api/webhook/vacaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        message: data.error || `Error del servidor: ${response.status}`,
      }
    }

    return { success: true, message: "Datos enviados a n8n correctamente" }
  } catch (error) {
    console.error("Error al enviar a n8n:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error de conexion",
    }
  }
}
