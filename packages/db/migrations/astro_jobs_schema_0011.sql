-- Curated X / Twitter job postings, creator sources (with opt-out blocklist),
-- and independent bilingual translations with optimistic revision locking.

CREATE TABLE job_sources (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 200),
    platform TEXT NOT NULL DEFAULT 'x' CHECK (platform IN ('x')),
    handle TEXT NOT NULL UNIQUE CHECK (
        length(handle) BETWEEN 1 AND 64
        AND handle = lower(trim(handle))
        AND handle NOT GLOB '*[^a-z0-9_]*'
    ),
    display_name TEXT NOT NULL CHECK (
        length(trim(display_name)) BETWEEN 1 AND 120
        AND display_name = trim(display_name)
    ),
    profile_url TEXT NOT NULL CHECK (
        length(profile_url) BETWEEN 1 AND 512
        AND (profile_url LIKE 'https://%' OR profile_url LIKE 'http://%')
    ),
    bio_zh TEXT NOT NULL DEFAULT '' CHECK (length(bio_zh) <= 500),
    bio_en TEXT NOT NULL DEFAULT '' CHECK (length(bio_en) <= 500),
    relationship TEXT NOT NULL DEFAULT 'public' CHECK (
        relationship IN ('public', 'partner', 'sponsored')
    ),
    opt_out INTEGER NOT NULL DEFAULT 0 CHECK (opt_out IN (0, 1)),
    opt_out_note TEXT NOT NULL DEFAULT '' CHECK (length(opt_out_note) <= 500),
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms > 0),
    updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
) STRICT;

CREATE INDEX idx_job_sources_opt_out ON job_sources (opt_out, updated_at_ms DESC);

CREATE TABLE jobs (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 200),
    source_id TEXT NOT NULL REFERENCES job_sources (id) ON DELETE RESTRICT,
    source_post_url TEXT NOT NULL UNIQUE CHECK (
        length(source_post_url) BETWEEN 1 AND 512
        AND source_post_url LIKE 'https://x.com/%/status/%'
    ),
    source_post_id TEXT NOT NULL UNIQUE CHECK (
        length(source_post_id) BETWEEN 1 AND 64
        AND source_post_id NOT GLOB '*[^0-9]*'
    ),
    source_post_published_at_ms INTEGER NOT NULL CHECK (source_post_published_at_ms > 0),
    apply_url TEXT CHECK (
        apply_url IS NULL
        OR (
            length(apply_url) BETWEEN 1 AND 2048
            AND (
                apply_url LIKE 'https://%'
                OR apply_url LIKE 'http://%'
                OR apply_url LIKE 'mailto:%'
            )
        )
    ),
    work_mode TEXT NOT NULL DEFAULT 'unspecified' CHECK (
        work_mode IN ('remote', 'hybrid', 'onsite', 'unspecified')
    ),
    employment_type TEXT NOT NULL DEFAULT 'unspecified' CHECK (
        employment_type IN (
            'full_time',
            'part_time',
            'contract',
            'internship',
            'cofounder',
            'unspecified'
        )
    ),
    location_text TEXT NOT NULL DEFAULT '' CHECK (length(location_text) <= 160),
    compensation_text TEXT NOT NULL DEFAULT '' CHECK (length(compensation_text) <= 160),
    disclosure_type TEXT NOT NULL DEFAULT 'curated_public' CHECK (
        disclosure_type IN ('curated_public', 'author_submitted', 'sponsored')
    ),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'open', 'expired', 'closed', 'removed')
    ),
    last_verified_at_ms INTEGER NOT NULL CHECK (last_verified_at_ms > 0),
    expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > 0),
    is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms > 0),
    updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
) STRICT;

CREATE INDEX idx_jobs_status_updated ON jobs (status, updated_at_ms DESC);
CREATE INDEX idx_jobs_source_id ON jobs (source_id, status);
CREATE INDEX idx_jobs_freshness ON jobs (status, last_verified_at_ms ASC, expires_at_ms ASC);

CREATE TABLE job_translations (
    job_id TEXT NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES site_locales (code),
    slug TEXT NOT NULL CHECK (
        length(slug) BETWEEN 1 AND 120
        AND slug = lower(slug)
        AND slug NOT GLOB '*[^a-z0-9-]*'
    ),
    title TEXT NOT NULL CHECK (
        length(trim(title)) BETWEEN 1 AND 200
        AND title = trim(title)
    ),
    summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 500),
    content_md TEXT NOT NULL CHECK (length(trim(content_md)) BETWEEN 1 AND 100000),
    source_excerpt TEXT NOT NULL DEFAULT '' CHECK (length(source_excerpt) <= 200),
    seo_title TEXT CHECK (seo_title IS NULL OR length(seo_title) <= 200),
    seo_description TEXT CHECK (seo_description IS NULL OR length(seo_description) <= 500),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms > 0),
    PRIMARY KEY (job_id, locale),
    UNIQUE (locale, slug)
) STRICT;

CREATE INDEX idx_job_translations_locale_updated ON job_translations (locale, updated_at_ms DESC);
