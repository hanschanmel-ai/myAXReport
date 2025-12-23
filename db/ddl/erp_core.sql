CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  name text,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  tenant_id uuid REFERENCES tenants(id),
  company_code text,
  legal_name text,
  currency_code char(3),
  timezone text,
  languages jsonb,
  fiscal_calendar jsonb,
  tax_regime jsonb,
  number_series jsonb,
  data_residency text,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, company_code)
);

CREATE TABLE IF NOT EXISTS items (
  tenant_id uuid,
  company_code text,
  item_id uuid PRIMARY KEY,
  sku text,
  name text,
  description_i18n jsonb,
  uom_base text,
  uom_conversions jsonb,
  status text,
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_sku ON items(tenant_id, company_code, sku);
CREATE INDEX IF NOT EXISTS idx_items_custom_fields ON items USING gin(custom_fields);

CREATE TABLE IF NOT EXISTS locations (
  tenant_id uuid,
  company_code text,
  location_id uuid PRIMARY KEY,
  name text,
  type text,
  parent_location_id uuid,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  tenant_id uuid,
  company_code text,
  location_id uuid,
  item_id uuid,
  lot_serial text,
  uom text,
  qty_on_hand numeric,
  qty_reserved numeric,
  cost_method text,
  avg_cost numeric,
  custom_fields jsonb,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, company_code, location_id, item_id, lot_serial)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  tenant_id uuid,
  company_code text,
  so_id uuid PRIMARY KEY,
  so_number text,
  customer_id uuid,
  order_date date,
  currency char(3),
  status text,
  totals jsonb,
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_so_number ON sales_orders(tenant_id, company_code, so_number);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  tenant_id uuid,
  company_code text,
  so_id uuid,
  line_no int,
  item_id uuid,
  uom text,
  qty numeric,
  price numeric,
  discount numeric,
  custom_fields jsonb,
  PRIMARY KEY (tenant_id, company_code, so_id, line_no)
);

CREATE TABLE IF NOT EXISTS number_series (
  tenant_id uuid,
  company_code text,
  entity_type text,
  prefix text,
  current int,
  reset_policy text,
  last_reset_at date,
  reserved_ranges jsonb,
  PRIMARY KEY (tenant_id, company_code, entity_type)
);

CREATE TABLE IF NOT EXISTS audit_log (
  tenant_id uuid,
  company_code text,
  actor_user_id uuid,
  entity_type text,
  entity_id uuid,
  action text,
  timestamp timestamptz DEFAULT now(),
  ip text,
  metadata jsonb,
  before_snapshot jsonb,
  after_snapshot jsonb,
  origin text
);

CREATE TABLE IF NOT EXISTS metadata_forms (
  tenant_id uuid,
  form_id uuid PRIMARY KEY,
  name text,
  entity_type text,
  version int,
  layout jsonb,
  assigned_roles text[],
  assigned_companies text[],
  visibility_conditions jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metadata_fields (
  tenant_id uuid,
  form_id uuid,
  field_key text,
  data_type text,
  ui jsonb,
  validation_schema jsonb,
  visibility_conditions jsonb,
  defaulting_rules jsonb,
  custom boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, form_id, field_key)
);

CREATE TABLE IF NOT EXISTS workflows (
  tenant_id uuid,
  entity_type text,
  workflow_id uuid PRIMARY KEY,
  name text,
  states jsonb,
  transitions jsonb,
  guards jsonb,
  notifications jsonb,
  version int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scripts (
  tenant_id uuid,
  script_id uuid PRIMARY KEY,
  name text,
  type text,
  code_url text,
  quota_policy jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events_outbox (
  tenant_id uuid,
  company_code text,
  entity_type text,
  entity_id uuid,
  event_type text,
  payload jsonb,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

