export type ProfileRole = 'student' | 'society_admin' | 'osa_admin';
export type EventStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Changes Requested'
  | 'Completed'
  | 'Cancelled';
export type RegistrationStatus = 'Registered' | 'Attended' | 'Absent';
export type SocietyCategory = 'Technical' | 'Creative' | 'Community' | 'Outdoor & Sports';
export type EventCategory = 'Workshops' | 'Hackathons' | 'Clubs' | 'Cultural';
export type SocietyMemberGroup = 'Leadership' | 'Core Team' | 'Member';
export type AdminDecisionEntity = 'society' | 'event';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  roll_number: string | null;
  department: string | null;
  role: ProfileRole;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  semester: string | null;
  phone: string | null;
  avatar_url: string | null;
  managed_society_id: string | null;
};

export type SocietyRow = {
  id: string;
  name: string;
  short_name: string;
  tagline: string | null;
  category: SocietyCategory;
  category_label: string | null;
  dept: string | null;
  faculty_advisor: string | null;
  contact_email: string | null;
  instagram: string | null;
  meeting_schedule: string | null;
  members_count: number;
  events_count: number;
  logo: string | null;
  banner: string | null;
  mission: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SocietyMemberRow = {
  id: string;
  society_id: string;
  user_id: string | null;
  name: string;
  roll_number: string;
  role: string;
  group_name: SocietyMemberGroup;
  department: string | null;
  email: string | null;
  avatar: string | null;
  joined_date: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  society_id: string;
  society_name: string;
  title: string;
  short_title: string | null;
  category: EventCategory;
  category_tag: string | null;
  badge: string | null;
  date: string;
  date_label: string | null;
  time: string | null;
  time_label: string | null;
  date_time_full: string | null;
  venue: string;
  wing: string | null;
  capacity: number;
  registered_count: number;
  registrations_count: number | null;
  deadline: string | null;
  deadline_text: string | null;
  urgent: boolean | null;
  image: string | null;
  club_logo: string | null;
  description: string | null;
  status: EventStatus;
  osa_notes: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

export type AdminStatusRuleRow = {
  entity_type?: string;
  from_statuses?: string[];
  [key: string]: Json | undefined;
};

export type RegistrationRow = {
  id: string;
  event_id: string;
  user_id: string | null;
  event_title: string | null;
  name: string;
  roll_number: string;
  department: string | null;
  semester: string | null;
  email: string;
  avatar: string | null;
  status: RegistrationStatus;
  certificate_id: string | null;
  registered_at: string;
  user_name: string | null;
  user_email: string | null;
};

export type AdminDecisionRow = {
  id: string;
  entity_type: AdminDecisionEntity;
  entity_id: string;
  action: 'approve' | 'reject' | 'request_changes';
  previous_status: string;
  new_status: string;
  notes: string | null;
  actor_id: string;
  created_at: string;
};

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<ProfileRow>;
      societies: TableDefinition<SocietyRow>;
      society_members: TableDefinition<SocietyMemberRow>;
      events: TableDefinition<EventRow>;
      registrations: TableDefinition<RegistrationRow>;
      admin_decisions: TableDefinition<AdminDecisionRow>;
      admin_status_rules: TableDefinition<AdminStatusRuleRow>;
    };
    Views: Record<string, never>;
    Functions: {
      is_osa_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      decide_event: {
        Args: { event_id: string; action: string; notes?: string | null };
        Returns: AdminDecisionRow;
      };
      decide_society: {
        Args: { society_id: string; action: string; notes?: string | null };
        Returns: AdminDecisionRow;
      };
      list_admin_decisions: {
        Args: {
          p_entity_type?: string | null;
          p_action?: string | null;
          p_actor_id?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_search?: string | null;
          p_limit?: number | null;
        };
        Returns: AdminDecisionRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
