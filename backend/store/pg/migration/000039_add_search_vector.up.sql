-- 新增 tsvector 列用于全文检索
ALTER TABLE node_releases ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 创建 GIN 索引加速检索
CREATE INDEX IF NOT EXISTS idx_node_releases_search_vector
ON node_releases USING GIN(search_vector);

-- 创建触发器函数自动更新 search_vector
CREATE OR REPLACE FUNCTION node_releases_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.meta->>'summary', '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trig_node_releases_search_vector ON node_releases;
CREATE TRIGGER trig_node_releases_search_vector
BEFORE INSERT OR UPDATE ON node_releases
FOR EACH ROW EXECUTE FUNCTION node_releases_search_vector_update();

-- 回填已有数据
UPDATE node_releases SET search_vector =
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(meta->>'summary', '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(content, '')), 'C');

-- 为 content 列创建 pg_trgm 索引优化 ILIKE 查询（如果扩展可用）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_node_releases_name_trgm ON node_releases USING GIN(name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_node_releases_content_trgm ON node_releases USING GIN(content gin_trgm_ops)';
  ELSE
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_node_releases_name_trgm ON node_releases USING GIN(name gin_trgm_ops)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_node_releases_content_trgm ON node_releases USING GIN(content gin_trgm_ops)';
    EXCEPTION WHEN OTHERS THEN
      -- pg_trgm 不可用，跳过
      NULL;
    END;
  END IF;
END $$;
