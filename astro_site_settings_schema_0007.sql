-- Editable metadata defaults layer over, but never change, sealed site revisions.
CREATE TABLE site_settings (
    locale TEXT PRIMARY KEY NOT NULL REFERENCES site_locales (code),
    site_name TEXT NOT NULL CHECK (length(site_name) <= 80 AND site_name = trim(site_name)),
    default_description TEXT NOT NULL CHECK (
        length(default_description) <= 320 AND default_description = trim(default_description)
    )
) STRICT;

CREATE VIEW public_site_metadata AS
SELECT locales.code AS locale,
       coalesce(nullif(settings.site_name, ''), nullif(trim(published.site_name), '')) AS site_name,
       coalesce(nullif(settings.default_description, ''), nullif(trim(published.default_description), '')) AS default_description
FROM site_locales locales
LEFT JOIN site_settings settings ON settings.locale = locales.code
LEFT JOIN published_site published ON published.locale = locales.code;
