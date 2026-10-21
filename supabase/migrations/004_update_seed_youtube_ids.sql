-- ============================================================
-- OKEKARAOKE: Migration 004 — Fix Outdated YouTube Video IDs
-- Updates existing seeded songs to authentic, active YouTube Karaoke versions
-- ============================================================

UPDATE songs SET youtube_video_id = '2QcJ8lwbtsE' WHERE code = '5492' OR (title ILIKE '%Harana%' AND artist ILIKE '%Parokya%');
UPDATE songs SET youtube_video_id = 'IvIvCzMlB8Y' WHERE code = '1001' OR (title ILIKE '%Beer%' AND artist ILIKE '%Itchyworms%');
UPDATE songs SET youtube_video_id = 'm4EZrJqGXz8' WHERE code = '3001' OR (title ILIKE '%Ikaw%' AND artist ILIKE '%Yeng%');
UPDATE songs SET youtube_video_id = '8sejFUfH_eE' WHERE code = '5123' OR (title ILIKE '%Through the Years%' AND artist ILIKE '%Kenny Rogers%');
UPDATE songs SET youtube_video_id = 'm8CEEkqQiiY' WHERE code = '6001' OR (title ILIKE '%Zombie%' AND artist ILIKE '%Cranberries%');
UPDATE songs SET youtube_video_id = 'hNmgGtSTqb8' WHERE code = '7001' OR (title ILIKE '%214%' AND artist ILIKE '%Rivermaya%');
UPDATE songs SET youtube_video_id = 'OqtWMNZS-M0' WHERE code = '8001' OR (title ILIKE '%Iris%' AND artist ILIKE '%Goo Goo Dolls%');
UPDATE songs SET youtube_video_id = 'ORwuGUbzMVE' WHERE code = '9001' OR (title ILIKE '%Forever%' AND artist ILIKE '%Ben&Ben%');
UPDATE songs SET youtube_video_id = 'Y20dk5HO-0A' WHERE code = '1100' OR (title ILIKE '%Kathang Isip%' AND artist ILIKE '%Ben&Ben%');
UPDATE songs SET youtube_video_id = 'Cj4hcXZs3Lc' WHERE code = '1300' OR (title ILIKE '%Blinding Lights%' AND artist ILIKE '%Weeknd%');
UPDATE songs SET youtube_video_id = 'XpXe2mXmhp0' WHERE code = '1400' OR (title ILIKE '%Photograph%' AND artist ILIKE '%Ed Sheeran%');
UPDATE songs SET youtube_video_id = 'leP8DEWLkZc' WHERE code = '2000' OR (title ILIKE '%Liwanag sa Dilim%' AND artist ILIKE '%Rivermaya%');
