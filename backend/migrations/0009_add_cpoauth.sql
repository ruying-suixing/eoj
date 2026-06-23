-- Migration 0009: Add CP OAuth support
ALTER TABLE users ADD COLUMN cpoauth_id TEXT UNIQUE;
