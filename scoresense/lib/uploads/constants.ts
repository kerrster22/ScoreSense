/** Kept in sync by hand with the piece_uploads_enforce_cap trigger in
 *  supabase/migrations/0003_piece_uploads.sql — SQL can't import a TS constant. */
export const MAX_UPLOADS_PER_USER = 25

export const UPLOAD_BUCKET = "piece-uploads"

export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024
