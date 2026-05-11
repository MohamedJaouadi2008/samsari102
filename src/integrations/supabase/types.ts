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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_picks_override: {
        Row: {
          count: number | null
          created_at: string
          id: string
          note: string | null
          pick_date: string
          property_ids: Json
          set_at: string
          set_by: string | null
          updated_at: string
        }
        Insert: {
          count?: number | null
          created_at?: string
          id?: string
          note?: string | null
          pick_date: string
          property_ids?: Json
          set_at?: string
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          count?: number | null
          created_at?: string
          id?: string
          note?: string | null
          pick_date?: string
          property_ids?: Json
          set_at?: string
          set_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ban_appeals: {
        Row: {
          admin_notes: string | null
          appeal_reason: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          appeal_reason: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          appeal_reason?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          actual_check_in: string | null
          actual_check_out: string | null
          auto_action_taken: string | null
          auto_action_taken_at: string | null
          bank_payout_amount: number | null
          bank_payout_completed_at: string | null
          bank_payout_currency: string | null
          bank_payout_error: string | null
          bank_payout_initiated_at: string | null
          bank_payout_provider: string | null
          bank_payout_reference: string | null
          bank_payout_status: string | null
          cancelled_at: string | null
          check_in_condition_confirmed: boolean | null
          check_in_date: string
          check_in_deadline: string | null
          check_in_issues_description: string | null
          check_in_issues_photos: Json | null
          check_in_issues_reported: boolean | null
          check_in_time: string | null
          check_out_date: string
          check_out_deadline: string | null
          check_out_time: string | null
          created_at: string
          credit_applied: number | null
          deposit_amount: number | null
          discount_amount: number | null
          dispute_deadline: string | null
          dispute_evidence: Json | null
          dispute_filed_by: string | null
          dispute_opened_at: string | null
          dispute_reason: string | null
          dispute_resolved_at: string | null
          escrow_currency: string | null
          escrow_held_at: string | null
          escrow_released_at: string | null
          escrow_status: string | null
          full_payment_locked: boolean | null
          full_payment_locked_at: string | null
          guest_check_in_confirmed_at: string | null
          guest_check_out_confirmed_at: string | null
          guest_condition_confirmed: boolean | null
          guest_id: string
          guest_service_fee: number | null
          host_check_in_confirmed_at: string | null
          host_check_out_confirmed_at: string | null
          host_damage_description: string | null
          host_damage_photos: Json | null
          host_id: string
          host_payout_amount: number | null
          host_reported_damage: boolean | null
          host_response: string | null
          host_stripe_account_id: string | null
          id: string
          num_guests: number
          payment_failure_at: string | null
          payment_failure_reason: string | null
          payment_method: string | null
          payment_status: string | null
          platform_commission: number | null
          promo_code_id: string | null
          property_id: string
          refund_amount: number | null
          refund_reason: string | null
          refund_status: string | null
          remaining_payment_amount: number | null
          remaining_payment_deadline: string | null
          remaining_payment_intent_id: string | null
          remaining_payment_paid_at: string | null
          remaining_payment_status: string | null
          reminder_arrival_day_sent_at: string | null
          reminder_pre_checkin_sent_at: string | null
          reminder_pre_checkout_sent_at: string | null
          reminder_review_nudge_sent_at: string | null
          request_message: string | null
          responded_at: string | null
          settled_at: string | null
          settlement_due_at: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_dispute_id: string | null
          stripe_dispute_reason: string | null
          stripe_dispute_status: string | null
          stripe_payment_intent_id: string | null
          stripe_remaining_payment_intent_id: string | null
          stripe_transfer_id: string | null
          total_price: number
          transfer_failure_at: string | null
          transfer_failure_reason: string | null
          updated_at: string
        }
        Insert: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          auto_action_taken?: string | null
          auto_action_taken_at?: string | null
          bank_payout_amount?: number | null
          bank_payout_completed_at?: string | null
          bank_payout_currency?: string | null
          bank_payout_error?: string | null
          bank_payout_initiated_at?: string | null
          bank_payout_provider?: string | null
          bank_payout_reference?: string | null
          bank_payout_status?: string | null
          cancelled_at?: string | null
          check_in_condition_confirmed?: boolean | null
          check_in_date: string
          check_in_deadline?: string | null
          check_in_issues_description?: string | null
          check_in_issues_photos?: Json | null
          check_in_issues_reported?: boolean | null
          check_in_time?: string | null
          check_out_date: string
          check_out_deadline?: string | null
          check_out_time?: string | null
          created_at?: string
          credit_applied?: number | null
          deposit_amount?: number | null
          discount_amount?: number | null
          dispute_deadline?: string | null
          dispute_evidence?: Json | null
          dispute_filed_by?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          escrow_currency?: string | null
          escrow_held_at?: string | null
          escrow_released_at?: string | null
          escrow_status?: string | null
          full_payment_locked?: boolean | null
          full_payment_locked_at?: string | null
          guest_check_in_confirmed_at?: string | null
          guest_check_out_confirmed_at?: string | null
          guest_condition_confirmed?: boolean | null
          guest_id: string
          guest_service_fee?: number | null
          host_check_in_confirmed_at?: string | null
          host_check_out_confirmed_at?: string | null
          host_damage_description?: string | null
          host_damage_photos?: Json | null
          host_id: string
          host_payout_amount?: number | null
          host_reported_damage?: boolean | null
          host_response?: string | null
          host_stripe_account_id?: string | null
          id?: string
          num_guests?: number
          payment_failure_at?: string | null
          payment_failure_reason?: string | null
          payment_method?: string | null
          payment_status?: string | null
          platform_commission?: number | null
          promo_code_id?: string | null
          property_id: string
          refund_amount?: number | null
          refund_reason?: string | null
          refund_status?: string | null
          remaining_payment_amount?: number | null
          remaining_payment_deadline?: string | null
          remaining_payment_intent_id?: string | null
          remaining_payment_paid_at?: string | null
          remaining_payment_status?: string | null
          reminder_arrival_day_sent_at?: string | null
          reminder_pre_checkin_sent_at?: string | null
          reminder_pre_checkout_sent_at?: string | null
          reminder_review_nudge_sent_at?: string | null
          request_message?: string | null
          responded_at?: string | null
          settled_at?: string | null
          settlement_due_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_dispute_id?: string | null
          stripe_dispute_reason?: string | null
          stripe_dispute_status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_remaining_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          total_price: number
          transfer_failure_at?: string | null
          transfer_failure_reason?: string | null
          updated_at?: string
        }
        Update: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          auto_action_taken?: string | null
          auto_action_taken_at?: string | null
          bank_payout_amount?: number | null
          bank_payout_completed_at?: string | null
          bank_payout_currency?: string | null
          bank_payout_error?: string | null
          bank_payout_initiated_at?: string | null
          bank_payout_provider?: string | null
          bank_payout_reference?: string | null
          bank_payout_status?: string | null
          cancelled_at?: string | null
          check_in_condition_confirmed?: boolean | null
          check_in_date?: string
          check_in_deadline?: string | null
          check_in_issues_description?: string | null
          check_in_issues_photos?: Json | null
          check_in_issues_reported?: boolean | null
          check_in_time?: string | null
          check_out_date?: string
          check_out_deadline?: string | null
          check_out_time?: string | null
          created_at?: string
          credit_applied?: number | null
          deposit_amount?: number | null
          discount_amount?: number | null
          dispute_deadline?: string | null
          dispute_evidence?: Json | null
          dispute_filed_by?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          escrow_currency?: string | null
          escrow_held_at?: string | null
          escrow_released_at?: string | null
          escrow_status?: string | null
          full_payment_locked?: boolean | null
          full_payment_locked_at?: string | null
          guest_check_in_confirmed_at?: string | null
          guest_check_out_confirmed_at?: string | null
          guest_condition_confirmed?: boolean | null
          guest_id?: string
          guest_service_fee?: number | null
          host_check_in_confirmed_at?: string | null
          host_check_out_confirmed_at?: string | null
          host_damage_description?: string | null
          host_damage_photos?: Json | null
          host_id?: string
          host_payout_amount?: number | null
          host_reported_damage?: boolean | null
          host_response?: string | null
          host_stripe_account_id?: string | null
          id?: string
          num_guests?: number
          payment_failure_at?: string | null
          payment_failure_reason?: string | null
          payment_method?: string | null
          payment_status?: string | null
          platform_commission?: number | null
          promo_code_id?: string | null
          property_id?: string
          refund_amount?: number | null
          refund_reason?: string | null
          refund_status?: string | null
          remaining_payment_amount?: number | null
          remaining_payment_deadline?: string | null
          remaining_payment_intent_id?: string | null
          remaining_payment_paid_at?: string | null
          remaining_payment_status?: string | null
          reminder_arrival_day_sent_at?: string | null
          reminder_pre_checkin_sent_at?: string | null
          reminder_pre_checkout_sent_at?: string | null
          reminder_review_nudge_sent_at?: string | null
          request_message?: string | null
          responded_at?: string | null
          settled_at?: string | null
          settlement_due_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_dispute_id?: string | null
          stripe_dispute_reason?: string | null
          stripe_dispute_status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_remaining_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          total_price?: number
          transfer_failure_at?: string | null
          transfer_failure_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string | null
          created_at: string
          deleted_by_guest: boolean | null
          deleted_by_host: boolean | null
          guest_id: string
          host_id: string
          id: string
          property_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          deleted_by_guest?: boolean | null
          deleted_by_host?: boolean | null
          guest_id: string
          host_id: string
          id?: string
          property_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          deleted_by_guest?: boolean | null
          deleted_by_host?: boolean | null
          guest_id?: string
          host_id?: string
          id?: string
          property_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "host_bookings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount_tnd: number
          created_at: string
          id: string
          reason: string | null
          related_booking_id: string | null
          related_referral_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_tnd: number
          created_at?: string
          id?: string
          reason?: string | null
          related_booking_id?: string | null
          related_referral_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_tnd?: number
          created_at?: string
          id?: string
          reason?: string | null
          related_booking_id?: string | null
          related_referral_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_picks_cache: {
        Row: {
          generated_at: string
          id: string
          pick_date: string
          property_ids: Json
        }
        Insert: {
          generated_at?: string
          id?: string
          pick_date: string
          property_ids?: Json
        }
        Update: {
          generated_at?: string
          id?: string
          pick_date?: string
          property_ids?: Json
        }
        Relationships: []
      }
      escrow_audit_log: {
        Row: {
          action_reason: string
          action_type: string
          amount_affected: number | null
          booking_id: string
          created_at: string
          id: string
          metadata: Json | null
          new_escrow_status: string | null
          new_status: string | null
          previous_escrow_status: string | null
          previous_status: string | null
          stripe_refund_id: string | null
          stripe_transfer_id: string | null
          triggered_by: string
          triggered_by_user_id: string | null
        }
        Insert: {
          action_reason: string
          action_type: string
          amount_affected?: number | null
          booking_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_escrow_status?: string | null
          new_status?: string | null
          previous_escrow_status?: string | null
          previous_status?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          triggered_by: string
          triggered_by_user_id?: string | null
        }
        Update: {
          action_reason?: string
          action_type?: string
          amount_affected?: number | null
          booking_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_escrow_status?: string | null
          new_status?: string | null
          previous_escrow_status?: string | null
          previous_status?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          triggered_by?: string
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_audit_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_audit_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "host_bookings_view"
            referencedColumns: ["id"]
          },
        ]
      }
      external_blocked_dates: {
        Row: {
          created_at: string
          end_date: string
          external_uid: string
          feed_id: string
          id: string
          property_id: string
          start_date: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          end_date: string
          external_uid: string
          feed_id: string
          id?: string
          property_id: string
          start_date: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string
          external_uid?: string
          feed_id?: string
          id?: string
          property_id?: string
          start_date?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_blocked_dates_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "property_calendar_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          guest_id: string
          host_id: string
          id: string
          property_id: string
          rating: number
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          guest_id: string
          host_id: string
          id?: string
          property_id: string
          rating: number
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          guest_id?: string
          host_id?: string
          id?: string
          property_id?: string
          rating?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "host_bookings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      host_ai_insights: {
        Row: {
          expires_at: string
          generated_at: string
          host_id: string
          id: string
          insights: Json
          metrics_snapshot: Json
          model: string
          property_id: string | null
          scope: string
        }
        Insert: {
          expires_at?: string
          generated_at?: string
          host_id: string
          id?: string
          insights: Json
          metrics_snapshot?: Json
          model?: string
          property_id?: string | null
          scope: string
        }
        Update: {
          expires_at?: string
          generated_at?: string
          host_id?: string
          id?: string
          insights?: Json
          metrics_snapshot?: Json
          model?: string
          property_id?: string | null
          scope?: string
        }
        Relationships: []
      }
      id_verifications: {
        Row: {
          allow_resubmit: boolean | null
          cin_back_url: string
          cin_front_url: string
          created_at: string
          id: string
          images_cleaned_at: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          selfie_url: string
          status: string | null
          submitted_at: string
          user_id: string
          warning_count: number | null
        }
        Insert: {
          allow_resubmit?: boolean | null
          cin_back_url: string
          cin_front_url: string
          created_at?: string
          id?: string
          images_cleaned_at?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          selfie_url: string
          status?: string | null
          submitted_at?: string
          user_id: string
          warning_count?: number | null
        }
        Update: {
          allow_resubmit?: boolean | null
          cin_back_url?: string
          cin_front_url?: string
          created_at?: string
          id?: string
          images_cleaned_at?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          selfie_url?: string
          status?: string | null
          submitted_at?: string
          user_id?: string
          warning_count?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string | null
          read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string | null
          read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "host_bookings_view"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bank_account_holder: string | null
          bank_name: string | null
          bank_rib: string | null
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          guest_strikes: number | null
          host_strikes: number | null
          id: string
          is_banned: boolean | null
          is_host: boolean | null
          is_superhost: boolean | null
          last_strike_at: string | null
          last_warning_at: string | null
          last_warning_reason: string | null
          payout_method: string | null
          phone: string | null
          preferred_currency: string | null
          strike_reason: string | null
          stripe_account_id: string | null
          stripe_account_status: string | null
          stripe_onboarding_complete: boolean | null
          superhost_since: string | null
          unbanned_at: string | null
          updated_at: string
          username: string | null
          verification_status: string | null
          verification_submitted_at: string | null
          warning_count: number | null
        }
        Insert: {
          avatar_url?: string | null
          bank_account_holder?: string | null
          bank_name?: string | null
          bank_rib?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          guest_strikes?: number | null
          host_strikes?: number | null
          id: string
          is_banned?: boolean | null
          is_host?: boolean | null
          is_superhost?: boolean | null
          last_strike_at?: string | null
          last_warning_at?: string | null
          last_warning_reason?: string | null
          payout_method?: string | null
          phone?: string | null
          preferred_currency?: string | null
          strike_reason?: string | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_onboarding_complete?: boolean | null
          superhost_since?: string | null
          unbanned_at?: string | null
          updated_at?: string
          username?: string | null
          verification_status?: string | null
          verification_submitted_at?: string | null
          warning_count?: number | null
        }
        Update: {
          avatar_url?: string | null
          bank_account_holder?: string | null
          bank_name?: string | null
          bank_rib?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          guest_strikes?: number | null
          host_strikes?: number | null
          id?: string
          is_banned?: boolean | null
          is_host?: boolean | null
          is_superhost?: boolean | null
          last_strike_at?: string | null
          last_warning_at?: string | null
          last_warning_reason?: string | null
          payout_method?: string | null
          phone?: string | null
          preferred_currency?: string | null
          strike_reason?: string | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_onboarding_complete?: boolean | null
          superhost_since?: string | null
          unbanned_at?: string | null
          updated_at?: string
          username?: string | null
          verification_status?: string | null
          verification_submitted_at?: string | null
          warning_count?: number | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_booking_amount: number | null
          uses_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_booking_amount?: number | null
          uses_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_booking_amount?: number | null
          uses_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          booking_id: string
          discount_amount: number
          id: string
          promo_code_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          discount_amount: number
          id?: string
          promo_code_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          discount_amount?: number
          id?: string
          promo_code_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: Json | null
          arrival_instructions: string | null
          banned_at: string | null
          banned_reason: string | null
          bathrooms: number
          bed_types: Json | null
          bedrooms: number
          booking_enabled: boolean | null
          cancellation_policy: string | null
          check_in_time: string | null
          check_out_time: string | null
          city: string
          coordinates: Json | null
          created_at: string
          currency: string | null
          description: string | null
          extra_beds: number | null
          frozen_at: string | null
          frozen_reason: string | null
          google_maps_url: string | null
          governorate: string
          host_id: string
          house_rules: string | null
          id: string
          is_banned: boolean | null
          is_frozen: boolean | null
          is_public: boolean | null
          is_verified: boolean
          lockbox_code: string | null
          max_guests: number
          minimum_stay: number | null
          parking_info: string | null
          photos: Json | null
          price_per_night: number
          property_type: string
          safety_features: Json | null
          short_code: string | null
          sleeping_arrangements: Json | null
          status: string | null
          title: string
          updated_at: string
          visitor_policy: string | null
          welcome_message: string | null
          wifi_name: string | null
          wifi_password: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          arrival_instructions?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bathrooms?: number
          bed_types?: Json | null
          bedrooms?: number
          booking_enabled?: boolean | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city: string
          coordinates?: Json | null
          created_at?: string
          currency?: string | null
          description?: string | null
          extra_beds?: number | null
          frozen_at?: string | null
          frozen_reason?: string | null
          google_maps_url?: string | null
          governorate: string
          host_id: string
          house_rules?: string | null
          id?: string
          is_banned?: boolean | null
          is_frozen?: boolean | null
          is_public?: boolean | null
          is_verified?: boolean
          lockbox_code?: string | null
          max_guests?: number
          minimum_stay?: number | null
          parking_info?: string | null
          photos?: Json | null
          price_per_night: number
          property_type: string
          safety_features?: Json | null
          short_code?: string | null
          sleeping_arrangements?: Json | null
          status?: string | null
          title: string
          updated_at?: string
          visitor_policy?: string | null
          welcome_message?: string | null
          wifi_name?: string | null
          wifi_password?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          arrival_instructions?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bathrooms?: number
          bed_types?: Json | null
          bedrooms?: number
          booking_enabled?: boolean | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string
          coordinates?: Json | null
          created_at?: string
          currency?: string | null
          description?: string | null
          extra_beds?: number | null
          frozen_at?: string | null
          frozen_reason?: string | null
          google_maps_url?: string | null
          governorate?: string
          host_id?: string
          house_rules?: string | null
          id?: string
          is_banned?: boolean | null
          is_frozen?: boolean | null
          is_public?: boolean | null
          is_verified?: boolean
          lockbox_code?: string | null
          max_guests?: number
          minimum_stay?: number | null
          parking_info?: string | null
          photos?: Json | null
          price_per_night?: number
          property_type?: string
          safety_features?: Json | null
          short_code?: string | null
          sleeping_arrangements?: Json | null
          status?: string | null
          title?: string
          updated_at?: string
          visitor_policy?: string | null
          welcome_message?: string | null
          wifi_name?: string | null
          wifi_password?: string | null
        }
        Relationships: []
      }
      property_calendar_feeds: {
        Row: {
          created_at: string
          enabled: boolean
          events_imported: number | null
          export_token: string
          feed_name: string | null
          feed_url: string
          host_id: string
          id: string
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          property_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events_imported?: number | null
          export_token?: string
          feed_name?: string | null
          feed_url: string
          host_id: string
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          property_id: string
          provider?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events_imported?: number | null
          export_token?: string
          feed_name?: string | null
          feed_url?: string
          host_id?: string
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          property_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_promotions: {
        Row: {
          amount_tnd: number
          auto_renew: boolean | null
          created_at: string | null
          days: number
          ends_at: string | null
          host_id: string
          id: string
          property_id: string
          sandbox: boolean | null
          starts_at: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          amount_tnd: number
          auto_renew?: boolean | null
          created_at?: string | null
          days: number
          ends_at?: string | null
          host_id: string
          id?: string
          property_id: string
          sandbox?: boolean | null
          starts_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          amount_tnd?: number
          auto_renew?: boolean | null
          created_at?: string | null
          days?: number
          ends_at?: string | null
          host_id?: string
          id?: string
          property_id?: string
          sandbox?: boolean | null
          starts_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_promotions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_promotions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      property_views: {
        Row: {
          duration_seconds: number | null
          exit_at: string | null
          id: string
          is_bounce: boolean | null
          property_id: string
          referrer: string | null
          referrer_type: string | null
          session_id: string | null
          user_agent: string | null
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          duration_seconds?: number | null
          exit_at?: string | null
          id?: string
          is_bounce?: boolean | null
          property_id: string
          referrer?: string | null
          referrer_type?: string | null
          session_id?: string | null
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          duration_seconds?: number | null
          exit_at?: string | null
          id?: string
          is_bounce?: boolean | null
          property_id?: string
          referrer?: string | null
          referrer_type?: string | null
          session_id?: string | null
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_views_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_views_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          identifier: string
          request_count: number
          scope: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          request_count?: number
          scope: string
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          request_count?: number
          scope?: string
          window_start?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          first_booking_id: string | null
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount_tnd: number
          rewarded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          first_booking_id?: string | null
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount_tnd?: number
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          first_booking_id?: string | null
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_amount_tnd?: number
          rewarded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_notes: string | null
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          property_id: string
          rating: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          property_id: string
          rating: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          property_id?: string
          rating?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "host_bookings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_properties: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          filters: Json
          id: string
          last_alerted_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          last_alerted_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          last_alerted_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance_tnd: number
          total_earned_tnd: number
          total_spent_tnd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_tnd?: number
          total_earned_tnd?: number
          total_spent_tnd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_tnd?: number
          total_earned_tnd?: number
          total_spent_tnd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_search_history: {
        Row: {
          check_in: string | null
          check_out: string | null
          city: string | null
          created_at: string
          governorate: string | null
          id: string
          num_guests: number | null
          property_type: string | null
          user_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          city?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          num_guests?: number | null
          property_type?: string | null
          user_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          city?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          num_guests?: number | null
          property_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          booking_id: string | null
          created_at: string
          db_changes: Json | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          payload: Json | null
          processed_at: string | null
          processing_status: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          db_changes?: Json | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          db_changes?: Json | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "host_bookings_view"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_collections: {
        Row: {
          cover_property_id: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          share_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_property_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          share_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_property_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          share_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_collections_cover_property_id_fkey"
            columns: ["cover_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_collections_cover_property_id_fkey"
            columns: ["cover_property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          notes: string | null
          property_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          notes?: string | null
          property_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          notes?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "wishlist_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      host_bookings_view: {
        Row: {
          actual_check_in: string | null
          actual_check_out: string | null
          check_in_date: string | null
          check_in_time: string | null
          check_out_date: string | null
          check_out_time: string | null
          created_at: string | null
          deposit_amount: number | null
          guest_id: string | null
          host_id: string | null
          host_response: string | null
          id: string | null
          payment_method: string | null
          payment_status: string | null
          property_id: string | null
          request_message: string | null
          responded_at: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          check_in_date?: string | null
          check_in_time?: string | null
          check_out_date?: string | null
          check_out_time?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          guest_id?: string | null
          host_id?: string | null
          host_response?: string | null
          id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          property_id?: string | null
          request_message?: string | null
          responded_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          check_in_date?: string | null
          check_in_time?: string | null
          check_out_date?: string | null
          check_out_time?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          guest_id?: string | null
          host_id?: string | null
          host_response?: string | null
          id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          property_id?: string | null
          request_message?: string | null
          responded_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_public"
            referencedColumns: ["id"]
          },
        ]
      }
      properties_public: {
        Row: {
          address: string | null
          amenities: Json | null
          arrival_instructions: string | null
          banned_at: string | null
          banned_reason: string | null
          bathrooms: number | null
          bed_types: Json | null
          bedrooms: number | null
          booking_enabled: boolean | null
          cancellation_policy: string | null
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          coordinates: Json | null
          created_at: string | null
          currency: string | null
          description: string | null
          extra_beds: number | null
          frozen_at: string | null
          frozen_reason: string | null
          google_maps_url: string | null
          governorate: string | null
          host_id: string | null
          house_rules: string | null
          id: string | null
          is_banned: boolean | null
          is_frozen: boolean | null
          is_public: boolean | null
          is_verified: boolean | null
          lockbox_code: string | null
          max_guests: number | null
          minimum_stay: number | null
          parking_info: string | null
          photos: Json | null
          price_per_night: number | null
          property_type: string | null
          safety_features: Json | null
          short_code: string | null
          sleeping_arrangements: Json | null
          status: string | null
          title: string | null
          updated_at: string | null
          visitor_policy: string | null
          welcome_message: string | null
          wifi_name: string | null
          wifi_password: string | null
        }
        Insert: {
          address?: never
          amenities?: Json | null
          arrival_instructions?: never
          banned_at?: string | null
          banned_reason?: string | null
          bathrooms?: number | null
          bed_types?: Json | null
          bedrooms?: number | null
          booking_enabled?: boolean | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          coordinates?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          extra_beds?: number | null
          frozen_at?: string | null
          frozen_reason?: string | null
          google_maps_url?: never
          governorate?: string | null
          host_id?: string | null
          house_rules?: string | null
          id?: string | null
          is_banned?: boolean | null
          is_frozen?: boolean | null
          is_public?: boolean | null
          is_verified?: boolean | null
          lockbox_code?: never
          max_guests?: number | null
          minimum_stay?: number | null
          parking_info?: never
          photos?: Json | null
          price_per_night?: number | null
          property_type?: string | null
          safety_features?: Json | null
          short_code?: string | null
          sleeping_arrangements?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          visitor_policy?: string | null
          welcome_message?: string | null
          wifi_name?: never
          wifi_password?: never
        }
        Update: {
          address?: never
          amenities?: Json | null
          arrival_instructions?: never
          banned_at?: string | null
          banned_reason?: string | null
          bathrooms?: number | null
          bed_types?: Json | null
          bedrooms?: number | null
          booking_enabled?: boolean | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          coordinates?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          extra_beds?: number | null
          frozen_at?: string | null
          frozen_reason?: string | null
          google_maps_url?: never
          governorate?: string | null
          host_id?: string | null
          house_rules?: string | null
          id?: string | null
          is_banned?: boolean | null
          is_frozen?: boolean | null
          is_public?: boolean | null
          is_verified?: boolean | null
          lockbox_code?: never
          max_guests?: number | null
          minimum_stay?: number | null
          parking_info?: never
          photos?: Json | null
          price_per_night?: number | null
          property_type?: string | null
          safety_features?: Json | null
          short_code?: string | null
          sleeping_arrangements?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          visitor_policy?: string | null
          welcome_message?: string | null
          wifi_name?: never
          wifi_password?: never
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          is_host: boolean | null
          is_superhost: boolean | null
          superhost_since: string | null
          username: string | null
          verification_status: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_host?: boolean | null
          is_superhost?: boolean | null
          superhost_since?: string | null
          username?: string | null
          verification_status?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_host?: boolean | null
          is_superhost?: boolean | null
          superhost_since?: string | null
          username?: string | null
          verification_status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_cancellation_refund: {
        Args: { p_booking_id: string; p_cancelled_by: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          _identifier: string
          _max_requests: number
          _scope: string
          _window_seconds: number
        }
        Returns: boolean
      }
      get_my_payout_method: {
        Args: never
        Returns: {
          bank_account_holder: string
          bank_name: string
          bank_rib: string
          payout_method: string
          stripe_account_id: string
          stripe_account_status: string
          stripe_onboarding_complete: boolean
        }[]
      }
      get_panel_role: { Args: never; Returns: string }
      get_platform_fee_rate: { Args: never; Returns: number }
      get_property_access_info: {
        Args: { _property_id: string }
        Returns: {
          address: string
          arrival_instructions: string
          google_maps_url: string
          lockbox_code: string
          parking_info: string
          wifi_name: string
          wifi_password: string
        }[]
      }
      get_property_type_digit: { Args: { p_type: string }; Returns: number }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          id: string
          is_host: boolean
          username: string
          verification_status: string
        }[]
      }
      get_public_profile_safe: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          full_name: string
          id: string
          is_host: boolean
          is_superhost: boolean
          superhost_since: string
          username: string
          verification_status: string
        }[]
      }
      has_active_booking_for_property: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      has_admin_role: { Args: { _user_id: string }; Returns: boolean }
      has_panel_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { user_email: string }; Returns: boolean }
      is_admin_or_moderator: { Args: never; Returns: boolean }
      lookup_referral_code: {
        Args: { _code: string }
        Returns: {
          code: string
          referrer_id: string
        }[]
      }
      process_booking_settlement: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      purge_old_property_views: { Args: never; Returns: number }
      redeem_promo_code: {
        Args: { _booking_id: string; _code: string; _discount_amount: number }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "support"
        | "dispute_manager"
        | "logistics"
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
      app_role: [
        "admin",
        "moderator",
        "support",
        "dispute_manager",
        "logistics",
      ],
    },
  },
} as const
