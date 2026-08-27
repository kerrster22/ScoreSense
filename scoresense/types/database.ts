/**
 * Hand-written Supabase database types matching supabase/migrations/0001_auth_profiles.sql.
 *
 * Once the project is linked to a real Supabase project, regenerate this file from the
 * live schema instead of maintaining it by hand:
 *
 *   npx supabase gen types typescript --project-id <project-ref> --schema public > types/database.ts
 *
 * (or `--linked` if you've run `supabase link` locally). Keep the `Database` export name
 * stable since lib/supabase/* imports it directly.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          user_id: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          status: string
          price_id: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          status?: string
          price_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          status?: string
          price_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      piece_uploads: {
        Row: {
          id: string
          user_id: string
          filename: string
          storage_path: string
          extension: string
          size_bytes: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          storage_path: string
          extension: string
          size_bytes: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          storage_path?: string
          extension?: string
          size_bytes?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"]
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"]
export type SubscriptionInsert = Database["public"]["Tables"]["subscriptions"]["Insert"]
export type SubscriptionUpdate = Database["public"]["Tables"]["subscriptions"]["Update"]

export type PieceUpload = Database["public"]["Tables"]["piece_uploads"]["Row"]
export type PieceUploadInsert = Database["public"]["Tables"]["piece_uploads"]["Insert"]
