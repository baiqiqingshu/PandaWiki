DROP TRIGGER IF EXISTS trig_node_releases_search_vector ON node_releases;
DROP FUNCTION IF EXISTS node_releases_search_vector_update();
DROP INDEX IF EXISTS idx_node_releases_search_vector;
DROP INDEX IF EXISTS idx_node_releases_name_trgm;
DROP INDEX IF EXISTS idx_node_releases_content_trgm;
ALTER TABLE node_releases DROP COLUMN IF EXISTS search_vector;
