CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text NOT NULL UNIQUE,password_hash text NOT NULL,role text NOT NULL CHECK(role IN ('manager','counter','stock')),active boolean NOT NULL DEFAULT true);
CREATE TABLE sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users,csrf text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE audit_events(id bigserial PRIMARY KEY,actor uuid REFERENCES users,action text NOT NULL,record_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE settings(id int PRIMARY KEY CHECK(id=1),data jsonb NOT NULL DEFAULT '{}');
INSERT INTO settings VALUES(1,'{}');
