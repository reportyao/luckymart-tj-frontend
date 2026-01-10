-- Fix inventory_product_id field in lotteries table
-- Some records may have SKU instead of UUID

-- First, let's check if there are any invalid UUIDs in inventory_product_id
-- If inventory_product_id is not a valid UUID, try to find the correct UUID by SKU

-- Add a temporary column to store SKU if needed
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS inventory_product_sku TEXT;

-- Update inventory_product_sku for records that have a SKU in inventory_product_id
-- Cast UUID to TEXT for regex matching
UPDATE lotteries
SET inventory_product_sku = inventory_product_id::TEXT
WHERE inventory_product_id IS NOT NULL
  AND inventory_product_id::TEXT !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Now update inventory_product_id with the correct UUID from inventory_products table
UPDATE lotteries l
SET inventory_product_id = ip.id
FROM inventory_products ip
WHERE l.inventory_product_sku IS NOT NULL
  AND ip.sku = l.inventory_product_sku;

-- Clean up: remove the temporary column if no longer needed
-- (Keep it for now in case we need to reference SKUs)

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_lotteries_inventory_product_sku ON lotteries(inventory_product_sku);

COMMENT ON COLUMN lotteries.inventory_product_sku IS 'SKU reference for inventory product (for reference only, use inventory_product_id for foreign key)';
