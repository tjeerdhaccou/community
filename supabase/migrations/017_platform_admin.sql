-- Platform multi-tenant support
-- Add status and tier to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'trial'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Platform admins can read ALL organizations (for platform dashboard)
CREATE POLICY "Platform admins can read all organizations"
  ON organizations FOR SELECT USING (is_platform_admin());

-- Platform admins can manage all organizations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Platform admins can manage all orgs'
  ) THEN
    EXECUTE 'CREATE POLICY "Platform admins can manage all orgs" ON organizations FOR ALL USING (is_platform_admin())';
  END IF;
END $$;

-- Platform admins can read all org_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'org_members' AND policyname LIKE '%platform admin%read%'
  ) THEN
    EXECUTE 'CREATE POLICY "Platform admins can read all org members" ON org_members FOR SELECT USING (is_platform_admin())';
  END IF;
END $$;

-- Platform admins can manage all org_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'org_members' AND policyname LIKE '%platform admin%manage%'
  ) THEN
    EXECUTE 'CREATE POLICY "Platform admins can manage all org members" ON org_members FOR ALL USING (is_platform_admin())';
  END IF;
END $$;
