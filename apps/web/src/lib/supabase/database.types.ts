export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          branch_id: string | null;
          current: Json | null;
          entity: string;
          entity_id: string | null;
          id: number;
          occurred_at: string;
          previous: Json | null;
          tenant_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          branch_id?: string | null;
          current?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: never;
          occurred_at?: string;
          previous?: Json | null;
          tenant_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          branch_id?: string | null;
          current?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          occurred_at?: string;
          previous?: Json | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_events_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'audit_events_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      branches: {
        Row: {
          id: string;
          name: string;
          tenant_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          tenant_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'branches_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      client_documents: {
        Row: {
          client_id: string;
          created_at: string;
          expires_on: string | null;
          filename: string;
          id: string;
          kind: string;
          mime_type: string;
          path: string;
          size: number;
          status: string;
          tenant_id: string;
          title: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          expires_on?: string | null;
          filename: string;
          id?: string;
          kind: string;
          mime_type: string;
          path: string;
          size: number;
          status?: string;
          tenant_id: string;
          title: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          expires_on?: string | null;
          filename?: string;
          id?: string;
          kind?: string;
          mime_type?: string;
          path?: string;
          size?: number;
          status?: string;
          tenant_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_documents_client_id_tenant_id_fkey';
            columns: ['client_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      client_events: {
        Row: {
          actor_id: string | null;
          actor_name: string | null;
          client_id: string;
          created_at: string;
          detail: Json;
          id: string;
          kind: string;
          tenant_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_name?: string | null;
          client_id: string;
          created_at?: string;
          detail: Json;
          id?: string;
          kind: string;
          tenant_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string | null;
          client_id?: string;
          created_at?: string;
          detail?: Json;
          id?: string;
          kind?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_events_client_id_tenant_id_fkey';
            columns: ['client_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      client_keys: {
        Row: {
          client_id: string;
          kind: string;
          tenant_id: string;
          value: string;
        };
        Insert: {
          client_id: string;
          kind: string;
          tenant_id: string;
          value: string;
        };
        Update: {
          client_id?: string;
          kind?: string;
          tenant_id?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_keys_client_id_tenant_id_fkey';
            columns: ['client_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      clients: {
        Row: {
          birth_date: string | null;
          branch_id: string;
          classification: string;
          consent: Json;
          created_at: string;
          expenses: number | null;
          id: string;
          income: number | null;
          name: string;
          profile: Json;
          revision: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          birth_date?: string | null;
          branch_id: string;
          classification?: string;
          consent: Json;
          created_at?: string;
          expenses?: number | null;
          id?: string;
          income?: number | null;
          name: string;
          profile: Json;
          revision?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          branch_id?: string;
          classification?: string;
          consent?: Json;
          created_at?: string;
          expenses?: number | null;
          id?: string;
          income?: number | null;
          name?: string;
          profile?: Json;
          revision?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'clients_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      memberships: {
        Row: {
          active: boolean;
          branch_id: string | null;
          display_name: string;
          email: string;
          id: string;
          role_id: string;
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          branch_id?: string | null;
          display_name: string;
          email: string;
          id?: string;
          role_id: string;
          tenant_id: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          branch_id?: string | null;
          display_name?: string;
          email?: string;
          id?: string;
          role_id?: string;
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'memberships_role_id_tenant_id_fkey';
            columns: ['role_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_roles';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'memberships_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          features: Json;
          id: string;
          limits: Json;
          name: string;
        };
        Insert: {
          features?: Json;
          id?: string;
          limits: Json;
          name: string;
        };
        Update: {
          features?: Json;
          id?: string;
          limits?: Json;
          name?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
        };
        Insert: {
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [];
      };
      platform_audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          current: Json | null;
          entity: string;
          id: number;
          occurred_at: string;
          previous: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          current?: Json | null;
          entity: string;
          id?: never;
          occurred_at?: string;
          previous?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          current?: Json | null;
          entity?: string;
          id?: never;
          occurred_at?: string;
          previous?: Json | null;
        };
        Relationships: [];
      };
      presets: {
        Row: {
          configuration: Json;
          id: string;
          name: string;
        };
        Insert: {
          configuration: Json;
          id?: string;
          name: string;
        };
        Update: {
          configuration?: Json;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      product_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          product_id: string;
          tenant_id: string;
          terms: Json;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          product_id: string;
          tenant_id: string;
          terms: Json;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          product_id?: string;
          tenant_id?: string;
          terms?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'product_versions_product_id_tenant_id_fkey';
            columns: ['product_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      products: {
        Row: {
          active_version: number | null;
          created_at: string;
          id: string;
          name: string;
          revision: number;
          source_key: string | null;
          status: string;
          tenant_id: string;
        };
        Insert: {
          active_version?: number | null;
          created_at?: string;
          id?: string;
          name: string;
          revision?: number;
          source_key?: string | null;
          status?: string;
          tenant_id: string;
        };
        Update: {
          active_version?: number | null;
          created_at?: string;
          id?: string;
          name?: string;
          revision?: number;
          source_key?: string | null;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_id_active_version_tenant_id_fkey';
            columns: ['id', 'active_version', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'product_versions';
            referencedColumns: ['product_id', 'version', 'tenant_id'];
          },
          {
            foreignKeyName: 'products_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_configuration: {
        Row: {
          category: string;
          id: string;
          key: string;
          tenant_id: string;
          value: Json;
        };
        Insert: {
          category: string;
          id?: string;
          key: string;
          tenant_id: string;
          value: Json;
        };
        Update: {
          category?: string;
          id?: string;
          key?: string;
          tenant_id?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_configuration_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_roles: {
        Row: {
          id: string;
          key: string;
          name: string;
          permissions: string[];
          tenant_id: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          permissions: string[];
          tenant_id: string;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          permissions?: string[];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_roles_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenants: {
        Row: {
          accent: string;
          active: boolean;
          contact_phone: string;
          created_at: string;
          currency: string;
          footer: string;
          id: string;
          legal_name: string;
          license_number: string;
          logo_url: string | null;
          name: string;
          plan_id: string;
          security: Json;
          slug: string;
          timezone: string;
        };
        Insert: {
          accent?: string;
          active?: boolean;
          contact_phone?: string;
          created_at?: string;
          currency?: string;
          footer?: string;
          id?: string;
          legal_name?: string;
          license_number?: string;
          logo_url?: string | null;
          name: string;
          plan_id: string;
          security?: Json;
          slug: string;
          timezone?: string;
        };
        Update: {
          accent?: string;
          active?: boolean;
          contact_phone?: string;
          created_at?: string;
          currency?: string;
          footer?: string;
          id?: string;
          legal_name?: string;
          license_number?: string;
          logo_url?: string | null;
          name?: string;
          plan_id?: string;
          security?: Json;
          slug?: string;
          timezone?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenants_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_client_note: {
        Args: { c: string; note: string; t: string };
        Returns: string;
      };
      branch_allowed: { Args: { b: string; t: string }; Returns: boolean };
      client_allowed: {
        Args: { c: string; p?: string; t: string };
        Returns: boolean;
      };
      client_object_allowed: {
        Args: { object_path: string; p: string; upload?: boolean };
        Returns: boolean;
      };
      client_search_text: { Args: { value: string }; Returns: string };
      complete_client_document: {
        Args: { did: string; t: string };
        Returns: boolean;
      };
      has_permission: { Args: { p: string; t: string }; Returns: boolean };
      import_clients: { Args: { rows: Json; t: string }; Returns: Json };
      is_platform_admin: { Args: never; Returns: boolean };
      link_existing_member: {
        Args: {
          member_email: string;
          member_name: string;
          selected_branch?: string;
          selected_role: string;
          t: string;
        };
        Returns: boolean;
      };
      log_access: { Args: { t: string }; Returns: undefined };
      log_platform_access: { Args: never; Returns: undefined };
      product_shape: { Args: { c: Json }; Returns: boolean };
      provision_tenant: {
        Args: {
          preset_id: string;
          selected_plan_id: string;
          tenant_name: string;
          tenant_slug: string;
        };
        Returns: string;
      };
      reserve_client_document: {
        Args: { c: string; document_data: Json; t: string };
        Returns: {
          client_id: string;
          created_at: string;
          expires_on: string | null;
          filename: string;
          id: string;
          kind: string;
          mime_type: string;
          path: string;
          size: number;
          status: string;
          tenant_id: string;
          title: string;
        };
        SetofOptions: {
          from: '*';
          to: 'client_documents';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resolve_tenant: {
        Args: { tenant_slug: string };
        Returns: {
          accent: string;
          id: string;
          logo_url: string;
          name: string;
          password_min_length: number;
          require_mfa: boolean;
          slug: string;
        }[];
      };
      save_client: {
        Args: {
          client_data: Json;
          expected_revision?: number;
          selected_client?: string;
          t: string;
        };
        Returns: string;
      };
      save_product: {
        Args: {
          conditions: Json;
          expected_revision: number;
          product_name: string;
          product_status: string;
          selected_product?: string;
          t: string;
        };
        Returns: string;
      };
      search_clients: {
        Args: {
          page_offset?: number;
          page_size?: number;
          query?: string;
          selected_branch?: string;
          selected_class?: string;
          t: string;
        };
        Returns: {
          birth_date: string | null;
          branch_id: string;
          classification: string;
          consent: Json;
          created_at: string;
          expenses: number | null;
          id: string;
          income: number | null;
          name: string;
          profile: Json;
          revision: number;
          tenant_id: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'clients';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      tenant_session_valid: { Args: { t: string }; Returns: boolean };
      tenant_usage: {
        Args: never;
        Returns: {
          tenant_id: string;
          user_count: number;
        }[];
      };
      valid_client_profile: {
        Args: { consent: Json; p: Json };
        Returns: boolean;
      };
      valid_product_terms: { Args: { c: Json }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
