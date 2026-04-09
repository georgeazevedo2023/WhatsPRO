export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_profiles: {
        Row: {
          agent_id: string
          created_at: string | null
          enabled: boolean | null
          handoff_department_id: string | null
          handoff_max_messages: number | null
          handoff_message: string | null
          handoff_rule: string | null
          id: string
          is_default: boolean | null
          name: string
          position: number | null
          prompt: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          enabled?: boolean | null
          handoff_department_id?: string | null
          handoff_max_messages?: number | null
          handoff_message?: string | null
          handoff_rule?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          position?: number | null
          prompt?: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          enabled?: boolean | null
          handoff_department_id?: string | null
          handoff_max_messages?: number | null
          handoff_message?: string | null
          handoff_rule?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          position?: number | null
          prompt?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_profiles_handoff_department_id_fkey"
            columns: ["handoff_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_knowledge: {
        Row: {
          agent_id: string
          content: string | null
          created_at: string
          id: string
          media_url: string | null
          metadata: Json | null
          position: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          metadata?: Json | null
          position?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          metadata?: Json | null
          position?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_logs: {
        Row: {
          agent_id: string
          conversation_id: string | null
          created_at: string
          error: string | null
          event: string
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json | null
          model: string | null
          output_tokens: number | null
          sub_agent: string | null
          tool_calls: Json | null
        }
        Insert: {
          agent_id: string
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          sub_agent?: string | null
          tool_calls?: Json | null
        }
        Update: {
          agent_id?: string
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          sub_agent?: string | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_media: {
        Row: {
          agent_id: string
          created_at: string
          description: string | null
          id: string
          media_type: string
          media_url: string
          position: number
          tags: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string
          media_url: string
          position?: number
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string
          media_url?: string
          position?: number
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_media_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_products: {
        Row: {
          agent_id: string
          category: string | null
          created_at: string
          currency: string
          description: string | null
          enabled: boolean
          id: string
          images: string[] | null
          in_stock: boolean
          metadata: Json | null
          position: number
          price: number | null
          sku: string | null
          subcategory: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          enabled?: boolean
          id?: string
          images?: string[] | null
          in_stock?: boolean
          metadata?: Json | null
          position?: number
          price?: number | null
          sku?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          enabled?: boolean
          id?: string
          images?: string[] | null
          in_stock?: boolean
          metadata?: Json | null
          position?: number
          price?: number | null
          sku?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_products_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_validations: {
        Row: {
          agent_id: string
          block_action: string | null
          bonuses: Json | null
          conversation_id: string
          created_at: string | null
          id: string
          latency_ms: number | null
          model: string | null
          original_text: string
          rewritten_text: string | null
          score: number
          suggestion: string | null
          verdict: string
          violations: Json | null
        }
        Insert: {
          agent_id: string
          block_action?: string | null
          bonuses?: Json | null
          conversation_id: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          original_text: string
          rewritten_text?: string | null
          score: number
          suggestion?: string | null
          verdict: string
          violations?: Json | null
        }
        Update: {
          agent_id?: string
          block_action?: string | null
          bonuses?: Json | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          original_text?: string
          rewritten_text?: string | null
          score?: number
          suggestion?: string | null
          verdict?: string
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_validations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_validations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          blocked_numbers: string[] | null
          blocked_phrases: string[] | null
          blocked_topics: string[] | null
          business_hours: Json | null
          business_info: Json | null
          carousel_button_1: string | null
          carousel_button_2: string | null
          carousel_text: string | null
          context_long_enabled: boolean
          context_short_messages: number
          created_at: string
          debounce_seconds: number
          enabled: boolean
          extraction_address_enabled: boolean | null
          extraction_fields: Json | null
          follow_up_enabled: boolean | null
          follow_up_rules: Json | null
          greeting_message: string
          handoff_cooldown_minutes: number
          handoff_max_conversation_minutes: number
          handoff_message: string | null
          handoff_message_outside_hours: string | null
          handoff_negative_sentiment: boolean
          handoff_triggers: string[] | null
          id: string
          instance_id: string
          max_discount_percent: number | null
          max_enrichment_questions: number
          max_pre_search_questions: number
          max_qualification_retries: number
          max_tokens: number
          model: string
          name: string
          openai_api_key: string | null
          out_of_hours_message: string | null
          personality: string | null
          poll_nps_delay_minutes: number | null
          poll_nps_enabled: boolean | null
          poll_nps_notify_on_bad: boolean | null
          poll_nps_options: Json | null
          poll_nps_question: string | null
          prompt_sections: Json | null
          returning_greeting_message: string | null
          sub_agents: Json | null
          system_prompt: string | null
          temperature: number
          tts_fallback_providers: Json | null
          updated_at: string
          validator_enabled: boolean | null
          validator_model: string | null
          validator_rigor: string | null
          voice_enabled: boolean
          voice_max_text_length: number
          voice_name: string | null
          voice_reply_to_audio: boolean | null
        }
        Insert: {
          blocked_numbers?: string[] | null
          blocked_phrases?: string[] | null
          blocked_topics?: string[] | null
          business_hours?: Json | null
          business_info?: Json | null
          carousel_button_1?: string | null
          carousel_button_2?: string | null
          carousel_text?: string | null
          context_long_enabled?: boolean
          context_short_messages?: number
          created_at?: string
          debounce_seconds?: number
          enabled?: boolean
          extraction_address_enabled?: boolean | null
          extraction_fields?: Json | null
          follow_up_enabled?: boolean | null
          follow_up_rules?: Json | null
          greeting_message?: string
          handoff_cooldown_minutes?: number
          handoff_max_conversation_minutes?: number
          handoff_message?: string | null
          handoff_message_outside_hours?: string | null
          handoff_negative_sentiment?: boolean
          handoff_triggers?: string[] | null
          id?: string
          instance_id: string
          max_discount_percent?: number | null
          max_enrichment_questions?: number
          max_pre_search_questions?: number
          max_qualification_retries?: number
          max_tokens?: number
          model?: string
          name?: string
          openai_api_key?: string | null
          out_of_hours_message?: string | null
          personality?: string | null
          poll_nps_delay_minutes?: number | null
          poll_nps_enabled?: boolean | null
          poll_nps_notify_on_bad?: boolean | null
          poll_nps_options?: Json | null
          poll_nps_question?: string | null
          prompt_sections?: Json | null
          returning_greeting_message?: string | null
          sub_agents?: Json | null
          system_prompt?: string | null
          temperature?: number
          tts_fallback_providers?: Json | null
          updated_at?: string
          validator_enabled?: boolean | null
          validator_model?: string | null
          validator_rigor?: string | null
          voice_enabled?: boolean
          voice_max_text_length?: number
          voice_name?: string | null
          voice_reply_to_audio?: boolean | null
        }
        Update: {
          blocked_numbers?: string[] | null
          blocked_phrases?: string[] | null
          blocked_topics?: string[] | null
          business_hours?: Json | null
          business_info?: Json | null
          carousel_button_1?: string | null
          carousel_button_2?: string | null
          carousel_text?: string | null
          context_long_enabled?: boolean
          context_short_messages?: number
          created_at?: string
          debounce_seconds?: number
          enabled?: boolean
          extraction_address_enabled?: boolean | null
          extraction_fields?: Json | null
          follow_up_enabled?: boolean | null
          follow_up_rules?: Json | null
          greeting_message?: string
          handoff_cooldown_minutes?: number
          handoff_max_conversation_minutes?: number
          handoff_message?: string | null
          handoff_message_outside_hours?: string | null
          handoff_negative_sentiment?: boolean
          handoff_triggers?: string[] | null
          id?: string
          instance_id?: string
          max_discount_percent?: number | null
          max_enrichment_questions?: number
          max_pre_search_questions?: number
          max_qualification_retries?: number
          max_tokens?: number
          model?: string
          name?: string
          openai_api_key?: string | null
          out_of_hours_message?: string | null
          personality?: string | null
          poll_nps_delay_minutes?: number | null
          poll_nps_enabled?: boolean | null
          poll_nps_notify_on_bad?: boolean | null
          poll_nps_options?: Json | null
          poll_nps_question?: string | null
          prompt_sections?: Json | null
          returning_greeting_message?: string | null
          sub_agents?: Json | null
          system_prompt?: string | null
          temperature?: number
          tts_fallback_providers?: Json | null
          updated_at?: string
          validator_enabled?: boolean | null
          validator_model?: string | null
          validator_rigor?: string | null
          voice_enabled?: boolean
          voice_max_text_length?: number
          voice_name?: string | null
          voice_reply_to_audio?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_debounce_queue: {
        Row: {
          conversation_id: string
          created_at: string
          first_message_at: string
          id: string
          instance_id: string
          messages: Json
          process_after: string
          processed: boolean
        }
        Insert: {
          conversation_id: string
          created_at?: string
          first_message_at?: string
          id?: string
          instance_id: string
          messages?: Json
          process_after?: string
          processed?: boolean
        }
        Update: {
          conversation_id?: string
          created_at?: string
          first_message_at?: string
          id?: string
          instance_id?: string
          messages?: Json
          process_after?: string
          processed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_debounce_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_debounce_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          condition_config: Json | null
          condition_type: string | null
          created_at: string | null
          enabled: boolean | null
          funnel_id: string
          id: string
          name: string
          position: number | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string | null
          enabled?: boolean | null
          funnel_id: string
          id?: string
          name: string
          position?: number | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string | null
          enabled?: boolean | null
          funnel_id?: string
          id?: string
          name?: string
          position?: number | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      bio_buttons: {
        Row: {
          bio_page_id: string
          catalog_product_id: string | null
          click_count: number
          created_at: string
          ends_at: string | null
          featured_image_url: string | null
          form_slug: string | null
          id: string
          label: string
          layout: string
          phone: string | null
          position: number
          pre_message: string | null
          social_platform: string | null
          starts_at: string | null
          thumbnail_url: string | null
          type: string
          url: string | null
          whatsapp_tag: string | null
        }
        Insert: {
          bio_page_id: string
          catalog_product_id?: string | null
          click_count?: number
          created_at?: string
          ends_at?: string | null
          featured_image_url?: string | null
          form_slug?: string | null
          id?: string
          label: string
          layout?: string
          phone?: string | null
          position?: number
          pre_message?: string | null
          social_platform?: string | null
          starts_at?: string | null
          thumbnail_url?: string | null
          type?: string
          url?: string | null
          whatsapp_tag?: string | null
        }
        Update: {
          bio_page_id?: string
          catalog_product_id?: string | null
          click_count?: number
          created_at?: string
          ends_at?: string | null
          featured_image_url?: string | null
          form_slug?: string | null
          id?: string
          label?: string
          layout?: string
          phone?: string | null
          position?: number
          pre_message?: string | null
          social_platform?: string | null
          starts_at?: string | null
          thumbnail_url?: string | null
          type?: string
          url?: string | null
          whatsapp_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bio_buttons_bio_page_id_fkey"
            columns: ["bio_page_id"]
            isOneToOne: false
            referencedRelation: "bio_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bio_buttons_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_products"
            referencedColumns: ["id"]
          },
        ]
      }
      bio_lead_captures: {
        Row: {
          bio_button_id: string | null
          bio_page_id: string
          created_at: string
          email: string | null
          extra_data: Json | null
          id: string
          name: string | null
          phone: string | null
        }
        Insert: {
          bio_button_id?: string | null
          bio_page_id: string
          created_at?: string
          email?: string | null
          extra_data?: Json | null
          id?: string
          name?: string | null
          phone?: string | null
        }
        Update: {
          bio_button_id?: string | null
          bio_page_id?: string
          created_at?: string
          email?: string | null
          extra_data?: Json | null
          id?: string
          name?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bio_lead_captures_bio_button_id_fkey"
            columns: ["bio_button_id"]
            isOneToOne: false
            referencedRelation: "bio_buttons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bio_lead_captures_bio_page_id_fkey"
            columns: ["bio_page_id"]
            isOneToOne: false
            referencedRelation: "bio_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      bio_pages: {
        Row: {
          ai_context_enabled: boolean
          ai_context_template: string | null
          avatar_url: string | null
          bg_color: string
          bg_gradient_to: string | null
          bg_type: string
          button_color: string
          button_radius: string
          button_spacing: string
          button_style: string
          capture_button_label: string
          capture_enabled: boolean
          capture_fields: Json
          capture_title: string
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          font_family: string
          id: string
          instance_id: string
          slug: string
          status: string
          template: string
          text_color: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          ai_context_enabled?: boolean
          ai_context_template?: string | null
          avatar_url?: string | null
          bg_color?: string
          bg_gradient_to?: string | null
          bg_type?: string
          button_color?: string
          button_radius?: string
          button_spacing?: string
          button_style?: string
          capture_button_label?: string
          capture_enabled?: boolean
          capture_fields?: Json
          capture_title?: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          font_family?: string
          id?: string
          instance_id: string
          slug: string
          status?: string
          template?: string
          text_color?: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          ai_context_enabled?: boolean
          ai_context_template?: string | null
          avatar_url?: string | null
          bg_color?: string
          bg_gradient_to?: string | null
          bg_type?: string
          button_color?: string
          button_radius?: string
          button_spacing?: string
          button_style?: string
          capture_button_label?: string
          capture_enabled?: boolean
          capture_fields?: Json
          capture_title?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          font_family?: string
          id?: string
          instance_id?: string
          slug?: string
          status?: string
          template?: string
          text_color?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "bio_pages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_logs: {
        Row: {
          carousel_data: Json | null
          completed_at: string | null
          content: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          exclude_admins: boolean
          group_names: string[] | null
          groups_targeted: number
          id: string
          instance_id: string
          instance_name: string | null
          media_url: string | null
          message_type: string
          random_delay: string | null
          recipients_failed: number
          recipients_success: number
          recipients_targeted: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          carousel_data?: Json | null
          completed_at?: string | null
          content?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          exclude_admins?: boolean
          group_names?: string[] | null
          groups_targeted?: number
          id?: string
          instance_id: string
          instance_name?: string | null
          media_url?: string | null
          message_type?: string
          random_delay?: string | null
          recipients_failed?: number
          recipients_success?: number
          recipients_targeted?: number
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          carousel_data?: Json | null
          completed_at?: string | null
          content?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          exclude_admins?: boolean
          group_names?: string[] | null
          groups_targeted?: number
          id?: string
          instance_id?: string
          instance_name?: string | null
          media_url?: string | null
          message_type?: string
          random_delay?: string | null
          recipients_failed?: number
          recipients_success?: number
          recipients_targeted?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          ia_blocked_instances: string[] | null
          id: string
          jid: string
          name: string | null
          phone: string
          profile_pic_url: string | null
        }
        Insert: {
          created_at?: string
          ia_blocked_instances?: string[] | null
          id?: string
          jid: string
          name?: string | null
          phone: string
          profile_pic_url?: string | null
        }
        Update: {
          created_at?: string
          ia_blocked_instances?: string[] | null
          id?: string
          jid?: string
          name?: string | null
          phone?: string
          profile_pic_url?: string | null
        }
        Relationships: []
      }
      conversation_labels: {
        Row: {
          conversation_id: string
          id: string
          label_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          label_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_labels_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          media_type: string
          media_url: string | null
          sender_id: string | null
          transcription: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          sender_id?: string | null
          transcription?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          sender_id?: string | null
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_summary: Json | null
          ai_summary_expires_at: string | null
          archived: boolean
          assigned_to: string | null
          contact_id: string
          created_at: string
          department_id: string | null
          id: string
          inbox_id: string
          is_read: boolean
          last_message: string | null
          last_message_at: string | null
          lead_msg_count: number
          priority: string
          status: string
          status_ia: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          ai_summary?: Json | null
          ai_summary_expires_at?: string | null
          archived?: boolean
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          inbox_id: string
          is_read?: boolean
          last_message?: string | null
          last_message_at?: string | null
          lead_msg_count?: number
          priority?: string
          status?: string
          status_ia?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_summary?: Json | null
          ai_summary_expires_at?: string | null
          archived?: boolean
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          inbox_id?: string
          is_read?: boolean
          last_message?: string | null
          last_message_at?: string | null
          lead_msg_count?: number
          priority?: string
          status?: string
          status_ia?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      department_members: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          inbox_id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          inbox_id: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          inbox_id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      e2e_test_batches: {
        Row: {
          agent_id: string
          batch_id: string
          completed_at: string | null
          composite_score: number | null
          created_by: string | null
          failed: number
          id: string
          metadata: Json | null
          passed: number
          run_type: string
          started_at: string
          status: string
          total: number
        }
        Insert: {
          agent_id: string
          batch_id: string
          completed_at?: string | null
          composite_score?: number | null
          created_by?: string | null
          failed?: number
          id?: string
          metadata?: Json | null
          passed?: number
          run_type?: string
          started_at?: string
          status?: string
          total?: number
        }
        Update: {
          agent_id?: string
          batch_id?: string
          completed_at?: string | null
          composite_score?: number | null
          created_by?: string | null
          failed?: number
          id?: string
          metadata?: Json | null
          passed?: number
          run_type?: string
          started_at?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "e2e_test_batches_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      e2e_test_runs: {
        Row: {
          agent_id: string
          approval: string | null
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          batch_uuid: string | null
          category: string | null
          created_at: string
          error: string | null
          id: string
          instance_id: string
          latency_ms: number | null
          passed: boolean
          prompt_hash: string | null
          results: Json
          reviewer_notes: string | null
          run_type: string
          scenario_id: string
          scenario_name: string
          skip_reason: string | null
          skipped: boolean
          test_number: string
          tools_missing: string[] | null
          tools_used: string[] | null
          total_steps: number
        }
        Insert: {
          agent_id: string
          approval?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          batch_uuid?: string | null
          category?: string | null
          created_at?: string
          error?: string | null
          id?: string
          instance_id: string
          latency_ms?: number | null
          passed: boolean
          prompt_hash?: string | null
          results?: Json
          reviewer_notes?: string | null
          run_type?: string
          scenario_id: string
          scenario_name: string
          skip_reason?: string | null
          skipped?: boolean
          test_number: string
          tools_missing?: string[] | null
          tools_used?: string[] | null
          total_steps: number
        }
        Update: {
          agent_id?: string
          approval?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          batch_uuid?: string | null
          category?: string | null
          created_at?: string
          error?: string | null
          id?: string
          instance_id?: string
          latency_ms?: number | null
          passed?: boolean
          prompt_hash?: string | null
          results?: Json
          reviewer_notes?: string | null
          run_type?: string
          scenario_id?: string
          scenario_name?: string
          skip_reason?: string | null
          skipped?: boolean
          test_number?: string
          tools_missing?: string[] | null
          tools_used?: string[] | null
          total_steps?: number
        }
        Relationships: [
          {
            foreignKeyName: "e2e_test_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e2e_test_runs_batch_uuid_fkey"
            columns: ["batch_uuid"]
            isOneToOne: false
            referencedRelation: "e2e_test_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_executions: {
        Row: {
          agent_id: string | null
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          error: string | null
          id: string
          instance_id: string | null
          message_sent: string | null
          replied_at: string | null
          sent_at: string | null
          status: string | null
          step: number
        }
        Insert: {
          agent_id?: string | null
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          instance_id?: string | null
          message_sent?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string | null
          step?: number
        }
        Update: {
          agent_id?: string | null
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          instance_id?: string | null
          message_sent?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string | null
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_executions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          error_message: string | null
          field_key: string
          field_type: string
          form_id: string
          id: string
          label: string
          position: number
          required: boolean
          skip_if_known: boolean
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          field_key: string
          field_type: string
          form_id: string
          id?: string
          label: string
          position: number
          required?: boolean
          skip_if_known?: boolean
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          field_key?: string
          field_type?: string
          form_id?: string
          id?: string
          label?: string
          position?: number
          required?: boolean
          skip_if_known?: boolean
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_sessions: {
        Row: {
          collected_data: Json
          completed_at: string | null
          contact_id: string | null
          conversation_id: string
          current_field_index: number
          form_id: string
          id: string
          last_activity_at: string
          retries: number
          started_at: string
          status: string
        }
        Insert: {
          collected_data?: Json
          completed_at?: string | null
          contact_id?: string | null
          conversation_id: string
          current_field_index?: number
          form_id: string
          id?: string
          last_activity_at?: string
          retries?: number
          started_at?: string
          status?: string
        }
        Update: {
          collected_data?: Json
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string
          current_field_index?: number
          form_id?: string
          id?: string
          last_activity_at?: string
          retries?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_sessions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          contact_id: string | null
          data: Json
          form_id: string
          id: string
          session_id: string | null
          submitted_at: string
        }
        Insert: {
          contact_id?: string | null
          data?: Json
          form_id: string
          id?: string
          session_id?: string | null
          submitted_at?: string
        }
        Update: {
          contact_id?: string | null
          data?: Json
          form_id?: string
          id?: string
          session_id?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "form_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          ai_custom_text: string | null
          ai_template: string | null
          bio_page_id: string | null
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          form_id: string | null
          funnel_prompt: string | null
          handoff_department: string | null
          handoff_department_id: string | null
          handoff_max_messages: number | null
          handoff_message: string | null
          handoff_message_outside_hours: string | null
          handoff_rule: string | null
          icon: string | null
          id: string
          instance_id: string
          kanban_board_id: string | null
          max_messages_before_handoff: number | null
          name: string
          profile_id: string | null
          settings: Json | null
          slug: string
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          ai_custom_text?: string | null
          ai_template?: string | null
          bio_page_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          form_id?: string | null
          funnel_prompt?: string | null
          handoff_department?: string | null
          handoff_department_id?: string | null
          handoff_max_messages?: number | null
          handoff_message?: string | null
          handoff_message_outside_hours?: string | null
          handoff_rule?: string | null
          icon?: string | null
          id?: string
          instance_id: string
          kanban_board_id?: string | null
          max_messages_before_handoff?: number | null
          name: string
          profile_id?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          ai_custom_text?: string | null
          ai_template?: string | null
          bio_page_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          form_id?: string | null
          funnel_prompt?: string | null
          handoff_department?: string | null
          handoff_department_id?: string | null
          handoff_max_messages?: number | null
          handoff_message?: string | null
          handoff_message_outside_hours?: string | null
          handoff_rule?: string | null
          icon?: string | null
          id?: string
          instance_id?: string
          kanban_board_id?: string | null
          max_messages_before_handoff?: number | null
          name?: string
          profile_id?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnels_bio_page_id_fkey"
            columns: ["bio_page_id"]
            isOneToOne: false
            referencedRelation: "bio_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "utm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_handoff_department_id_fkey"
            columns: ["handoff_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_kanban_board_id_fkey"
            columns: ["kanban_board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_users: {
        Row: {
          created_at: string
          id: string
          inbox_id: string
          is_available: boolean
          role: Database["public"]["Enums"]["inbox_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inbox_id: string
          is_available?: boolean
          role?: Database["public"]["Enums"]["inbox_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inbox_id?: string
          is_available?: boolean
          role?: Database["public"]["Enums"]["inbox_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_users_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      inboxes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          instance_id: string | null
          name: string
          webhook_outgoing_url: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          instance_id?: string | null
          name: string
          webhook_outgoing_url?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          instance_id?: string | null
          name?: string
          webhook_outgoing_url?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inboxes_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_connection_logs: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          instance_id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          instance_id: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          instance_id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_connection_instance"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          created_at: string
          disabled: boolean
          id: string
          name: string
          owner_jid: string | null
          profile_pic_url: string | null
          status: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          id: string
          name: string
          owner_jid?: string | null
          profile_pic_url?: string | null
          status?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled?: boolean
          id?: string
          name?: string
          owner_jid?: string | null
          profile_pic_url?: string | null
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          job_type: string
          max_attempts: number
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      kanban_board_members: {
        Row: {
          board_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_boards: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          inbox_id: string | null
          instance_id: string | null
          name: string
          updated_at: string
          visibility: Database["public"]["Enums"]["kanban_visibility"]
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          inbox_id?: string | null
          instance_id?: string | null
          name: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["kanban_visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          inbox_id?: string | null
          instance_id?: string | null
          name?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["kanban_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "kanban_boards_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_boards_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_data: {
        Row: {
          card_id: string
          created_at: string
          field_id: string
          id: string
          value: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          field_id: string
          id?: string
          value?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          field_id?: string
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_data_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_data_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "kanban_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          assigned_to: string | null
          board_id: string
          column_id: string
          contact_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          position: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          board_id: string
          column_id: string
          contact_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          position?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          board_id?: string
          column_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          position?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          automation_enabled: boolean
          automation_message: string | null
          board_id: string
          color: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          automation_enabled?: boolean
          automation_message?: string | null
          board_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          automation_enabled?: boolean
          automation_message?: string | null
          board_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_entities: {
        Row: {
          board_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "kanban_entities_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_entity_values: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          label: string
          position: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          label: string
          position?: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "kanban_entity_values_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "kanban_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_fields: {
        Row: {
          board_id: string
          created_at: string
          entity_id: string | null
          field_type: Database["public"]["Enums"]["kanban_field_type"]
          id: string
          is_primary: boolean
          name: string
          options: Json | null
          position: number
          required: boolean
          show_on_card: boolean
        }
        Insert: {
          board_id: string
          created_at?: string
          entity_id?: string | null
          field_type?: Database["public"]["Enums"]["kanban_field_type"]
          id?: string
          is_primary?: boolean
          name: string
          options?: Json | null
          position?: number
          required?: boolean
          show_on_card?: boolean
        }
        Update: {
          board_id?: string
          created_at?: string
          entity_id?: string | null
          field_type?: Database["public"]["Enums"]["kanban_field_type"]
          id?: string
          is_primary?: boolean
          name?: string
          options?: Json | null
          position?: number
          required?: boolean
          show_on_card?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kanban_fields_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_fields_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "kanban_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          inbox_id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          inbox_id: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          inbox_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_database_entries: {
        Row: {
          created_at: string | null
          database_id: string
          group_name: string | null
          id: string
          is_verified: boolean | null
          jid: string
          name: string | null
          phone: string
          source: string | null
          verification_status: string | null
          verified_name: string | null
        }
        Insert: {
          created_at?: string | null
          database_id: string
          group_name?: string | null
          id?: string
          is_verified?: boolean | null
          jid: string
          name?: string | null
          phone: string
          source?: string | null
          verification_status?: string | null
          verified_name?: string | null
        }
        Update: {
          created_at?: string | null
          database_id?: string
          group_name?: string | null
          id?: string
          is_verified?: boolean | null
          jid?: string
          name?: string | null
          phone?: string
          source?: string | null
          verification_status?: string | null
          verified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_database_entries_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "lead_databases"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_databases: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          instance_id: string | null
          leads_count: number | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          leads_count?: number | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          leads_count?: number | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lead_profiles: {
        Row: {
          address: Json | null
          average_ticket: number | null
          birth_date: string | null
          city: string | null
          company: string | null
          contact_id: string
          conversation_summaries: Json | null
          cpf: string | null
          created_at: string
          custom_fields: Json | null
          document: string | null
          email: string | null
          first_contact_at: string | null
          full_name: string | null
          id: string
          interests: string[] | null
          last_contact_at: string | null
          last_purchase: string | null
          metadata: Json | null
          notes: string | null
          objections: string[] | null
          origin: string | null
          reason: string | null
          role: string | null
          sentiment_history: Json | null
          state: string | null
          tags: Json | null
          total_interactions: number
          updated_at: string
        }
        Insert: {
          address?: Json | null
          average_ticket?: number | null
          birth_date?: string | null
          city?: string | null
          company?: string | null
          contact_id: string
          conversation_summaries?: Json | null
          cpf?: string | null
          created_at?: string
          custom_fields?: Json | null
          document?: string | null
          email?: string | null
          first_contact_at?: string | null
          full_name?: string | null
          id?: string
          interests?: string[] | null
          last_contact_at?: string | null
          last_purchase?: string | null
          metadata?: Json | null
          notes?: string | null
          objections?: string[] | null
          origin?: string | null
          reason?: string | null
          role?: string | null
          sentiment_history?: Json | null
          state?: string | null
          tags?: Json | null
          total_interactions?: number
          updated_at?: string
        }
        Update: {
          address?: Json | null
          average_ticket?: number | null
          birth_date?: string | null
          city?: string | null
          company?: string | null
          contact_id?: string
          conversation_summaries?: Json | null
          cpf?: string | null
          created_at?: string
          custom_fields?: Json | null
          document?: string | null
          email?: string | null
          first_contact_at?: string | null
          full_name?: string | null
          id?: string
          interests?: string[] | null
          last_contact_at?: string | null
          last_purchase?: string | null
          metadata?: Json | null
          notes?: string | null
          objections?: string[] | null
          origin?: string | null
          reason?: string | null
          role?: string | null
          sentiment_history?: Json | null
          state?: string | null
          tags?: Json | null
          total_interactions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_profiles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          carousel_data: Json | null
          category: string | null
          content: string | null
          created_at: string
          filename: string | null
          id: string
          media_url: string | null
          message_type: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carousel_data?: Json | null
          category?: string | null
          content?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carousel_data?: Json | null
          category?: string | null
          content?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      playground_evaluations: {
        Row: {
          agent_id: string | null
          assistant_message: string | null
          created_at: string
          evaluated_by: string | null
          id: string
          latency_ms: number | null
          message_index: number
          note: string | null
          rating: string | null
          session_id: string
          tokens_used: number | null
          tool_calls: Json | null
          user_message: string | null
        }
        Insert: {
          agent_id?: string | null
          assistant_message?: string | null
          created_at?: string
          evaluated_by?: string | null
          id?: string
          latency_ms?: number | null
          message_index: number
          note?: string | null
          rating?: string | null
          session_id: string
          tokens_used?: number | null
          tool_calls?: Json | null
          user_message?: string | null
        }
        Update: {
          agent_id?: string | null
          assistant_message?: string | null
          created_at?: string
          evaluated_by?: string | null
          id?: string
          latency_ms?: number | null
          message_index?: number
          note?: string | null
          rating?: string | null
          session_id?: string
          tokens_used?: number | null
          tool_calls?: Json | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playground_evaluations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      playground_test_suites: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expected_contains: string[] | null
          expected_tool_calls: string[] | null
          id: string
          messages: Json
          must_not_contain: string[] | null
          name: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_contains?: string[] | null
          expected_tool_calls?: string[] | null
          id?: string
          messages?: Json
          must_not_contain?: string[] | null
          name: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_contains?: string[] | null
          expected_tool_calls?: string[] | null
          id?: string
          messages?: Json
          must_not_contain?: string[] | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playground_test_suites_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_messages: {
        Row: {
          auto_tags: Json | null
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          funnel_id: string | null
          id: string
          image_url: string | null
          instance_id: string
          is_nps: boolean | null
          message_id: string | null
          options: string[]
          question: string
          selectable_count: number
        }
        Insert: {
          auto_tags?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          funnel_id?: string | null
          id?: string
          image_url?: string | null
          instance_id: string
          is_nps?: boolean | null
          message_id?: string | null
          options: string[]
          question: string
          selectable_count?: number
        }
        Update: {
          auto_tags?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          funnel_id?: string | null
          id?: string
          image_url?: string | null
          instance_id?: string
          is_nps?: boolean | null
          message_id?: string | null
          options?: string[]
          question?: string
          selectable_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_messages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          contact_id: string | null
          id: string
          poll_message_id: string
          selected_options: string[]
          voted_at: string | null
          voter_jid: string
        }
        Insert: {
          contact_id?: string | null
          id?: string
          poll_message_id: string
          selected_options: string[]
          voted_at?: string | null
          voter_jid: string
        }
        Update: {
          contact_id?: string | null
          id?: string
          poll_message_id?: string
          selected_options?: string[]
          voted_at?: string | null
          voter_jid?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_poll_message_id_fkey"
            columns: ["poll_message_id"]
            isOneToOne: false
            referencedRelation: "poll_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_message_logs: {
        Row: {
          error_message: string | null
          executed_at: string
          id: string
          recipients_failed: number | null
          recipients_success: number | null
          recipients_total: number | null
          response_data: Json | null
          scheduled_message_id: string
          status: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string
          id?: string
          recipients_failed?: number | null
          recipients_success?: number | null
          recipients_total?: number | null
          response_data?: Json | null
          scheduled_message_id: string
          status: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string
          id?: string
          recipients_failed?: number | null
          recipients_success?: number | null
          recipients_total?: number | null
          response_data?: Json | null
          scheduled_message_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_message_logs_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          content: string | null
          created_at: string
          exclude_admins: boolean | null
          executions_count: number | null
          filename: string | null
          group_jid: string
          group_name: string | null
          id: string
          instance_id: string
          is_recurring: boolean | null
          last_error: string | null
          last_executed_at: string | null
          media_url: string | null
          message_type: string
          next_run_at: string
          random_delay: string | null
          recipients: Json | null
          recurrence_count: number | null
          recurrence_days: number[] | null
          recurrence_end_at: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          exclude_admins?: boolean | null
          executions_count?: number | null
          filename?: string | null
          group_jid: string
          group_name?: string | null
          id?: string
          instance_id: string
          is_recurring?: boolean | null
          last_error?: string | null
          last_executed_at?: string | null
          media_url?: string | null
          message_type: string
          next_run_at: string
          random_delay?: string | null
          recipients?: Json | null
          recurrence_count?: number | null
          recurrence_days?: number[] | null
          recurrence_end_at?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          exclude_admins?: boolean | null
          executions_count?: number | null
          filename?: string | null
          group_jid?: string
          group_name?: string | null
          id?: string
          instance_id?: string
          is_recurring?: boolean | null
          last_error?: string | null
          last_executed_at?: string | null
          media_url?: string | null
          message_type?: string
          next_run_at?: string
          random_delay?: string | null
          recipients?: Json | null
          recurrence_count?: number | null
          recurrence_days?: number[] | null
          recurrence_end_at?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_jobs: {
        Row: {
          agent_id: string | null
          created_at: string | null
          duplicates: number | null
          error_message: string | null
          errors: number | null
          found_links: Json | null
          id: string
          imported: number | null
          progress: number | null
          status: string | null
          total: number | null
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          duplicates?: number | null
          error_message?: string | null
          errors?: number | null
          found_links?: Json | null
          id?: string
          imported?: number | null
          progress?: number | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          duplicates?: number | null
          error_message?: string | null
          errors?: number | null
          found_links?: Json | null
          id?: string
          imported?: number | null
          progress?: number | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_report_configs: {
        Row: {
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          inbox_id: string
          instance_id: string
          last_sent_at: string | null
          recipient_number: string
          send_hour: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          inbox_id: string
          instance_id: string
          last_sent_at?: string | null
          recipient_number: string
          send_hour?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          inbox_id?: string
          instance_id?: string
          last_sent_at?: string | null
          recipient_number?: string
          send_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shift_instance"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_report_configs_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_report_logs: {
        Row: {
          config_id: string
          conversations_resolved: number | null
          conversations_total: number | null
          error_message: string | null
          id: string
          report_content: string | null
          sent_at: string
          status: string
        }
        Insert: {
          config_id: string
          conversations_resolved?: number | null
          conversations_total?: number | null
          error_message?: string | null
          id?: string
          report_content?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          config_id?: string
          conversations_resolved?: number | null
          conversations_total?: number | null
          error_message?: string | null
          id?: string
          report_content?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_report_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "shift_report_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          is_secret: boolean | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      user_instance_access: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_instance_access_instance"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      utm_campaigns: {
        Row: {
          ai_custom_text: string
          ai_template: string
          campaign_type: string
          created_at: string
          created_by: string
          destination_phone: string
          expires_at: string | null
          form_slug: string | null
          id: string
          instance_id: string
          kanban_board_id: string | null
          landing_mode: string
          name: string
          slug: string
          starts_at: string | null
          status: string
          updated_at: string
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
          utm_term: string | null
          welcome_message: string
        }
        Insert: {
          ai_custom_text?: string
          ai_template?: string
          campaign_type?: string
          created_at?: string
          created_by: string
          destination_phone: string
          expires_at?: string | null
          form_slug?: string | null
          id?: string
          instance_id: string
          kanban_board_id?: string | null
          landing_mode?: string
          name: string
          slug: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
          welcome_message?: string
        }
        Update: {
          ai_custom_text?: string
          ai_template?: string
          campaign_type?: string
          created_at?: string
          created_by?: string
          destination_phone?: string
          expires_at?: string | null
          form_slug?: string | null
          id?: string
          instance_id?: string
          kanban_board_id?: string | null
          landing_mode?: string
          name?: string
          slug?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "utm_campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utm_campaigns_kanban_board_id_fkey"
            columns: ["kanban_board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      utm_visits: {
        Row: {
          campaign_id: string
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          matched_at: string | null
          metadata: Json | null
          ref_code: string
          referrer: string | null
          status: string
          user_agent: string | null
          visited_at: string
          visitor_ip: string | null
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          matched_at?: string | null
          metadata?: Json | null
          ref_code: string
          referrer?: string | null
          status?: string
          user_agent?: string | null
          visited_at?: string
          visitor_ip?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          matched_at?: string | null
          metadata?: Json | null
          ref_code?: string
          referrer?: string | null
          status?: string
          user_agent?: string | null
          visited_at?: string
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utm_visits_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "utm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utm_visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utm_visits_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_forms: {
        Row: {
          agent_id: string
          completion_message: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          max_submissions: number | null
          name: string
          slug: string
          status: string
          template_type: string | null
          updated_at: string
          webhook_url: string | null
          welcome_message: string
        }
        Insert: {
          agent_id: string
          completion_message?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_submissions?: number | null
          name: string
          slug: string
          status?: string
          template_type?: string | null
          updated_at?: string
          webhook_url?: string | null
          welcome_message?: string
        }
        Update: {
          agent_id?: string
          completion_message?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_submissions?: number | null
          name?: string
          slug?: string
          status?: string
          template_type?: string | null
          updated_at?: string
          webhook_url?: string | null
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_forms_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_user_inbox_roles: {
        Row: {
          inbox_id: string | null
          is_super_admin: boolean | null
          role: Database["public"]["Enums"]["inbox_role"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_users_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      append_ai_debounce_message:
        | {
            Args: {
              p_conversation_id: string
              p_first_message_at?: string
              p_instance_id: string
              p_message: Json
              p_process_after: string
            }
            Returns: {
              id: string
              messages: Json
              process_after: string
              processed: boolean
            }[]
          }
        | {
            Args: {
              p_conversation_id: string
              p_first_message_at?: string
              p_instance_id: string
              p_message: Json
              p_process_after: string
            }
            Returns: {
              id: string
              messages: Json
              process_after: string
              processed: boolean
            }[]
          }
      archive_old_conversations: {
        Args: { p_days_threshold?: number }
        Returns: number
      }
      backup_query: {
        Args: { _action: string; _table_name?: string }
        Returns: Json
      }
      can_access_kanban_board: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_kanban_card: {
        Args: { _card_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_conversation: {
        Args: { _department_id: string; _inbox_id: string; _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_global_max?: number
          p_max_requests: number
          p_user_id: string
          p_window_seconds?: number
        }
        Returns: {
          global_used: number
          is_limited: boolean
          remaining: number
          used: number
        }[]
      }
      claim_jobs: {
        Args: { p_batch_size?: number; p_job_type: string }
        Returns: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          job_type: string
          max_attempts: number
          payload: Json
          processed_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_e2e_runs: { Args: never; Returns: undefined }
      complete_job: {
        Args: { p_error?: string; p_job_id: string; p_status?: string }
        Returns: undefined
      }
      dblink: { Args: { "": string }; Returns: Record<string, unknown>[] }
      dblink_cancel_query: { Args: { "": string }; Returns: string }
      dblink_close: { Args: { "": string }; Returns: string }
      dblink_connect: { Args: { "": string }; Returns: string }
      dblink_connect_u: { Args: { "": string }; Returns: string }
      dblink_current_query: { Args: never; Returns: string }
      dblink_disconnect:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      dblink_error_message: { Args: { "": string }; Returns: string }
      dblink_exec: { Args: { "": string }; Returns: string }
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] }
        Returns: undefined
      }
      dblink_get_connections: { Args: never; Returns: string[] }
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] }
      dblink_get_pkey: {
        Args: { "": string }
        Returns: Database["public"]["CompositeTypes"]["dblink_pkey_results"][]
        SetofOptions: {
          from: "*"
          to: "dblink_pkey_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dblink_get_result: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      dblink_is_busy: { Args: { "": string }; Returns: number }
      delete_inbox: { Args: { _inbox_id: string }; Returns: undefined }
      get_active_form_session: {
        Args: { p_conversation_id: string }
        Returns: {
          collected_data: Json
          completed_at: string | null
          contact_id: string | null
          conversation_id: string
          current_field_index: number
          form_id: string
          id: string
          last_activity_at: string
          retries: number
          started_at: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "form_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_e2e_results: { Args: never; Returns: Json }
      get_form_stats: {
        Args: { p_form_id: string }
        Returns: {
          today: number
          total: number
        }[]
      }
      get_funnel_lead_count: {
        Args: { p_funnel_slug: string }
        Returns: number
      }
      get_inbox_role: {
        Args: { _inbox_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["inbox_role"]
      }
      get_kanban_board_counts: {
        Args: never
        Returns: {
          board_id: string
          card_count: number
          column_count: number
          member_count: number
        }[]
      }
      global_search_conversations: {
        Args: { _limit?: number; _query: string }
        Returns: {
          assigned_to: string
          contact_id: string
          contact_name: string
          contact_phone: string
          contact_profile_pic_url: string
          conversation_id: string
          inbox_id: string
          inbox_name: string
          is_read: boolean
          last_message_at: string
          match_type: string
          message_snippet: string
          priority: string
          status: string
        }[]
      }
      has_inbox_access: {
        Args: { _inbox_id: string; _user_id: string }
        Returns: boolean
      }
      has_inbox_access_fast: {
        Args: { _inbox_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_bio_click: { Args: { p_button_id: string }; Returns: undefined }
      increment_bio_view: {
        Args: { p_bio_page_id: string }
        Returns: undefined
      }
      increment_lead_msg_count: {
        Args: { p_conversation_id: string }
        Returns: {
          lead_msg_count: number
        }[]
      }
      is_gerente: { Args: { _user_id: string }; Returns: boolean }
      is_inbox_member: {
        Args: { _inbox_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_id?: string
          p_target_table?: string
          p_user_id: string
        }
        Returns: undefined
      }
      merge_conversation_tags: {
        Args: { p_conversation_id: string; p_new_tags: string[] }
        Returns: {
          tags: string[]
        }[]
      }
      normalize_external_id: { Args: { ext_id: string }; Returns: string }
      prune_ai_agent_logs: {
        Args: { p_days_threshold?: number }
        Returns: number
      }
      refresh_inbox_roles_cache: { Args: never; Returns: undefined }
      reset_e2e_conversation: { Args: never; Returns: Json }
      search_products_fuzzy: {
        Args: {
          _agent_id: string
          _limit?: number
          _query: string
          _threshold?: number
        }
        Returns: {
          category: string
          description: string
          id: string
          images: string[]
          in_stock: boolean
          price: number
          sim: number
          subcategory: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      try_insert_greeting: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_external_id?: string
        }
        Returns: {
          inserted: boolean
          message_id: string
        }[]
      }
      update_lead_count_from_entries: {
        Args: { p_database_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "user" | "gerente"
      inbox_role: "admin" | "gestor" | "agente"
      kanban_field_type:
        | "text"
        | "currency"
        | "date"
        | "select"
        | "entity_select"
      kanban_visibility: "shared" | "private"
    }
    CompositeTypes: {
      dblink_pkey_results: {
        position: number | null
        colname: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "user", "gerente"],
      inbox_role: ["admin", "gestor", "agente"],
      kanban_field_type: [
        "text",
        "currency",
        "date",
        "select",
        "entity_select",
      ],
      kanban_visibility: ["shared", "private"],
    },
  },
} as const
