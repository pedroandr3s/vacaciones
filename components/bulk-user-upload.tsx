"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Plus,
  Trash2,
  Send,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react"
import { generateProvisionalPassword } from "@/lib/google-sheets"
import { useData } from "@/contexts/data-context"
import { generateId } from "@/lib/firebase-services"
import type { Employee } from "@/lib/types"

type UserRow = {
  nombre: string
  apellido: string
  correo: string
}

type UserResult = {
  correo: string
  nombre: string
  success: boolean
  error?: string
}

type BulkResult = {
  created: number
  failed: number
  details: UserResult[]
  webhookSuccess?: boolean
  webhookData?: unknown
}

export function BulkUserUpload() {
  const { addEmployee } = useData()
  const [rows, setRows] = useState<UserRow[]>([])
  const [newRow, setNewRow] = useState<UserRow>({ nombre: "", apellido: "", correo: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState("")
  const [result, setResult] = useState<BulkResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Manual add ---
  const handleAddRow = () => {
    if (!newRow.nombre.trim() || !newRow.apellido.trim() || !newRow.correo.trim()) return
    setRows((prev) => [...prev, { ...newRow }])
    setNewRow({ nombre: "", apellido: "", correo: "" })
    setResult(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddRow()
    }
  }

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
    setResult(null)
  }

  const handleClearAll = () => {
    setRows([])
    setResult(null)
  }

  // --- CSV Upload ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)

      // Detect if first line is a header
      const firstLine = lines[0].toLowerCase()
      const startIndex =
        firstLine.includes("nombre") || firstLine.includes("correo") || firstLine.includes("email")
          ? 1
          : 0

      const parsed: UserRow[] = []
      for (let i = startIndex; i < lines.length; i++) {
        // Support comma, semicolon, or tab as delimiter
        const parts = lines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""))
        if (parts.length >= 3) {
          parsed.push({
            nombre: parts[0],
            apellido: parts[1],
            correo: parts[2],
          })
        } else if (parts.length === 2) {
          // Maybe "Full Name, email" format
          const nameParts = parts[0].split(" ")
          parsed.push({
            nombre: nameParts[0] || "",
            apellido: nameParts.slice(1).join(" ") || "",
            correo: parts[1],
          })
        }
      }

      if (parsed.length > 0) {
        setRows((prev) => [...prev, ...parsed])
        setResult(null)
      }
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // --- Submit: create users in Firebase Auth + Firestore, then send to n8n ---
  const handleSubmit = async () => {
    if (rows.length === 0) return
    setIsSubmitting(true)
    setResult(null)

    const details: UserResult[] = []
    const usuariosConPassword: Array<UserRow & { contrasena: string }> = []
    let created = 0
    let failed = 0

    try {
      // 1. Generate passwords and create each user
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const contrasena = generateProvisionalPassword()
        const fullName = `${row.nombre} ${row.apellido}`.trim()
        setProgress(`Creando usuario ${i + 1} de ${rows.length}: ${fullName}...`)

        try {
          // Create Firebase Auth user
          const authResponse = await fetch("/api/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: row.correo, password: contrasena }),
          })
          const authResult = await authResponse.json()

          if (!authResult.success) {
            details.push({ correo: row.correo, nombre: fullName, success: false, error: authResult.error })
            failed++
            // Still include in webhook payload even if auth failed
            usuariosConPassword.push({ ...row, contrasena })
            continue
          }

          // Create employee in Firestore
          const now = new Date().toISOString()
          const newEmployee: Employee = {
            id: generateId("employees"),
            email: row.correo,
            fullName,
            rut: "",
            hireDate: now.split("T")[0],
            role: "employee",
            contractType: "chile",
            status: "activo",
            mustChangePassword: true,
            createdAt: now,
            updatedAt: now,
          }
          await addEmployee(newEmployee)

          details.push({ correo: row.correo, nombre: fullName, success: true })
          usuariosConPassword.push({ ...row, contrasena })
          created++
        } catch (err) {
          console.error(`Error creating user ${row.correo}:`, err)
          details.push({ correo: row.correo, nombre: fullName, success: false, error: "Error inesperado" })
          usuariosConPassword.push({ ...row, contrasena })
          failed++
        }
      }

      // 2. Send all users (with passwords) to n8n webhook
      setProgress("Enviando datos a n8n...")
      let webhookSuccess = false
      let webhookData: unknown = null
      try {
        const response = await fetch("/api/webhook/naitus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuarios: usuariosConPassword }),
        })
        const data = await response.json()
        webhookSuccess = data.success ?? false
        webhookData = data.data ?? data
      } catch {
        webhookSuccess = false
        webhookData = { error: "No se pudo conectar con n8n" }
      }

      setResult({ created, failed, details, webhookSuccess, webhookData })
    } catch (error) {
      console.error("Bulk upload error:", error)
      setResult({ created, failed, details })
    } finally {
      setIsSubmitting(false)
      setProgress("")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Carga Masiva de Usuarios
          </CardTitle>
          <CardDescription>
            Agregue usuarios manualmente o cargue un archivo CSV con columnas: Nombre, Apellido, Correo.
            Los datos se enviarán al webhook de n8n para su procesamiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CSV Upload */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Cargar CSV
            </Button>
            <span className="text-xs text-muted-foreground">
              Formato: Nombre, Apellido, Correo (separados por coma, punto y coma, o tab)
            </span>
          </div>

          {/* Manual add row */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                placeholder="Juan"
                value={newRow.nombre}
                onChange={(e) => setNewRow((p) => ({ ...p, nombre: e.target.value }))}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Apellido</Label>
              <Input
                placeholder="Pérez"
                value={newRow.apellido}
                onChange={(e) => setNewRow((p) => ({ ...p, apellido: e.target.value }))}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Correo</Label>
              <Input
                placeholder="jperez@naitus.cl"
                value={newRow.correo}
                onChange={(e) => setNewRow((p) => ({ ...p, correo: e.target.value }))}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button
              size="icon"
              variant="secondary"
              onClick={handleAddRow}
              disabled={!newRow.nombre.trim() || !newRow.apellido.trim() || !newRow.correo.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-sm">
                  {rows.length} usuario{rows.length !== 1 ? "s" : ""} en la lista
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Limpiar todo
                </Button>
              </div>

              <div className="border rounded-md max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold w-8">#</TableHead>
                      <TableHead className="text-xs font-semibold">Nombre</TableHead>
                      <TableHead className="text-xs font-semibold">Apellido</TableHead>
                      <TableHead className="text-xs font-semibold">Correo</TableHead>
                      <TableHead className="text-xs font-semibold w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm">{row.nombre}</TableCell>
                        <TableCell className="text-sm">{row.apellido}</TableCell>
                        <TableCell className="text-sm text-slate-600">{row.correo}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                            onClick={() => handleRemoveRow(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || rows.length === 0}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {progress || "Procesando..."}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Crear {rows.length} usuario{rows.length !== 1 ? "s" : ""} y enviar a n8n
                  </>
                )}
              </Button>
            </>
          )}

          {/* Empty state */}
          {rows.length === 0 && !result && (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Upload className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Agregue usuarios manualmente o cargue un archivo CSV</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              {/* Summary */}
              <Alert className={result.failed === 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}>
                {result.failed === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <AlertDescription>
                  <p className="font-medium">
                    {result.created} usuario{result.created !== 1 ? "s" : ""} creado{result.created !== 1 ? "s" : ""} exitosamente
                    {result.failed > 0 && (
                      <span className="text-red-600"> · {result.failed} con error</span>
                    )}
                  </p>
                  {result.webhookSuccess !== undefined && (
                    <p className="text-sm mt-1">
                      Webhook n8n: {result.webhookSuccess ? "✓ Enviado correctamente" : "✗ Error al enviar"}
                    </p>
                  )}
                </AlertDescription>
              </Alert>

              {/* Per-user details */}
              {result.details.length > 0 && (
                <div className="border rounded-md max-h-60 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs font-semibold">Usuario</TableHead>
                        <TableHead className="text-xs font-semibold">Correo</TableHead>
                        <TableHead className="text-xs font-semibold w-24">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.details.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{d.nombre}</TableCell>
                          <TableCell className="text-sm text-slate-600">{d.correo}</TableCell>
                          <TableCell>
                            {d.success ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">Creado</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">{d.error || "Error"}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Webhook response data */}
              {result.webhookData != null && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver respuesta de n8n</summary>
                  <pre className="mt-2 bg-slate-100 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                    {typeof result.webhookData === "string" ? result.webhookData : JSON.stringify(result.webhookData as Record<string, unknown>, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
