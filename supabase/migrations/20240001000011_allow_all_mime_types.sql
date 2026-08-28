-- ============================================================
-- Migration: 20240001000011_allow_all_mime_types.sql
-- Purpose: Remove restricted allowed_mime_types on task-files bucket
--          to allow uploading all file types (DOCX, XLSX, PNG, PDF, etc.)
-- ============================================================

update storage.buckets
set allowed_mime_types = null
where id = 'task-files';
