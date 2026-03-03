export type Employee = {
  id: string
  email: string
  fullName: string
  rut: string
  birthDate?: string // Fecha de nacimiento del colaborador
  hireDate: string
  position?: string // Cargo del colaborador
  role: "admin" | "employee"
  contractType: "chile" | "contractor_extranjero" // Tipo de contrato
  status: "activo" | "inactivo" // Estado del colaborador
  statusReason?: string // Motivo del estado inactivo
  statusEndDate?: string // Fecha de fin de contrato si está inactivo
  mustChangePassword?: boolean // True si debe cambiar contraseña en primer login
  createdAt: string
  updatedAt: string
}

export type VacationBalance = {
  id: string
  employeeId: string
  year: number
  legalDays: number
  naitusDays: number // Días Naitus: 5 días adicionales, NO acumulables, se renuevan cada año
  debtDays: number
  usedDays: number
  createdAt: string
  updatedAt: string
}

// Tipo de ausencia: remunerada (vacaciones) o sin goce de sueldo
export type AbsenceType = "vacacion_remunerada" | "permiso_sin_goce"

export type VacationRequest = {
  id: string
  employeeId: string
  absenceType: AbsenceType // Tipo de ausencia
  startDate: string
  endDate: string
  totalDays: number
  legalDaysUsed: number
  naitusDaysUsed: number // Dias Naitus usados en esta solicitud
  debtDaysUsed: number
  status: "pending" | "approved" | "rejected" | "cancelled"
  calendarEventId?: string // ID del evento creado en Google Calendar (via n8n)
  notes?: string
  reason?: string // Motivo del permiso (obligatorio para permisos sin goce)
  attachmentName?: string // Nombre del documento adjunto
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export type VacationBalanceWithStatus = VacationBalance & {
  naitusUnlocked: boolean // True si ya usó 15 días legales
  naitusExpired: boolean // True si no usó los días Naitus antes de fin de año
}

export type EmployeeWithBalance = Employee & {
  balance?: VacationBalance
  currentRequests?: VacationRequest[]
}

// Tipos para Gestión de Feriados
export type Holiday = {
  id: string
  date: string // Formato YYYY-MM-DD
  name: string
  createdAt: string
}

// Tipos para Gestión de Contratos (Reingresos)
export type ContractFile = {
  name: string // Nombre original del archivo
  url: string // data:application/pdf;base64,... stored in Firestore
  path: string // Unique file identifier
  uploadedAt: string
}

export type Contract = {
  id: string
  collaboratorId: string
  startDate: string
  endDate?: string // null si está vigente
  status: "activo" | "inactivo"
  statusReason?: string // Motivo del estado inactivo
  position?: string // Cargo durante este contrato
  initialBalance?: number // Saldo inicial de vacaciones
  files?: ContractFile[] // Archivos adjuntos (contrato, anexos, etc.)
  createdAt: string
  updatedAt: string
}

// Tipo actualizado para Colaborador (antes Empleado)
export type Collaborator = {
  id: string
  email: string
  fullName: string
  rut: string
  birthDate?: string // Fecha de nacimiento del colaborador
  role: "admin" | "collaborator"
  contractType: "chile" | "contractor_extranjero" // Tipo de contrato
  createdAt: string
  updatedAt: string
  // El contrato activo se determina por la relación con Contract
  contracts?: Contract[]
  activeContract?: Contract
}

export type CollaboratorWithBalance = Collaborator & {
  balance?: VacationBalance
  currentRequests?: VacationRequest[]
  activeContract?: Contract
}
