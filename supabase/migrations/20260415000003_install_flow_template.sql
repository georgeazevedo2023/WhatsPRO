-- =============================================================================
-- install_flow_template: atomic flow creation (flow + steps + triggers)
-- Creates a complete flow from a template definition in a single transaction.
-- If any part fails, the entire operation rolls back automatically.
-- =============================================================================

CREATE OR REPLACE FUNCTION install_flow_template(
  p_instance_id  TEXT,
  p_name         TEXT,
  p_slug         TEXT,
  p_description  TEXT    DEFAULT '',
  p_template_id  TEXT    DEFAULT NULL,
  p_steps        JSONB   DEFAULT '[]'::jsonb,
  p_triggers     JSONB   DEFAULT '[]'::jsonb,
  p_config       JSONB   DEFAULT '{}'::jsonb,
  p_publish      BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flow_id UUID;
  v_step    JSONB;
  v_trigger JSONB;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. Create the flow
  -- -------------------------------------------------------------------------
  INSERT INTO flows (
    instance_id,
    name,
    slug,
    description,
    template_id,
    config
  ) VALUES (
    p_instance_id,
    p_name,
    p_slug,
    p_description,
    p_template_id,
    p_config
  )
  RETURNING id INTO v_flow_id;

  -- -------------------------------------------------------------------------
  -- 2. Insert steps from the JSONB array
  -- -------------------------------------------------------------------------
  FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps)
  LOOP
    INSERT INTO flow_steps (
      flow_id,
      subagent_type,
      position,
      step_config,
      exit_rules,
      is_active
    ) VALUES (
      v_flow_id,
      v_step->>'subagent_type',
      (v_step->>'position')::INT,
      COALESCE(v_step->'step_config', '{}'::jsonb),
      COALESCE(v_step->'exit_rules', '[]'::jsonb),
      COALESCE((v_step->>'is_active')::BOOLEAN, true)
    );
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 3. Insert triggers from the JSONB array (instance_id from parent param)
  -- -------------------------------------------------------------------------
  FOR v_trigger IN SELECT * FROM jsonb_array_elements(p_triggers)
  LOOP
    INSERT INTO flow_triggers (
      flow_id,
      instance_id,
      trigger_type,
      trigger_config,
      priority,
      is_active
    ) VALUES (
      v_flow_id,
      p_instance_id,
      v_trigger->>'trigger_type',
      COALESCE(v_trigger->'trigger_config', '{}'::jsonb),
      COALESCE((v_trigger->>'priority')::INT, 0),
      COALESCE((v_trigger->>'is_active')::BOOLEAN, true)
    );
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 4. Publish the flow immediately if requested
  -- -------------------------------------------------------------------------
  IF p_publish THEN
    UPDATE flows
       SET published_at = now()
     WHERE id = v_flow_id;
  END IF;

  RETURN v_flow_id;
END;
$$;

-- Grant execute to authenticated users (edge functions use service_role,
-- but authenticated users may also call via RPC)
GRANT EXECUTE ON FUNCTION install_flow_template(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN)
  TO authenticated, service_role;
