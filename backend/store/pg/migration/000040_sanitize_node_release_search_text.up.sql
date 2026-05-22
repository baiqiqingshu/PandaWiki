CREATE OR REPLACE FUNCTION node_releases_search_text(raw_content text) RETURNS text AS $$
BEGIN
  RETURN btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                COALESCE(raw_content, ''),
                '<img[^>]*>',
                ' ',
                'gi'
              ),
              '!\[[^\]]*\]\([^)]*\)',
              ' ',
              'g'
            ),
            'data:image/[^[:space:]''")>]+',
            ' ',
            'gi'
          ),
          'https?://[^[:space:]''")<]+',
          ' ',
          'gi'
        ),
        '<[^>]+>',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION node_releases_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.meta->>'summary', '')), 'B') ||
    setweight(to_tsvector('simple', node_releases_search_text(NEW.content)), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE node_releases SET search_vector =
  setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(meta->>'summary', '')), 'B') ||
  setweight(to_tsvector('simple', node_releases_search_text(content)), 'C');
