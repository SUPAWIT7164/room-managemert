-- MSSQL tables for:
-- 1) /utilities/tenant-expenses (monthly expense summary)
-- 2) /utilities/tenant-invoice?id=1 (invoice header + editable line items)

IF OBJECT_ID(N'dbo.tenant_shops', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenant_shops (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    lock_number NVARCHAR(20) NOT NULL,
    tenant_name NVARCHAR(255) NOT NULL,
    phone NVARCHAR(50) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_tenant_shops_is_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_tenant_shops_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_tenant_shops_updated_at DEFAULT (SYSDATETIME())
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tenant_shops_lock_number' AND object_id = OBJECT_ID(N'dbo.tenant_shops'))
  CREATE UNIQUE INDEX UX_tenant_shops_lock_number ON dbo.tenant_shops(lock_number);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tenant_shops_tenant_name' AND object_id = OBJECT_ID(N'dbo.tenant_shops'))
  CREATE INDEX IX_tenant_shops_tenant_name ON dbo.tenant_shops(tenant_name);
GO

IF OBJECT_ID(N'dbo.tenant_invoices', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenant_invoices (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    tenant_shop_id INT NOT NULL,
    invoice_no NVARCHAR(50) NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    billing_month DATE NOT NULL, -- เก็บเป็นวันแรกของเดือน เช่น 2026-04-01
    address_text NVARCHAR(MAX) NULL,
    bank_name NVARCHAR(100) NULL,
    bank_branch NVARCHAR(100) NULL,
    bank_account_name NVARCHAR(255) NULL,
    bank_account_no NVARCHAR(100) NULL,
    receiver_signature_name NVARCHAR(255) NULL,
    notes NVARCHAR(MAX) NULL,
    subtotal_before_vat DECIMAL(12,2) NOT NULL CONSTRAINT DF_tenant_invoices_subtotal DEFAULT (0),
    vat_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_tenant_invoices_vat DEFAULT (0),
    grand_total DECIMAL(12,2) NOT NULL CONSTRAINT DF_tenant_invoices_grand DEFAULT (0),
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_tenant_invoices_status DEFAULT (N'draft'),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_tenant_invoices_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_tenant_invoices_updated_at DEFAULT (SYSDATETIME()),
    CONSTRAINT CK_tenant_invoices_status CHECK (status IN (N'draft', N'issued', N'paid', N'cancelled')),
    CONSTRAINT FK_tenant_invoices_shop FOREIGN KEY (tenant_shop_id) REFERENCES dbo.tenant_shops(id) ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tenant_invoices_no' AND object_id = OBJECT_ID(N'dbo.tenant_invoices'))
  CREATE UNIQUE INDEX UX_tenant_invoices_no ON dbo.tenant_invoices(invoice_no) WHERE invoice_no IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tenant_invoices_shop_month' AND object_id = OBJECT_ID(N'dbo.tenant_invoices'))
  CREATE UNIQUE INDEX UX_tenant_invoices_shop_month ON dbo.tenant_invoices(tenant_shop_id, billing_month);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tenant_invoices_dates' AND object_id = OBJECT_ID(N'dbo.tenant_invoices'))
  CREATE INDEX IX_tenant_invoices_dates ON dbo.tenant_invoices(invoice_date, due_date);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tenant_invoices_status' AND object_id = OBJECT_ID(N'dbo.tenant_invoices'))
  CREATE INDEX IX_tenant_invoices_status ON dbo.tenant_invoices(status);
GO

IF OBJECT_ID(N'dbo.tenant_invoice_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenant_invoice_items (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    tenant_invoice_id INT NOT NULL,
    line_no INT NOT NULL,
    description NVARCHAR(255) NOT NULL,
    amount_before_vat DECIMAL(12,2) NOT NULL CONSTRAINT DF_tenant_invoice_items_before DEFAULT (0),
    vat_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_tenant_invoice_items_vat DEFAULT (0),
    amount_net DECIMAL(12,2) NOT NULL CONSTRAINT DF_tenant_invoice_items_net DEFAULT (0),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_tenant_invoice_items_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_tenant_invoice_items_updated_at DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_tenant_invoice_items_invoice FOREIGN KEY (tenant_invoice_id) REFERENCES dbo.tenant_invoices(id) ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tenant_invoice_items_line_no' AND object_id = OBJECT_ID(N'dbo.tenant_invoice_items'))
  CREATE UNIQUE INDEX UX_tenant_invoice_items_line_no ON dbo.tenant_invoice_items(tenant_invoice_id, line_no);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tenant_invoice_items_invoice_id' AND object_id = OBJECT_ID(N'dbo.tenant_invoice_items'))
  CREATE INDEX IX_tenant_invoice_items_invoice_id ON dbo.tenant_invoice_items(tenant_invoice_id);
GO

