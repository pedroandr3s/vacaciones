import type { Employee, VacationBalance, VacationRequest, Holiday, Contract
} from "./types"

// Feriados de Chile 2026
export const mockHolidays: Holiday[] = [
  { id: "h1", date: "2026-01-01", name: "Año Nuevo", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h2", date: "2026-04-03", name: "Viernes Santo", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h3", date: "2026-04-04", name: "Sábado Santo", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h4", date: "2026-05-01", name: "Día del Trabajo", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h5", date: "2026-05-21", name: "Día de las Glorias Navales", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h6", date: "2026-06-20", name: "Día Nacional de los Pueblos Indígenas", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h7", date: "2026-06-29", name: "San Pedro y San Pablo", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h8", date: "2026-07-16", name: "Día de la Virgen del Carmen", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h9", date: "2026-08-15", name: "Asunción de la Virgen", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h10", date: "2026-09-18", name: "Independencia Nacional", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h11", date: "2026-09-19", name: "Día de las Glorias del Ejército", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h12", date: "2026-10-12", name: "Encuentro de Dos Mundos", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h13", date: "2026-10-31", name: "Día de las Iglesias Evangélicas", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h14", date: "2026-11-01", name: "Día de Todos los Santos", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h15", date: "2026-12-08", name: "Inmaculada Concepción", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h16", date: "2026-12-25", name: "Navidad", createdAt: "2026-01-01T00:00:00Z" },
]

// Contratos de colaboradores (para manejar reingresos)
export const mockContracts: Contract[] = [
  // Administrador - contrato vigente
  { id: "c1", collaboratorId: "1", startDate: "2020-01-01", status: "activo", position: "Administrador", initialBalance: 0, createdAt: "2020-01-01T00:00:00Z", updatedAt: "2020-01-01T00:00:00Z" },
  // Carlos Ruiz - contrato vigente
  { id: "c2", collaboratorId: "2", startDate: "2022-03-15", status: "activo", position: "Desarrollador Senior", initialBalance: 0, createdAt: "2022-03-15T00:00:00Z", updatedAt: "2022-03-15T00:00:00Z" },
  // Beatriz Soto - contrato vigente
  { id: "c3", collaboratorId: "3", startDate: "2021-06-01", status: "activo", position: "Diseñadora UX", initialBalance: 0, createdAt: "2021-06-01T00:00:00Z", updatedAt: "2021-06-01T00:00:00Z" },
  // Diego Vera - REINGRESO: contrato anterior inactivo + contrato nuevo activo
  { id: "c4a", collaboratorId: "4", startDate: "2021-01-10", endDate: "2022-06-30", status: "inactivo", statusReason: "Renuncia voluntaria", position: "Analista Junior", initialBalance: 0, createdAt: "2021-01-10T00:00:00Z", updatedAt: "2022-06-30T00:00:00Z" },
  { id: "c4b", collaboratorId: "4", startDate: "2023-01-10", status: "activo", position: "Analista de Datos", initialBalance: 5, createdAt: "2023-01-10T00:00:00Z", updatedAt: "2023-01-10T00:00:00Z" },
  // Ana Sánchez - contrato vigente
  { id: "c5", collaboratorId: "5", startDate: "2020-08-20", status: "activo", position: "Gerente de Proyectos", initialBalance: 0, createdAt: "2020-08-20T00:00:00Z", updatedAt: "2020-08-20T00:00:00Z" },
  // Miguel García - contrato vigente (extranjero)
  { id: "c6", collaboratorId: "6", startDate: "2024-06-01", status: "activo", position: "Ingeniero de Software", initialBalance: 0, createdAt: "2024-06-01T00:00:00Z", updatedAt: "2024-06-01T00:00:00Z" },
  // Lucía Rodríguez - contrato vigente (extranjero)
  { id: "c7", collaboratorId: "7", startDate: "2024-01-15", status: "activo", position: "Consultora de Negocios", initialBalance: 0, createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-01-15T00:00:00Z" },
  // Juan Pérez - Inactivo
  { id: "c8", collaboratorId: "8", startDate: "2019-03-01", endDate: "2026-01-15", status: "inactivo", statusReason: "Fin de contrato", position: "Contador", initialBalance: 0, createdAt: "2019-03-01T00:00:00Z", updatedAt: "2026-01-15T00:00:00Z" },
]

export const mockEmployees: Employee[] = [
  {
    id: "1",
    email: "admin@empresa.cl",
    fullName: "Administrador Sistema",
    rut: "12.345.678-9",
    hireDate: "2020-01-01",
    position: "Administrador",
    role: "admin",
    contractType: "chile",
    status: "activo",
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
  },
  {
    id: "2",
    email: "cruiz@empresa.cl",
    fullName: "Carlos Ruiz",
    rut: "18.234.567-8",
    hireDate: "2022-03-15",
    position: "Desarrollador Senior",
    role: "employee",
    contractType: "chile",
    status: "activo",
    createdAt: "2022-03-15T00:00:00Z",
    updatedAt: "2022-03-15T00:00:00Z",
  },
  {
    id: "3",
    email: "bsoto@empresa.cl",
    fullName: "Beatriz Soto",
    rut: "17.456.789-0",
    hireDate: "2021-06-01",
    position: "Diseñadora UX",
    role: "employee",
    contractType: "chile",
    status: "activo",
    createdAt: "2021-06-01T00:00:00Z",
    updatedAt: "2021-06-01T00:00:00Z",
  },
  {
    id: "4",
    email: "dvera@empresa.cl",
    fullName: "Diego Vera",
    rut: "19.876.543-2",
    hireDate: "2023-01-10",
    position: "Analista de Datos",
    role: "employee",
    contractType: "chile",
    status: "activo",
    createdAt: "2023-01-10T00:00:00Z",
    updatedAt: "2023-01-10T00:00:00Z",
  },
  {
    id: "5",
    email: "asanchez@empresa.cl",
    fullName: "Ana Sánchez Torres",
    rut: "16.345.678-1",
    hireDate: "2020-08-20",
    position: "Gerente de Proyectos",
    role: "employee",
    contractType: "chile",
    status: "activo",
    createdAt: "2020-08-20T00:00:00Z",
    updatedAt: "2020-08-20T00:00:00Z",
  },
  // Contractors en el Extranjero
  {
    id: "6",
    email: "mgarcia@empresa.cl",
    fullName: "Miguel García López",
    rut: "26.123.456-7",
    hireDate: "2024-06-01",
    position: "Ingeniero de Software",
    role: "employee",
    contractType: "contractor_extranjero",
    status: "activo",
    createdAt: "2024-06-01T00:00:00Z",
    updatedAt: "2024-06-01T00:00:00Z",
  },
  {
    id: "7",
    email: "lrodriguez@empresa.cl",
    fullName: "Lucía Rodríguez Méndez",
    rut: "27.654.321-8",
    hireDate: "2024-01-15",
    position: "Consultora de Negocios",
    role: "employee",
    contractType: "contractor_extranjero",
    status: "activo",
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  },
  // Colaborador Inactivo (ejemplo)
  {
    id: "8",
    email: "jperez@empresa.cl",
    fullName: "Juan Pérez",
    rut: "15.987.654-3",
    hireDate: "2019-03-01",
    position: "Contador",
    role: "employee",
    contractType: "chile",
    status: "inactivo",
    statusReason: "Fin de contrato",
    statusEndDate: "2026-01-15",
    createdAt: "2019-03-01T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
  },
]

// Nota: legalDays representa los días ACUMULADOS desde inicio del contrato
// Para Contrato en Chile: acumulación perpetua (1.25 días/mes = 15 días/año)
// Para Contractor extranjero: 15 días legales + 5 Naitus que se ACTIVAN al cumplir
//   1 año desde la fecha de inicio del contrato. Al cumplir un nuevo ciclo anual,
//   los días se RENUEVAN (no se acumulan).
// 
// naitusDays: Días Naitus - 5 días fijos por año, NO ACUMULABLES
// Para Chile: se renuevan cada año calendario; requieren usar 15 días legales para desbloquearlos
// Para Contractor: se renuevan en cada ciclo anual del contrato (junto con legales);
//   siempre disponibles sin condición de desbloqueo, pero el sistema descuenta primero los legales
//
// Cálculos basados en fecha actual (Feb 2026):
// - Carlos Ruiz (hireDate: 2022-03-15): ~46 meses = 57.5 días acumulados
// - Beatriz Soto (hireDate: 2021-06-01): ~56 meses = 70.0 días acumulados  
// - Diego Vera (hireDate: 2023-01-10): ~37 meses = 46.3 días acumulados
// - Ana Sánchez (hireDate: 2020-08-20): ~66 meses = 82.5 días acumulados
// - Miguel García (contractor, hireDate: 2024-06-01): cumplió 1 año en Jun 2025 → 15 días legales, ciclo 2 activo
// - Lucía Rodríguez (contractor, hireDate: 2024-01-15): cumplió 1 año en Ene 2025 → 15 días legales, ciclo 2 activo
// - Juan Pérez (hireDate: 2019-03-01): ~83 meses = 103.8 días acumulados (inactivo)

export const mockBalances: VacationBalance[] = [
  {
    id: "b1",
    employeeId: "2", // Carlos Ruiz - Chile, 3 años 10 meses = 57.5 días acumulados
    year: 2026,
    legalDays: 57.5, // Días acumulados desde marzo 2022
    naitusDays: 5.0, // Días Naitus DESBLOQUEADOS porque ya usó 15+ días
    debtDays: 0.0,
    usedDays: 15.0, // Ha tomado 15 días en total
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "b2",
    employeeId: "3", // Beatriz Soto - Chile, 4 años 8 meses = 70.0 días acumulados
    year: 2026,
    legalDays: 70.0, // Días acumulados desde junio 2021
    naitusDays: 5.0, // Días Naitus desbloqueados
    debtDays: -5.0,
    usedDays: 70.0, // Ha usado todos sus días legales
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "b3",
    employeeId: "4", // Diego Vera - Chile, 3 años 1 mes = 46.3 días acumulados
    year: 2026,
    legalDays: 46.3, // Días acumulados desde enero 2023
    naitusDays: 5.0, // Días Naitus desbloqueados
    debtDays: 0.0,
    usedDays: 30.0, // Ha tomado 30 días
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "b4",
    employeeId: "5", // Ana Sánchez - Chile, 5 años 6 meses = 82.5 días acumulados
    year: 2026,
    legalDays: 82.5, // Días acumulados desde agosto 2020
    naitusDays: 5.0, // Días Naitus BLOQUEADOS - no ha usado 15 días legales aún
    debtDays: 0.0,
    usedDays: 3.0, // Solo usó 3 días legales
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "b5",
    employeeId: "6", // Miguel García - Contractor extranjero
    // Contrato: 2024-06-01 → cumplió 1 año: 2025-06-01 → ciclo 2: 2025-06-01 a 2026-05-31
    // Al cumplir el año se activan 15 días legales + 5 Naitus. Se renuevan cada ciclo.
    year: 2026,
    legalDays: 15.0, // 15 días activados al cumplir 1 año (renovados en ciclo 2)
    naitusDays: 5.0, // 5 Naitus activados al cumplir 1 año
    debtDays: 0.0,
    usedDays: 3.0, // Ha usado 3 días en su ciclo actual
    createdAt: "2025-06-01T00:00:00Z",
    updatedAt: "2025-06-01T00:00:00Z",
  },
  {
    id: "b6",
    employeeId: "7", // Lucía Rodríguez - Contractor extranjero
    // Contrato: 2024-01-15 → cumplió 1 año: 2025-01-15 → ciclo 2: 2025-01-15 a 2026-01-14
    //   → ciclo 3: 2026-01-15 a 2027-01-14 (renovación reciente)
    year: 2026,
    legalDays: 15.0, // 15 días renovados al iniciar ciclo 3
    naitusDays: 5.0, // 5 Naitus renovados al iniciar ciclo 3
    debtDays: 0.0,
    usedDays: 0.0, // Recién se renovó, no ha usado días
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "b7",
    employeeId: "8", // Juan Pérez - Inactivo, 6 años 10 meses = 103.8 días acumulados
    year: 2025,
    legalDays: 103.8, // Días acumulados hasta fin de contrato
    naitusDays: 5.0, // Días Naitus
    debtDays: 0.0,
    usedDays: 98.8, // Tenía 5 días sin usar al terminar contrato
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
]

export const mockRequests: VacationRequest[] = [
  {
    id: "r1",
    employeeId: "2",
    absenceType: "vacacion_remunerada",
    startDate: "2025-12-15",
    endDate: "2025-12-29",
    totalDays: 15.0,
    legalDaysUsed: 15.0,
    naitusDaysUsed: 0.0,
    debtDaysUsed: 0.0,
    status: "approved",
    notes: "Vacaciones de fin de año",
    reviewedBy: "1",
    reviewedAt: "2025-12-01T10:30:00Z",
    createdAt: "2025-11-20T14:20:00Z",
    updatedAt: "2025-12-01T10:30:00Z",
  },
  {
    id: "r2",
    employeeId: "3",
    absenceType: "vacacion_remunerada",
    startDate: "2025-11-01",
    endDate: "2025-11-20",
    totalDays: 20.0,
    legalDaysUsed: 15.0,
    naitusDaysUsed: 0.0,
    debtDaysUsed: 5.0,
    status: "approved",
    notes: "Viaje urgente",
    reviewedBy: "1",
    reviewedAt: "2025-10-25T09:15:00Z",
    createdAt: "2025-10-20T09:15:00Z",
    updatedAt: "2025-10-25T09:15:00Z",
  },
  {
    id: "r3",
    employeeId: "4",
    absenceType: "vacacion_remunerada",
    startDate: "2025-12-30",
    endDate: "2026-01-10",
    totalDays: 15.0,
    legalDaysUsed: 15.0,
    naitusDaysUsed: 0.0,
    debtDaysUsed: 0.0,
    status: "approved",
    reviewedBy: "1",
    reviewedAt: "2025-12-15T11:00:00Z",
    createdAt: "2025-12-10T08:00:00Z",
    updatedAt: "2025-12-15T11:00:00Z",
  },
  {
    id: "r4",
    employeeId: "5",
    absenceType: "vacacion_remunerada",
    startDate: "2025-11-15",
    endDate: "2025-11-17",
    totalDays: 3.0,
    legalDaysUsed: 3.0,
    naitusDaysUsed: 0.0,
    debtDaysUsed: 0.0,
    status: "approved",
    reviewedBy: "1",
    reviewedAt: "2025-11-05T10:00:00Z",
    createdAt: "2025-11-02T09:00:00Z",
    updatedAt: "2025-11-05T10:00:00Z",
  },
  // Permisos sin goce de sueldo
  {
    id: "r5",
    employeeId: "2",
    absenceType: "permiso_sin_goce",
    startDate: "2026-03-02",
    endDate: "2026-03-06",
    totalDays: 5.0,
    legalDaysUsed: 0.0,
    naitusDaysUsed: 0.0,
    debtDaysUsed: 0.0,
    status: "approved",
    reason: "Tramites personales en el extranjero",
    notes: "Necesito realizar tramites consulares que solo se atienden en dias habiles",
    reviewedBy: "1",
    reviewedAt: "2026-02-01T14:00:00Z",
    createdAt: "2026-01-25T10:00:00Z",
    updatedAt: "2026-02-01T14:00:00Z",
  },
  {
    id: "r6",
    employeeId: "5",
    absenceType: "permiso_sin_goce",
    startDate: "2026-04-13",
    endDate: "2026-04-17",
    totalDays: 5.0,
    legalDaysUsed: 0.0,
    naitusDaysUsed: 0.0,
    debtDaysUsed: 0.0,
    status: "pending",
    reason: "Asuntos familiares urgentes",
    attachmentName: "justificacion_familiar.pdf",
    createdAt: "2026-02-03T09:30:00Z",
    updatedAt: "2026-02-03T09:30:00Z",
  },
]
