"use client"

import React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Calendar, Upload, Trash2, Plus, FileSpreadsheet, AlertTriangle, CheckCircle2, Edit2, Download, Loader2 } from "lucide-react"
import type { Holiday } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { parseLocalDate } from "@/lib/utils"

export function HolidayManager() {
  const { holidays, setHolidays, addHoliday, updateHoliday, deleteHoliday } = useData()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null)
  const [newHolidayDate, setNewHolidayDate] = useState("")
  const [newHolidayName, setNewHolidayName] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [editHolidayDate, setEditHolidayDate] = useState("")
  const [editHolidayName, setEditHolidayName] = useState("")
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isLoadingApi, setIsLoadingApi] = useState(false)

  // Filtrar feriados por año
  const filteredHolidays = holidays
    .filter((h) => new Date(h.date).getFullYear() === selectedYear)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Procesar archivo Excel/CSV
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      const text = await file.text()
      const lines = text.split("\n").filter((line) => line.trim())
      
      // Saltar encabezado
      const dataLines = lines.slice(1)
      const newHolidays: Holiday[] = []
      const errors: string[] = []

      dataLines.forEach((line, index) => {
        // Soportar CSV con coma o punto y coma
        const parts = line.includes(";") ? line.split(";") : line.split(",")
        
        if (parts.length >= 2) {
          const dateStr = parts[0].trim()
          const name = parts[1].trim().replace(/"/g, "")

          // Parsear fecha en formato DD-MM-AAAA o DD/MM/AAAA
          let parsedDate: string | null = null
          
          if (dateStr.includes("-")) {
            const [day, month, year] = dateStr.split("-")
            if (day && month && year) {
              parsedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
            }
          } else if (dateStr.includes("/")) {
            const [day, month, year] = dateStr.split("/")
            if (day && month && year) {
              parsedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
            }
          }

          if (parsedDate && name) {
            // Verificar si la fecha es válida
            const testDate = new Date(parsedDate)
            if (!isNaN(testDate.getTime())) {
              newHolidays.push({
                id: `h-upload-${Date.now()}-${index}`,
                date: parsedDate,
                name,
                createdAt: new Date().toISOString(),
              })
            } else {
              errors.push(`Línea ${index + 2}: Fecha inválida "${dateStr}"`)
            }
          } else {
            errors.push(`Línea ${index + 2}: Formato incorrecto`)
          }
        }
      })

      if (newHolidays.length > 0) {
        // Combinar con existentes, evitando duplicados por fecha
        const existingDates = new Set(holidays.map((h) => h.date))
        const uniqueNew = newHolidays.filter((h) => !existingDates.has(h.date))
        
        // Add all unique holidays using the context
        await Promise.all(uniqueNew.map((holiday) => addHoliday(holiday)))
        
        setUploadResult({
          success: true,
          message: `Se importaron ${uniqueNew.length} feriados correctamente.${
            errors.length > 0 ? ` ${errors.length} líneas con errores.` : ""
          }${newHolidays.length - uniqueNew.length > 0 ? ` ${newHolidays.length - uniqueNew.length} duplicados ignorados.` : ""}`,
        })
      } else {
        setUploadResult({
          success: false,
          message: `No se pudieron importar feriados. ${errors.length > 0 ? errors.slice(0, 3).join(", ") : "Verifique el formato del archivo."}`,
        })
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: "Error al procesar el archivo. Asegúrese de que sea un archivo CSV válido.",
      })
    } finally {
      setIsUploading(false)
      // Reset input
      event.target.value = ""
    }
  }, [holidays])

  // Agregar feriado manual
  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) return

    const exists = holidays.some((h) => h.date === newHolidayDate)
    if (exists) {
      setUploadResult({
        success: false,
        message: "Ya existe un feriado en esa fecha.",
      })
      return
    }

    const newHoliday: Holiday = {
      id: `h-manual-${Date.now()}`,
      date: newHolidayDate,
      name: newHolidayName.trim(),
      createdAt: new Date().toISOString(),
    }

    addHoliday(newHoliday)
    setNewHolidayDate("")
    setNewHolidayName("")
    setIsAddDialogOpen(false)
    setUploadResult({
      success: true,
      message: "Feriado agregado correctamente.",
    })
  }

  // Eliminar feriado
  const handleDeleteHoliday = (id: string) => {
    deleteHoliday(id)
  }

  // Abrir diálogo de edición
  const handleOpenEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setEditHolidayDate(holiday.date)
    setEditHolidayName(holiday.name)
    setIsEditDialogOpen(true)
  }

  // Actualizar feriado
  const handleUpdateHoliday = () => {
    if (!editingHoliday || !editHolidayDate || !editHolidayName.trim()) return

    // Verificar si la nueva fecha ya existe (excluyendo el actual)
    const exists = holidays.some((h) => h.id !== editingHoliday.id && h.date === editHolidayDate)
    if (exists) {
      setUploadResult({
        success: false,
        message: "Ya existe otro feriado en esa fecha.",
      })
      return
    }

    updateHoliday(editingHoliday.id, {
      date: editHolidayDate,
      name: editHolidayName.trim(),
    })

    setIsEditDialogOpen(false)
    setEditingHoliday(null)
    setEditHolidayDate("")
    setEditHolidayName("")
    setUploadResult({
      success: true,
      message: "Feriado actualizado correctamente.",
    })
  }

  // Cargar feriados desde API chilena
  const handleLoadChileanHolidays = async () => {
    setIsLoadingApi(true)
    setUploadResult(null)

    try {
      const response = await fetch(`/api/feriados-chile?year=${selectedYear}`)
      const json = await response.json()

      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        setUploadResult({
          success: false,
          message: json.message || `No se encontraron feriados para ${selectedYear}.`,
        })
        return
      }

      const existingDates = new Set(holidays.map((h) => h.date))
      const newHolidays: Holiday[] = []

      for (const item of json.data) {
        if (!existingDates.has(item.date)) {
          newHolidays.push({
            id: `h-api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: item.date,
            name: item.name,
            createdAt: new Date().toISOString(),
          })
        }
      }

      if (newHolidays.length > 0) {
        await Promise.all(newHolidays.map((h) => addHoliday(h)))
        const duplicates = json.data.length - newHolidays.length
        setUploadResult({
          success: true,
          message: `Se importaron ${newHolidays.length} feriados chilenos de ${selectedYear}.${duplicates > 0 ? ` ${duplicates} ya existían.` : ""}`,
        })
      } else {
        setUploadResult({
          success: true,
          message: `Todos los feriados de ${selectedYear} ya están registrados.`,
        })
      }
    } catch (error) {
      console.error("Error loading Chilean holidays:", error)
      setUploadResult({
        success: false,
        message: "Error al conectar con la API de feriados chilenos.",
      })
    } finally {
      setIsLoadingApi(false)
    }
  }

  // Obtener años disponibles
  const currentYear = new Date().getFullYear()
  const yearsFromHolidays = holidays.map((h) => parseLocalDate(h.date).getFullYear())
  const allYears = new Set([...yearsFromHolidays, currentYear, currentYear + 1])
  const availableYears = Array.from(allYears).sort((a, b) => b - a)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Gestión de Feriados
              </CardTitle>
              <CardDescription>
                Administra el calendario de feriados. Los días festivos no se descuentan del saldo de vacaciones.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Filtro por año */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {/* Agregar manualmente */}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Feriado</DialogTitle>
                    <DialogDescription>
                      Ingresa la fecha y nombre del feriado a agregar.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="holiday-date">Fecha</Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holiday-name">Nombre del Feriado</Label>
                      <Input
                        id="holiday-name"
                        placeholder="Ej: Día de la Independencia"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddHoliday} disabled={!newHolidayDate || !newHolidayName.trim()}>
                      Agregar Feriado
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Editar feriado */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Feriado</DialogTitle>
                    <DialogDescription>
                      Modifica la fecha o nombre del feriado.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-holiday-date">Fecha</Label>
                      <Input
                        id="edit-holiday-date"
                        type="date"
                        value={editHolidayDate}
                        onChange={(e) => setEditHolidayDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-holiday-name">Nombre del Feriado</Label>
                      <Input
                        id="edit-holiday-name"
                        placeholder="Ej: Día de la Independencia"
                        value={editHolidayName}
                        onChange={(e) => setEditHolidayName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleUpdateHoliday} disabled={!editHolidayDate || !editHolidayName.trim()}>
                      Guardar Cambios
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Cargar feriados chilenos desde API */}
              <Button
                variant="default"
                size="sm"
                onClick={handleLoadChileanHolidays}
                disabled={isLoadingApi}
              >
                {isLoadingApi ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Cargar Feriados Chile {selectedYear}
                  </>
                )}
              </Button>

              {/* Cargar archivo */}
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button variant="outline" size="sm" disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Procesando..." : "Cargar CSV"}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instrucciones de formato */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato del archivo:</strong> CSV con columnas <code>Fecha</code> (DD-MM-AAAA) y <code>Nombre</code>.
              <br />
              <span className="text-xs text-muted-foreground">Ejemplo: 18-09-2026;Independencia Nacional</span>
            </AlertDescription>
          </Alert>

          {/* Resultado de carga */}
          {uploadResult && (
            <Alert className={uploadResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              {uploadResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={uploadResult.success ? "text-green-700" : "text-red-700"}>
                {uploadResult.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Tabla de feriados */}
          {filteredHolidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay feriados registrados para {selectedYear}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre del Feriado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHolidays.map((holiday) => {
                  const date = parseLocalDate(holiday.date)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const isPast = date < today
                  
                  return (
                    <TableRow key={holiday.id} className={isPast ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {date.toLocaleDateString("es-CL", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                          {isPast && (
                            <Badge variant="secondary" className="text-[10px]">
                              Pasado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{holiday.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(holiday)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {/* Resumen */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
            <span>Total de feriados en {selectedYear}: {filteredHolidays.length}</span>
            <span>Total general: {holidays.length} feriados</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
