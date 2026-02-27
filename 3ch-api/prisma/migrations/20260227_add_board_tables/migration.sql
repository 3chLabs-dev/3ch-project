-- 공지사항
CREATE TABLE notices (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  content      TEXT         NOT NULL,
  is_published BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAQ
CREATE TABLE faqs (
  id            SERIAL PRIMARY KEY,
  question      VARCHAR(300) NOT NULL,
  answer        TEXT         NOT NULL,
  display_order INT          NOT NULL DEFAULT 0,
  is_published  BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
