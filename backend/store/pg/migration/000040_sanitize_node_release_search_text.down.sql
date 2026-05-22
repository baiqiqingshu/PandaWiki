CREATE OR REPLACE FUNCTION node_releases_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.meta->>'summary', '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE node_releases SET search_vector =
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(meta->>'summary', '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(content, '')), 'C');

DROP FUNCTION IF EXISTS node_releases_search_text(text);
