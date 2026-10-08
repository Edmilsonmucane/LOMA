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
      application_events: {
        Row: {
          actor_id: string;
          actor_name: string;
          application_id: string;
          branch_id: string;
          created_at: string;
          detail: string;
          id: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          actor_id: string;
          actor_name: string;
          application_id: string;
          branch_id: string;
          created_at?: string;
          detail?: string;
          id?: string;
          status: string;
          tenant_id: string;
        };
        Update: {
          actor_id?: string;
          actor_name?: string;
          application_id?: string;
          branch_id?: string;
          created_at?: string;
          detail?: string;
          id?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'application_events_application_id_tenant_id_fkey';
            columns: ['application_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'application_events_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      applications: {
        Row: {
          branch_id: string;
          client_id: string;
          created_at: string;
          created_by: string;
          decided_by: string | null;
          decision_reason: string;
          guarantees: string[];
          id: string;
          opinion: string;
          periods: number;
          principal: string;
          principal_cents: number | null;
          product_version_id: string;
          purpose: string;
          revision: number;
          start_date: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          client_id: string;
          created_at?: string;
          created_by: string;
          decided_by?: string | null;
          decision_reason?: string;
          guarantees?: string[];
          id?: string;
          opinion?: string;
          periods: number;
          principal: string;
          principal_cents?: number | null;
          product_version_id: string;
          purpose: string;
          revision?: number;
          start_date: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string;
          decided_by?: string | null;
          decision_reason?: string;
          guarantees?: string[];
          id?: string;
          opinion?: string;
          periods?: number;
          principal?: string;
          principal_cents?: number | null;
          product_version_id?: string;
          purpose?: string;
          revision?: number;
          start_date?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'applications_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'applications_client_id_tenant_id_fkey';
            columns: ['client_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'applications_product_version_id_tenant_id_fkey';
            columns: ['product_version_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'product_versions';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'applications_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
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
      campaigns: {
        Row: {
          branch_id: string;
          channel: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          scheduled_at: string;
          segment: Json;
          status: string;
          template_key: string;
          tenant_id: string;
        };
        Insert: {
          branch_id: string;
          channel: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          scheduled_at: string;
          segment: Json;
          status?: string;
          template_key: string;
          tenant_id: string;
        };
        Update: {
          branch_id?: string;
          channel?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          scheduled_at?: string;
          segment?: Json;
          status?: string;
          template_key?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'campaigns_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_deposits: {
        Row: {
          amount: number;
          branch_id: string;
          cash_session_id: string;
          created_at: string;
          id: string;
          recorded_by: string;
          reference: string;
          request_id: string;
          tenant_id: string;
        };
        Insert: {
          amount: number;
          branch_id: string;
          cash_session_id: string;
          created_at?: string;
          id?: string;
          recorded_by: string;
          reference: string;
          request_id: string;
          tenant_id: string;
        };
        Update: {
          amount?: number;
          branch_id?: string;
          cash_session_id?: string;
          created_at?: string;
          id?: string;
          recorded_by?: string;
          reference?: string;
          request_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_deposits_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'cash_deposits_cash_session_id_tenant_id_fkey';
            columns: ['cash_session_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'cash_sessions';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      cash_sessions: {
        Row: {
          branch_id: string;
          closed_at: string | null;
          closed_by: string | null;
          counted: number | null;
          day: string;
          difference_reason: string;
          expected: number | null;
          id: string;
          opened_at: string;
          opened_by: string;
          opening: number;
          tenant_id: string;
        };
        Insert: {
          branch_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          counted?: number | null;
          day: string;
          difference_reason?: string;
          expected?: number | null;
          id?: string;
          opened_at?: string;
          opened_by: string;
          opening: number;
          tenant_id: string;
        };
        Update: {
          branch_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          counted?: number | null;
          day?: string;
          difference_reason?: string;
          expected?: number | null;
          id?: string;
          opened_at?: string;
          opened_by?: string;
          opening?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_sessions_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
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
          communication_blocks: Json;
          consent: Json;
          created_at: string;
          expenses: number | null;
          id: string;
          income: number | null;
          name: string;
          profile: Json;
          revision: number;
          risk_class: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          birth_date?: string | null;
          branch_id: string;
          classification?: string;
          communication_blocks?: Json;
          consent: Json;
          created_at?: string;
          expenses?: number | null;
          id?: string;
          income?: number | null;
          name: string;
          profile: Json;
          revision?: number;
          risk_class?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          branch_id?: string;
          classification?: string;
          communication_blocks?: Json;
          consent?: Json;
          created_at?: string;
          expenses?: number | null;
          id?: string;
          income?: number | null;
          name?: string;
          profile?: Json;
          revision?: number;
          risk_class?: string | null;
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
      collection_actions: {
        Row: {
          actor_id: string;
          amount: number | null;
          branch_id: string;
          created_at: string;
          due_on: string | null;
          id: string;
          kind: string;
          loan_id: string;
          note: string;
          tenant_id: string;
        };
        Insert: {
          actor_id: string;
          amount?: number | null;
          branch_id: string;
          created_at?: string;
          due_on?: string | null;
          id?: string;
          kind: string;
          loan_id: string;
          note: string;
          tenant_id: string;
        };
        Update: {
          actor_id?: string;
          amount?: number | null;
          branch_id?: string;
          created_at?: string;
          due_on?: string | null;
          id?: string;
          kind?: string;
          loan_id?: string;
          note?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_actions_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'collection_actions_loan_id_tenant_id_fkey';
            columns: ['loan_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      collection_assignments: {
        Row: {
          assigned_at: string;
          branch_id: string;
          loan_id: string;
          target: number;
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          branch_id: string;
          loan_id: string;
          target: number;
          tenant_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          branch_id?: string;
          loan_id?: string;
          target?: number;
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_assignments_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'collection_assignments_loan_id_tenant_id_fkey';
            columns: ['loan_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'collection_assignments_tenant_id_user_id_fkey';
            columns: ['tenant_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['tenant_id', 'user_id'];
          },
        ];
      };
      contracts: {
        Row: {
          application_id: string;
          approved_at: string;
          approved_by: string;
          branch_id: string;
          engine_version: number;
          id: string;
          principal_cents: number | null;
          snapshot: Json;
          tenant_id: string;
        };
        Insert: {
          application_id: string;
          approved_at?: string;
          approved_by: string;
          branch_id: string;
          engine_version?: number;
          id?: string;
          principal_cents?: number | null;
          snapshot: Json;
          tenant_id: string;
        };
        Update: {
          application_id?: string;
          approved_at?: string;
          approved_by?: string;
          branch_id?: string;
          engine_version?: number;
          id?: string;
          principal_cents?: number | null;
          snapshot?: Json;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contracts_application_id_tenant_id_fkey';
            columns: ['application_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'contracts_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      journal_transactions: {
        Row: {
          branch_id: string;
          cash_session_id: string | null;
          created_at: string;
          id: string;
          loan_id: string | null;
          payment_id: string | null;
          postings: Json;
          source: string;
          source_key: string;
          tenant_id: string;
        };
        Insert: {
          branch_id: string;
          cash_session_id?: string | null;
          created_at?: string;
          id?: string;
          loan_id?: string | null;
          payment_id?: string | null;
          postings: Json;
          source: string;
          source_key: string;
          tenant_id: string;
        };
        Update: {
          branch_id?: string;
          cash_session_id?: string | null;
          created_at?: string;
          id?: string;
          loan_id?: string | null;
          payment_id?: string | null;
          postings?: Json;
          source?: string;
          source_key?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journal_transactions_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'journal_transactions_cash_session_id_tenant_id_fkey';
            columns: ['cash_session_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'cash_sessions';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'journal_transactions_loan_id_tenant_id_fkey';
            columns: ['loan_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'journal_transactions_payment_id_tenant_id_fkey';
            columns: ['payment_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      leads: {
        Row: {
          branch_id: string;
          client_id: string | null;
          consent: Json;
          created_at: string;
          id: string;
          name: string;
          origin: string;
          phone: string;
          revision: number;
          status: string;
          tenant_id: string;
        };
        Insert: {
          branch_id: string;
          client_id?: string | null;
          consent?: Json;
          created_at?: string;
          id?: string;
          name: string;
          origin: string;
          phone: string;
          revision?: number;
          status: string;
          tenant_id: string;
        };
        Update: {
          branch_id?: string;
          client_id?: string | null;
          consent?: Json;
          created_at?: string;
          id?: string;
          name?: string;
          origin?: string;
          phone?: string;
          revision?: number;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'leads_client_id_tenant_id_fkey';
            columns: ['client_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'leads_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      loan_accounts: {
        Row: {
          branch_id: string;
          credit: number;
          loan_id: string;
          revision: number;
          tenant_id: string;
        };
        Insert: {
          branch_id: string;
          credit?: number;
          loan_id: string;
          revision?: number;
          tenant_id: string;
        };
        Update: {
          branch_id?: string;
          credit?: number;
          loan_id?: string;
          revision?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loan_accounts_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'loan_accounts_loan_id_tenant_id_fkey';
            columns: ['loan_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      loan_instalments: {
        Row: {
          accrued_on: string;
          branch_id: string;
          due_date: string;
          fine: number;
          fine_assessed: boolean;
          from_date: string;
          interest: number;
          late_assessed: number;
          late_interest: number;
          late_raw: number;
          loan_id: string;
          number: number;
          principal: number;
          tenant_id: string;
        };
        Insert: {
          accrued_on: string;
          branch_id: string;
          due_date: string;
          fine?: number;
          fine_assessed?: boolean;
          from_date: string;
          interest: number;
          late_assessed?: number;
          late_interest?: number;
          late_raw?: number;
          loan_id: string;
          number: number;
          principal: number;
          tenant_id: string;
        };
        Update: {
          accrued_on?: string;
          branch_id?: string;
          due_date?: string;
          fine?: number;
          fine_assessed?: boolean;
          from_date?: string;
          interest?: number;
          late_assessed?: number;
          late_interest?: number;
          late_raw?: number;
          loan_id?: string;
          number?: number;
          principal?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loan_instalments_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'loan_instalments_loan_id_tenant_id_fkey';
            columns: ['loan_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      loans: {
        Row: {
          branch_id: string;
          contract_id: string;
          created_at: string;
          disbursed_on: string;
          id: string;
          method: string;
          recorded_by: string;
          reference: string;
          signed_on: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          branch_id: string;
          contract_id: string;
          created_at?: string;
          disbursed_on: string;
          id?: string;
          method: string;
          recorded_by: string;
          reference: string;
          signed_on: string;
          status?: string;
          tenant_id: string;
        };
        Update: {
          branch_id?: string;
          contract_id?: string;
          created_at?: string;
          disbursed_on?: string;
          id?: string;
          method?: string;
          recorded_by?: string;
          reference?: string;
          signed_on?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loans_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'loans_contract_id_tenant_id_fkey';
            columns: ['contract_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'contracts';
            referencedColumns: ['id', 'tenant_id'];
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
      message_events: {
        Row: {
          created_at: string;
          detail: Json;
          id: string;
          message_id: string;
          state: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          detail?: Json;
          id?: string;
          message_id: string;
          state: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          detail?: Json;
          id?: string;
          message_id?: string;
          state?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_events_message_id_tenant_id_fkey';
            columns: ['message_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'message_jobs';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      message_jobs: {
        Row: {
          accepted_at: string | null;
          attempted_at: string | null;
          attempts: number;
          available_at: string;
          body: string;
          branch_id: string;
          campaign_id: string | null;
          channel: string;
          client_id: string;
          cost: number;
          cost_text: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          provider_id: string | null;
          reason: string | null;
          source_key: string;
          status: string;
          template_key: string;
          template_snapshot: Json;
          tenant_id: string;
          variables: Json;
        };
        Insert: {
          accepted_at?: string | null;
          attempted_at?: string | null;
          attempts?: number;
          available_at?: string;
          body: string;
          branch_id: string;
          campaign_id?: string | null;
          channel: string;
          client_id: string;
          cost?: number;
          cost_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          provider_id?: string | null;
          reason?: string | null;
          source_key: string;
          status?: string;
          template_key: string;
          template_snapshot?: Json;
          tenant_id: string;
          variables: Json;
        };
        Update: {
          accepted_at?: string | null;
          attempted_at?: string | null;
          attempts?: number;
          available_at?: string;
          body?: string;
          branch_id?: string;
          campaign_id?: string | null;
          channel?: string;
          client_id?: string;
          cost?: number;
          cost_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          provider_id?: string | null;
          reason?: string | null;
          source_key?: string;
          status?: string;
          template_key?: string;
          template_snapshot?: Json;
          tenant_id?: string;
          variables?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'message_jobs_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'message_jobs_campaign_id_tenant_id_fkey';
            columns: ['campaign_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'message_jobs_client_id_tenant_id_fkey';
            columns: ['client_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'message_jobs_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_reversals: {
        Row: {
          branch_id: string;
          cash_session_id: string | null;
          created_at: string;
          id: string;
          loan_id: string;
          payment_id: string;
          reason: string;
          recorded_by: string;
          tenant_id: string;
        };
        Insert: {
          branch_id: string;
          cash_session_id?: string | null;
          created_at?: string;
          id?: string;
          loan_id: string;
          payment_id: string;
          reason: string;
          recorded_by: string;
          tenant_id: string;
        };
        Update: {
          branch_id?: string;
          cash_session_id?: string | null;
          created_at?: string;
          id?: string;
          loan_id?: string;
          payment_id?: string;
          reason?: string;
          recorded_by?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_reversals_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'payment_reversals_cash_session_id_tenant_id_fkey';
            columns: ['cash_session_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'cash_sessions';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'payment_reversals_loan_id_tenant_id_fkey';
            columns: ['loan_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'payment_reversals_payment_id_tenant_id_fkey';
            columns: ['payment_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id', 'tenant_id'];
          },
        ];
      };
      payments: {
        Row: {
          allocations: Json;
          amount: number;
          branch_id: string;
          cash_session_id: string | null;
          created_at: string;
          credit: number;
          id: string;
          loan_id: string;
          method: string;
          paid_on: string;
          receipt_number: number;
          receipt_snapshot: Json;
          recorded_by: string;
          reference: string;
          request_id: string;
          tenant_id: string;
        };
        Insert: {
          allocations: Json;
          amount: number;
          branch_id: string;
          cash_session_id?: string | null;
          created_at?: string;
          credit: number;
          id?: string;
          loan_id: string;
          method: string;
          paid_on: string;
          receipt_number: number;
          receipt_snapshot: Json;
          recorded_by: string;
          reference: string;
          request_id: string;
          tenant_id: string;
        };
        Update: {
          allocations?: Json;
          amount?: number;
          branch_id?: string;
          cash_session_id?: string | null;
          created_at?: string;
          credit?: number;
          id?: string;
          loan_id?: string;
          method?: string;
          paid_on?: string;
          receipt_number?: number;
          receipt_snapshot?: Json;
          recorded_by?: string;
          reference?: string;
          request_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_branch_id_tenant_id_fkey';
            columns: ['branch_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'payments_cash_session_id_tenant_id_fkey';
            columns: ['cash_session_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'cash_sessions';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'payments_loan_id_tenant_id_fkey';
            columns: ['loan_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'loans';
            referencedColumns: ['id', 'tenant_id'];
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
      receipt_counters: {
        Row: {
          last_number: number;
          tenant_id: string;
        };
        Insert: {
          last_number?: number;
          tenant_id: string;
        };
        Update: {
          last_number?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'receipt_counters_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
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
      assign_collection: {
        Args: { l: string; t: string; target: string; u: string };
        Returns: undefined;
      };
      branch_allowed: { Args: { b: string; t: string }; Returns: boolean };
      cancel_campaign: { Args: { c: string; t: string }; Returns: undefined };
      cash_summary: { Args: { b: string; t: string }; Returns: Json };
      client_allowed: {
        Args: { c: string; p?: string; t: string };
        Returns: boolean;
      };
      client_object_allowed: {
        Args: { object_path: string; p: string; upload?: boolean };
        Returns: boolean;
      };
      client_search_text: { Args: { value: string }; Returns: string };
      collection_targets: { Args: { t: string }; Returns: Json };
      collections_summary: {
        Args: {
          max_days?: number;
          min_days?: number;
          only_mine?: boolean;
          query?: string;
          t: string;
        };
        Returns: Json;
      };
      complete_client_document: {
        Args: { did: string; t: string };
        Returns: boolean;
      };
      create_campaign: {
        Args: {
          b: string;
          ch: string;
          name: string;
          request_id: string;
          scheduled: string;
          segment: Json;
          t: string;
          template: string;
        };
        Returns: string;
      };
      disburse_application: {
        Args: {
          a_id: string;
          disbursement_date: string;
          expected_revision: number;
          payment_method: string;
          payment_reference: string;
          plan_payload: string;
          plan_signature: string;
          signature_date: string;
          t: string;
        };
        Returns: string;
      };
      disburse_application_v4: {
        Args: {
          a_id: string;
          disbursement_date: string;
          expected_revision: number;
          payment_method: string;
          payment_reference: string;
          signature_date: string;
          t: string;
        };
        Returns: string;
      };
      has_permission: { Args: { p: string; t: string }; Returns: boolean };
      import_clients: { Args: { rows: Json; t: string }; Returns: Json };
      initialise_loan: {
        Args: {
          l: string;
          plan_payload: string;
          plan_signature: string;
          t: string;
        };
        Returns: undefined;
      };
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
      loan_balance: { Args: { l: string; t: string }; Returns: Json };
      log_access: { Args: { t: string }; Returns: undefined };
      log_contract_access: {
        Args: { c_id: string; t: string };
        Returns: undefined;
      };
      log_platform_access: { Args: never; Returns: undefined };
      log_receipt_access: {
        Args: { p: string; t: string };
        Returns: undefined;
      };
      manage_cash: {
        Args: {
          amount: string;
          b: string;
          operation: string;
          reference?: string;
          request_id?: string;
          t: string;
        };
        Returns: string;
      };
      message_history: {
        Args: { query?: string; selected_state?: string; t: string };
        Returns: Json;
      };
      preview_campaign: {
        Args: {
          b: string;
          ch: string;
          segment: Json;
          t: string;
          template: string;
        };
        Returns: Json;
      };
      preview_message: {
        Args: {
          c: string;
          ch: string;
          loan?: string;
          t: string;
          template: string;
        };
        Returns: Json;
      };
      preview_payment: {
        Args: { amount: string; l: string; t: string };
        Returns: Json;
      };
      product_shape: { Args: { c: Json }; Returns: boolean };
      provider_callback: {
        Args: { ch: string; payload: string; signature: string; t: string };
        Returns: boolean;
      };
      provider_challenge: {
        Args: { challenge: string; t: string; token: string };
        Returns: string;
      };
      provision_tenant: {
        Args: {
          preset_id: string;
          selected_plan_id: string;
          tenant_name: string;
          tenant_slug: string;
        };
        Returns: string;
      };
      queue_message: {
        Args: {
          c: string;
          ch: string;
          loan?: string;
          request_id: string;
          t: string;
          template: string;
        };
        Returns: string;
      };
      record_collection: {
        Args: {
          amount?: string;
          due?: string;
          kind: string;
          l: string;
          note: string;
          request_id?: string;
          t: string;
        };
        Returns: string;
      };
      record_payment: {
        Args: {
          amount: string;
          expected_day: string;
          expected_revision: number;
          l: string;
          payment_method: string;
          payment_reference: string;
          request_id: string;
          t: string;
        };
        Returns: string;
      };
      refresh_loan: { Args: { l: string; t: string }; Returns: undefined };
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
      reverse_payment: {
        Args: { p_id: string; reason: string; t: string };
        Returns: string;
      };
      save_application: {
        Args: {
          expected_revision?: number;
          input: Json;
          selected_application?: string;
          t: string;
        };
        Returns: string;
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
      save_communication_configuration: {
        Args: {
          category_name: string;
          key_name: string;
          settings: Json;
          t: string;
        };
        Returns: undefined;
      };
      save_integration: {
        Args: { ch: string; settings: Json; t: string };
        Returns: undefined;
      };
      save_lead: {
        Args: {
          data: Json;
          expected_revision?: number;
          selected?: string;
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
      search_applications: {
        Args: {
          page_offset?: number;
          query?: string;
          selected_status?: string;
          t: string;
        };
        Returns: Json;
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
          communication_blocks: Json;
          consent: Json;
          created_at: string;
          expenses: number | null;
          id: string;
          income: number | null;
          name: string;
          profile: Json;
          revision: number;
          risk_class: string | null;
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
      search_loans: {
        Args: {
          page_offset?: number;
          query?: string;
          selected_status?: string;
          t: string;
        };
        Returns: Json;
      };
      set_communication_consent: {
        Args: {
          c: string;
          ch: string;
          enabled: boolean;
          source: string;
          t: string;
        };
        Returns: undefined;
      };
      tenant_session_valid: { Args: { t: string }; Returns: boolean };
      tenant_usage: {
        Args: never;
        Returns: {
          tenant_id: string;
          user_count: number;
        }[];
      };
      today_summary: { Args: { t: string }; Returns: Json };
      transition_application: {
        Args: {
          a_id: string;
          expected_revision: number;
          next_status: string;
          note?: string;
          t: string;
        };
        Returns: string;
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
