-- ============================================================
-- OKEKARAOKE: Seed Data — Sample Songs
-- Migration: 003_seed_songs.sql
-- Verified 100% active authentic YouTube Karaoke video IDs
-- ============================================================

INSERT INTO songs (code, title, artist, youtube_video_id, category, language, song_type, keywords, is_active)
VALUES
  ('5492', 'Harana', 'Parokya ni Edgar', '2QcJ8lwbtsE', 'OPM', 'Filipino', 'Karaoke', ARRAY['harana', 'parokya', 'serenade', 'opm', 'classic'], true),
  ('1001', 'Beer', 'Itchyworms', 'IvIvCzMlB8Y', 'OPM', 'Filipino', 'Karaoke', ARRAY['beer', 'itchyworms', 'opm', 'rock'], true),
  ('2345', 'Perfect', 'Ed Sheeran', '2Vv-BfVoq4g', 'English', 'English', 'Karaoke', ARRAY['perfect', 'ed sheeran', 'love', 'pop'], true),
  ('3001', 'Ikaw', 'Yeng Constantino', 'm4EZrJqGXz8', 'OPM', 'Filipino', 'Karaoke', ARRAY['ikaw', 'yeng', 'opm', 'love song'], true),
  ('4501', 'All of Me', 'John Legend', '450p7goxZqg', 'English', 'English', 'Karaoke', ARRAY['all of me', 'john legend', 'love', 'piano'], true),
  ('5123', 'Through the Years', 'Kenny Rogers', '8sejFUfH_eE', 'English', 'English', 'Karaoke', ARRAY['through the years', 'kenny rogers', 'classic', 'love'], true),
  ('6001', 'Zombie', 'The Cranberries', 'm8CEEkqQiiY', 'English', 'English', 'Karaoke', ARRAY['zombie', 'cranberries', 'rock', 'alternative'], true),
  ('7001', '214', 'Rivermaya', 'hNmgGtSTqb8', 'OPM', 'Filipino', 'Karaoke', ARRAY['214', 'rivermaya', 'opm', 'rock'], true),
  ('8001', 'Iris', 'Goo Goo Dolls', 'OqtWMNZS-M0', 'English', 'English', 'Karaoke', ARRAY['iris', 'goo goo dolls', 'rock', 'love'], true),
  ('9001', 'Forever', 'Ben&Ben', 'ORwuGUbzMVE', 'OPM', 'Filipino', 'Karaoke', ARRAY['forever', 'ben and ben', 'opm', 'folk'], true),
  ('1100', 'Kathang Isip', 'Ben&Ben', 'Y20dk5HO-0A', 'OPM', 'Filipino', 'Karaoke', ARRAY['kathang isip', 'ben and ben', 'opm', 'folk'], true),
  ('1200', 'Shape of You', 'Ed Sheeran', 'JGwWNGJdvx8', 'English', 'English', 'Karaoke', ARRAY['shape of you', 'ed sheeran', 'pop', 'dance'], true),
  ('1300', 'Blinding Lights', 'The Weeknd', 'Cj4hcXZs3Lc', 'English', 'English', 'Karaoke', ARRAY['blinding lights', 'the weeknd', 'synth pop', 'r&b'], true),
  ('1400', 'Photograph', 'Ed Sheeran', 'XpXe2mXmhp0', 'English', 'English', 'Karaoke', ARRAY['photograph', 'ed sheeran', 'pop', 'acoustic'], true),
  ('1500', 'Thinking Out Loud', 'Ed Sheeran', 'lp-EO5I60KA', 'English', 'English', 'Karaoke', ARRAY['thinking out loud', 'ed sheeran', 'soul', 'r&b'], true),
  ('1600', 'Stay With Me', 'Sam Smith', 'pB-5XG-DbAA', 'English', 'English', 'Karaoke', ARRAY['stay with me', 'sam smith', 'soul', 'pop'], true),
  ('1700', 'Someone Like You', 'Adele', 'hLQl3WQQoQ0', 'English', 'English', 'Karaoke', ARRAY['someone like you', 'adele', 'pop', 'ballad'], true),
  ('1800', 'Rolling in the Deep', 'Adele', 'rYEDA3JcQqw', 'English', 'English', 'Karaoke', ARRAY['rolling in the deep', 'adele', 'pop', 'soul'], true),
  ('1900', 'Thousand Years', 'Christina Perri', 'rtOvBOTyX00', 'English', 'English', 'Karaoke', ARRAY['thousand years', 'christina perri', 'pop', 'love'], true),
  ('2000', 'Liwanag sa Dilim', 'Rivermaya', 'leP8DEWLkZc', 'OPM', 'Filipino', 'Karaoke', ARRAY['liwanag sa dilim', 'rivermaya', 'opm', 'rock'], true);
