-- Insert admin user (password: admin123)
INSERT INTO employees (email, password_hash, full_name, rut, hire_date, role) VALUES
('admin@empresa.cl', '$2a$10$rKZlFqZqZ9qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0q', 'Administrador Sistema', '12.345.678-9', '2020-01-01', 'admin');

-- Insert sample employees
INSERT INTO employees (email, password_hash, full_name, rut, hire_date, role) VALUES
('jperez@empresa.cl', '$2a$10$rKZlFqZqZ9qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0q', 'Juan Pérez González', '18.234.567-8', '2022-03-15', 'employee'),
('mgomez@empresa.cl', '$2a$10$rKZlFqZqZ9qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0q', 'María Gómez Silva', '17.456.789-0', '2021-06-01', 'employee'),
('crodriguez@empresa.cl', '$2a$10$rKZlFqZqZ9qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0q', 'Carlos Rodríguez Muñoz', '19.876.543-2', '2023-01-10', 'employee'),
('asanchez@empresa.cl', '$2a$10$rKZlFqZqZ9qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0qP0q', 'Ana Sánchez Torres', '16.345.678-1', '2020-08-20', 'employee');

-- Insert vacation balances for current year (2026)
INSERT INTO vacation_balances (employee_id, year, legal_days, benefit_days, debt_days, used_days)
SELECT 
  id,
  2026,
  CASE 
    WHEN hire_date < '2025-01-01' THEN 15.0 -- Full year entitlement
    ELSE 7.5 -- Partial year
  END,
  5.0, -- Benefit days
  0.0, -- No debt
  0.0  -- No days used yet
FROM employees WHERE role = 'employee';

-- Insert some sample vacation requests
WITH employee_ids AS (
  SELECT id FROM employees WHERE email = 'jperez@empresa.cl'
)
INSERT INTO vacation_requests (employee_id, start_date, end_date, total_days, legal_days_used, status)
SELECT id, '2026-02-10', '2026-02-14', 5.0, 5.0, 'approved'
FROM employee_ids;

WITH employee_ids AS (
  SELECT id FROM employees WHERE email = 'mgomez@empresa.cl'
)
INSERT INTO vacation_requests (employee_id, start_date, end_date, total_days, legal_days_used, status)
SELECT id, '2026-03-01', '2026-03-07', 7.0, 7.0, 'pending'
FROM employee_ids;
