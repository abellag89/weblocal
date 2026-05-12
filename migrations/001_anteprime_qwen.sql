-- ============================================================
-- Migration 001: Anteprime con scadenza, Qwen, modifiche cliente
-- ============================================================
-- Da eseguire una sola volta nel SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/eztpyonfjdtkaopotswz/sql
--
-- Aggiunge:
--   - Campi contenuti AI-generated (hero, descrizione)
--   - Stile scelto + timestamp scelta (per timer +24h)
--   - Toggle sezioni opzionali (menu/galleria/recensioni)
--   - Log richieste di modifica + stato
-- ============================================================

ALTER TABLE richieste
  ADD COLUMN IF NOT EXISTS hero_tagline       TEXT,
  ADD COLUMN IF NOT EXISTS hero_sottotitolo   TEXT,
  ADD COLUMN IF NOT EXISTS descrizione_breve  TEXT,
  ADD COLUMN IF NOT EXISTS descrizione_lunga  TEXT,
  ADD COLUMN IF NOT EXISTS cta_principale     TEXT,
  ADD COLUMN IF NOT EXISTS stile_scelto       TEXT,
  ADD COLUMN IF NOT EXISTS scelta_stile_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mostra_menu        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mostra_galleria    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mostra_recensioni  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS richieste_modifica JSONB,
  ADD COLUMN IF NOT EXISTS stato_modifica     TEXT,
  ADD COLUMN IF NOT EXISTS ultima_modifica_at TIMESTAMPTZ;

-- Index su scelta_stile_at per query "anteprime in fase pagamento"
CREATE INDEX IF NOT EXISTS idx_richieste_scelta_stile_at
  ON richieste (scelta_stile_at)
  WHERE scelta_stile_at IS NOT NULL;

-- Index su stato per filtri rapidi (dashboard admin)
CREATE INDEX IF NOT EXISTS idx_richieste_stato
  ON richieste (stato);

-- Vincolo: stile_scelto può essere solo uno dei 4 valori validi
ALTER TABLE richieste
  DROP CONSTRAINT IF EXISTS check_stile_scelto;
ALTER TABLE richieste
  ADD CONSTRAINT check_stile_scelto
  CHECK (stile_scelto IS NULL OR stile_scelto IN ('minimal','classico','bold','elegante'));

-- ============================================================
-- Verifica post-migration
-- Lancia: SELECT column_name, data_type, is_nullable
--         FROM information_schema.columns
--         WHERE table_name = 'richieste'
--         ORDER BY ordinal_position;
-- ============================================================
