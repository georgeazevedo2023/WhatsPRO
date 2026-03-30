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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
      ai_agent_logs: {
        Row: {
          conversation_id: string
          created_at: string
          event: string
          id: string
          instance_id: string | null
          metadata: Json | null
          tool_calls: Json | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          event: string
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          tool_calls?: Json | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          event?: string
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          tool_calls?: Json | null
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          business_hours: Json | null
          created_at: string
          extraction_fields: Json | null
          follow_up_rules: Json | null
          id: string
          instance_id: string
          model: string | null
          name: string | null
          prompt: string | null
          sub_agents: Json | null
          temperature: number | null
          updated_at: string
          voice_enabled: boolean | null
        }
        Insert: {
          business_hours?: Json | null
          created_at?: string
          extraction_fields?: Json | null
          follow_up_rules?: Json | null
          id?: string
          instance_id: string
          model?: string | null
          name?: string | null
          prompt?: string | null
          sub_agents?: Json | null
          temperature?: number | null
          updated_at?: string
          voice_enabled?: boolean | null
        }
        Update: {
          business_hours?: Json | null
          created_at?: string
          extraction_fields?: Json | null
          follow_up_rules?: Json | null
          id?: string
          instance_id?: string
          model?: string | null
          name?: string | null
          prompt?: string | null
          sub_agents?: Json | null
          temperature?: number | null
          updated_at?: string
          voice_enabled?: boolean | null
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
      lead_profiles: {
        Row: {
          address: Json | null
          average_ticket: number | null
          birth_date: string | null
          city: string | null
          contact_id: string
          conversation_summaries: Json | null
          created_at: string
          custom_fields: Json | null
          document: string | null
          email: string | null
          full_name: string | null
          id: string
          interests: string[] | null
          last_contact_at: string | null
          notes: string | null
          origin: string | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          average_ticket?: number | null
          birth_date?: string | null
          city?: string | null
          contact_id: string
          conversation_summaries?: Json | null
          created_at?: string
          custom_fields?: Json | null
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          interests?: string[] | null
          last_contact_at?: string | null
          notes?: string | null
          origin?: string | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          average_ticket?: number | null
          birth_date?: string | null
          city?: string | null
          contact_id?: string
          conversation_summaries?: Json | null
          created_at?: string
          custom_fields?: Json | null
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          interests?: string[] | null
          last_contact_at?: string | null
          notes?: string | null
          origin?: string | null
          reason?: string | null
          updated_at?: string
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
          assigned_to: string | null
          contact_id: string
          created_at: string
          department_id: string | null
          id: string
          inbox_id: string
          is_read: boolean
          last_message: string | null
          last_message_at: string | null
          priority: string
          status: string
          status_ia: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          ai_summary?: Json | null
          ai_summary_expires_at?: string | null
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          inbox_id: string
          is_read?: boolean
          last_message?: string | null
          last_message_at?: string | null
          priority?: string
          status?: string
          status_ia?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_summary?: Json | null
          ai_summary_expires_at?: string | null
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          inbox_id?: string
          is_read?: boolean
          last_message?: string | null
          last_message_at?: string | null
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
          instance_id: string
          name: string
          webhook_outgoing_url: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          instance_id: string
          name: string
          webhook_outgoing_url?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          instance_id?: string
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
        Relationships: []
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
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      delete_inbox: { Args: { _inbox_id: string }; Returns: undefined }
      get_kanban_board_counts: {
        Args: Record<string, never>
        Returns: { board_id: string; column_count: number; card_count: number; member_count: number }[]
      }
      get_inbox_role: {
        Args: { _inbox_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["inbox_role"]
      }
      has_inbox_access: {
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
      is_gerente: { Args: { _user_id: string }; Returns: boolean }
      is_inbox_member: {
        Args: { _inbox_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      normalize_external_id: { Args: { ext_id: string }; Returns: string }
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
      [_ in never]: never
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
