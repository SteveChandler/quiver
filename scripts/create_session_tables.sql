-- Create beaches table
CREATE TABLE beaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location POINT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for beaches
ALTER TABLE beaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Beaches are viewable by everyone" ON beaches FOR SELECT USING (true);
CREATE POLICY "Beaches are insertable by authenticated users" ON beaches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Beaches are updatable by authenticated users" ON beaches FOR UPDATE USING (auth.role() = 'authenticated');

-- Create boards table (user's quiver)
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  length NUMERIC(4,2),
  width NUMERIC(4,2),
  thickness NUMERIC(4,2),
  volume NUMERIC(6,2),
  brand TEXT,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for boards
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boards are viewable by their owner" ON boards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Boards are insertable by their owner" ON boards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Boards are updatable by their owner" ON boards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Boards are deletable by their owner" ON boards FOR DELETE USING (auth.uid() = user_id);

-- Create a composite type for session status
CREATE TYPE session_status AS ENUM ('planned', 'completed', 'cancelled');

-- Create sessions table (both planned and logged)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id UUID REFERENCES beaches(id),
  board_id UUID REFERENCES boards(id),
  beach_name TEXT, -- In case beach is not in the beaches table
  status session_status NOT NULL DEFAULT 'planned',
  session_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  duration_minutes INTEGER,
  wave_quality INTEGER CHECK (wave_quality BETWEEN 1 AND 5),
  water_temp TEXT,
  crowd_level INTEGER CHECK (crowd_level BETWEEN 1 AND 5),
  parking_ease INTEGER CHECK (parking_ease BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions are viewable by their owner" ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Sessions are insertable by their owner" ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Sessions are updatable by their owner" ON sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Sessions are deletable by their owner" ON sessions FOR DELETE USING (auth.uid() = user_id);

-- Create session_media table for photos and videos
CREATE TABLE session_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL, -- 'image' or 'video'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for session_media
ALTER TABLE session_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media is viewable by the session owner" ON session_media 
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM sessions WHERE id = session_id
    )
  );
CREATE POLICY "Media is insertable by the session owner" ON session_media 
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM sessions WHERE id = session_id
    )
  );
CREATE POLICY "Media is deletable by the session owner" ON session_media 
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM sessions WHERE id = session_id
    )
  );

-- Add indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_beach_id ON sessions(beach_id);
CREATE INDEX idx_sessions_board_id ON sessions(board_id);
CREATE INDEX idx_sessions_session_date ON sessions(session_date);
CREATE INDEX idx_session_media_session_id ON session_media(session_id);
CREATE INDEX idx_boards_user_id ON boards(user_id);

-- Create or replace function to update updated_at on update
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update the updated_at columns
CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_beaches_updated_at
BEFORE UPDATE ON beaches
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_boards_updated_at
BEFORE UPDATE ON boards
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Insert some sample beaches
INSERT INTO beaches (name, description) VALUES 
('Huntington Beach', 'Popular surf spot in Southern California'),
('Newport Beach', 'Consistent waves and good for all levels'),
('Laguna Beach', 'Beautiful scenery with various break points'); 