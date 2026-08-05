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
      assessment_session_questions: {
        Row: {
          answered_at: string | null;
          created_at: string;
          due_at_snapshot: string | null;
          fsrs_rating: Database["public"]["Enums"]["fsrs_rating"] | null;
          id: string;
          is_correct: boolean | null;
          position: number;
          question_id: string;
          response_time_ms: number | null;
          selected_option: string | null;
          selection_reason:
            Database["public"]["Enums"]["question_selection_reason"];
          session_id: string;
          updated_at: string;
        };
        Insert: {
          answered_at?: string | null;
          created_at?: string;
          due_at_snapshot?: string | null;
          fsrs_rating?: Database["public"]["Enums"]["fsrs_rating"] | null;
          id?: string;
          is_correct?: boolean | null;
          position: number;
          question_id: string;
          response_time_ms?: number | null;
          selected_option?: string | null;
          selection_reason:
            Database["public"]["Enums"]["question_selection_reason"];
          session_id: string;
          updated_at?: string;
        };
        Update: {
          answered_at?: string | null;
          created_at?: string;
          due_at_snapshot?: string | null;
          fsrs_rating?: Database["public"]["Enums"]["fsrs_rating"] | null;
          id?: string;
          is_correct?: boolean | null;
          position?: number;
          question_id?: string;
          response_time_ms?: number | null;
          selected_option?: string | null;
          selection_reason?:
            Database["public"]["Enums"]["question_selection_reason"];
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_session_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_session_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_completed_session_review";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "assessment_session_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "assessment_session_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "assessment_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_session_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "v_completed_session_review";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "assessment_session_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["session_id"];
          },
          {
            foreignKeyName: "assessment_session_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "v_session_results";
            referencedColumns: ["session_id"];
          },
        ];
      };
      assessment_sessions: {
        Row: {
          abandoned_at: string | null;
          answered_questions: number;
          completed_at: string | null;
          correct_count: number;
          course_id: string;
          created_at: string;
          fsrs_config_id: string;
          id: string;
          incorrect_count: number;
          started_at: string;
          status: Database["public"]["Enums"]["session_status"];
          student_id: string;
          topic_id: string;
          total_questions: number;
          updated_at: string;
        };
        Insert: {
          abandoned_at?: string | null;
          answered_questions?: number;
          completed_at?: string | null;
          correct_count?: number;
          course_id: string;
          created_at?: string;
          fsrs_config_id: string;
          id?: string;
          incorrect_count?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["session_status"];
          student_id: string;
          topic_id: string;
          total_questions: number;
          updated_at?: string;
        };
        Update: {
          abandoned_at?: string | null;
          answered_questions?: number;
          completed_at?: string | null;
          correct_count?: number;
          course_id?: string;
          created_at?: string;
          fsrs_config_id?: string;
          id?: string;
          incorrect_count?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["session_status"];
          student_id?: string;
          topic_id?: string;
          total_questions?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_teacher_students";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_fsrs_config_id_fkey";
            columns: ["fsrs_config_id"];
            isOneToOne: false;
            referencedRelation: "fsrs_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["topic_id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_user_id: string | null;
          college_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          college_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          college_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "audit_logs_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["college_id"];
          },
        ];
      };
      colleges: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      course_enrollments: {
        Row: {
          course_id: string;
          created_at: string;
          ended_at: string | null;
          enrolled_at: string;
          enrolled_by: string | null;
          id: string;
          status: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          ended_at?: string | null;
          enrolled_at?: string;
          enrolled_by?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          ended_at?: string | null;
          enrolled_at?: string;
          enrolled_by?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_teacher_students";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "course_enrollments_enrolled_by_fkey";
            columns: ["enrolled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_enrollments_enrolled_by_fkey";
            columns: ["enrolled_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "course_enrollments_enrolled_by_fkey";
            columns: ["enrolled_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      courses: {
        Row: {
          college_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          status: Database["public"]["Enums"]["course_status"];
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          college_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          status?: Database["public"]["Enums"]["course_status"];
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          college_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["course_status"];
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courses_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["college_id"];
          },
          {
            foreignKeyName: "courses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "courses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "courses_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courses_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "courses_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      fsrs_configs: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          library_name: string;
          library_version: string;
          locked_at: string | null;
          name: string;
          parameters: Json;
          rating_mapping: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          library_name?: string;
          library_version: string;
          locked_at?: string | null;
          name: string;
          parameters?: Json;
          rating_mapping?: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          library_name?: string;
          library_version?: string;
          locked_at?: string | null;
          name?: string;
          parameters?: Json;
          rating_mapping?: Json;
        };
        Relationships: [];
      };
      fsrs_review_logs: {
        Row: {
          card_id: string;
          created_at: string;
          difficulty_after: number | null;
          difficulty_before: number | null;
          due_after: string;
          due_before: string | null;
          fsrs_config_id: string;
          id: string;
          question_id: string;
          rating: Database["public"]["Enums"]["fsrs_rating"];
          reviewed_at: string;
          scheduled_days_after: number | null;
          scheduled_days_before: number | null;
          session_question_id: string;
          stability_after: number | null;
          stability_before: number | null;
          state_after: number;
          state_before: number | null;
          student_id: string;
        };
        Insert: {
          card_id: string;
          created_at?: string;
          difficulty_after?: number | null;
          difficulty_before?: number | null;
          due_after: string;
          due_before?: string | null;
          fsrs_config_id: string;
          id?: string;
          question_id: string;
          rating: Database["public"]["Enums"]["fsrs_rating"];
          reviewed_at: string;
          scheduled_days_after?: number | null;
          scheduled_days_before?: number | null;
          session_question_id: string;
          stability_after?: number | null;
          stability_before?: number | null;
          state_after: number;
          state_before?: number | null;
          student_id: string;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          difficulty_after?: number | null;
          difficulty_before?: number | null;
          due_after?: string;
          due_before?: string | null;
          fsrs_config_id?: string;
          id?: string;
          question_id?: string;
          rating?: Database["public"]["Enums"]["fsrs_rating"];
          reviewed_at?: string;
          scheduled_days_after?: number | null;
          scheduled_days_before?: number | null;
          session_question_id?: string;
          stability_after?: number | null;
          stability_before?: number | null;
          state_after?: number;
          state_before?: number | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fsrs_review_logs_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "student_question_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["card_id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_fsrs_config_id_fkey";
            columns: ["fsrs_config_id"];
            isOneToOne: false;
            referencedRelation: "fsrs_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_completed_session_review";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_session_question_id_fkey";
            columns: ["session_question_id"];
            isOneToOne: true;
            referencedRelation: "assessment_session_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_session_question_id_fkey";
            columns: ["session_question_id"];
            isOneToOne: true;
            referencedRelation: "v_completed_session_review";
            referencedColumns: ["session_question_id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_session_question_id_fkey";
            columns: ["session_question_id"];
            isOneToOne: true;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["session_question_id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "fsrs_review_logs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      profiles: {
        Row: {
          access_valid_from: string | null;
          access_valid_until: string | null;
          college_id: string | null;
          created_at: string;
          created_by: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["app_user_role"];
          security_answer_hash: string | null;
          security_failed_attempts: number;
          security_locked_until: string | null;
          security_question: string | null;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          access_valid_from?: string | null;
          access_valid_until?: string | null;
          college_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          full_name: string;
          id: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["app_user_role"];
          security_answer_hash?: string | null;
          security_failed_attempts?: number;
          security_locked_until?: string | null;
          security_question?: string | null;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          access_valid_from?: string | null;
          access_valid_until?: string | null;
          college_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["app_user_role"];
          security_answer_hash?: string | null;
          security_failed_attempts?: number;
          security_locked_until?: string | null;
          security_question?: string | null;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["college_id"];
          },
          {
            foreignKeyName: "profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      question_import_batches: {
        Row: {
          accepted_rows: number;
          completed_at: string | null;
          created_at: string;
          filename: string;
          id: string;
          rejected_rows: number;
          status: Database["public"]["Enums"]["import_status"];
          topic_id: string;
          total_rows: number;
          uploaded_by: string;
          validation_report: Json;
        };
        Insert: {
          accepted_rows?: number;
          completed_at?: string | null;
          created_at?: string;
          filename: string;
          id?: string;
          rejected_rows?: number;
          status?: Database["public"]["Enums"]["import_status"];
          topic_id: string;
          total_rows?: number;
          uploaded_by: string;
          validation_report?: Json;
        };
        Update: {
          accepted_rows?: number;
          completed_at?: string | null;
          created_at?: string;
          filename?: string;
          id?: string;
          rejected_rows?: number;
          status?: Database["public"]["Enums"]["import_status"];
          topic_id?: string;
          total_rows?: number;
          uploaded_by?: string;
          validation_report?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "question_import_batches_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_import_batches_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "question_import_batches_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "question_import_batches_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_import_batches_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "question_import_batches_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      questions: {
        Row: {
          correct_option: string;
          created_at: string;
          created_by: string;
          explanation: string;
          id: string;
          import_batch_id: string | null;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          statement: string;
          status: Database["public"]["Enums"]["question_status"];
          supersedes_question_id: string | null;
          topic_id: string;
          updated_at: string;
        };
        Insert: {
          correct_option: string;
          created_at?: string;
          created_by: string;
          explanation: string;
          id?: string;
          import_batch_id?: string | null;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          statement: string;
          status?: Database["public"]["Enums"]["question_status"];
          supersedes_question_id?: string | null;
          topic_id: string;
          updated_at?: string;
        };
        Update: {
          correct_option?: string;
          created_at?: string;
          created_by?: string;
          explanation?: string;
          id?: string;
          import_batch_id?: string | null;
          option_a?: string;
          option_b?: string;
          option_c?: string;
          option_d?: string;
          statement?: string;
          status?: Database["public"]["Enums"]["question_status"];
          supersedes_question_id?: string | null;
          topic_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "questions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "questions_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "question_import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_supersedes_question_id_fkey";
            columns: ["supersedes_question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_supersedes_question_id_fkey";
            columns: ["supersedes_question_id"];
            isOneToOne: false;
            referencedRelation: "v_completed_session_review";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "questions_supersedes_question_id_fkey";
            columns: ["supersedes_question_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["topic_id"];
          },
        ];
      };
      student_question_cards: {
        Row: {
          created_at: string;
          difficulty: number | null;
          due_at: string;
          elapsed_days: number;
          fsrs_config_id: string;
          fsrs_data: Json;
          id: string;
          lapses: number;
          last_review_at: string | null;
          learning_steps: number;
          question_id: string;
          reps: number;
          scheduled_days: number;
          stability: number | null;
          state: number;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          difficulty?: number | null;
          due_at: string;
          elapsed_days?: number;
          fsrs_config_id: string;
          fsrs_data?: Json;
          id?: string;
          lapses?: number;
          last_review_at?: string | null;
          learning_steps?: number;
          question_id: string;
          reps?: number;
          scheduled_days?: number;
          stability?: number | null;
          state?: number;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          difficulty?: number | null;
          due_at?: string;
          elapsed_days?: number;
          fsrs_config_id?: string;
          fsrs_data?: Json;
          id?: string;
          lapses?: number;
          last_review_at?: string | null;
          learning_steps?: number;
          question_id?: string;
          reps?: number;
          scheduled_days?: number;
          stability?: number | null;
          state?: number;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_question_cards_fsrs_config_id_fkey";
            columns: ["fsrs_config_id"];
            isOneToOne: false;
            referencedRelation: "fsrs_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_question_cards_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_question_cards_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_completed_session_review";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "student_question_cards_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "student_question_cards_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_question_cards_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_question_cards_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      student_topic_access: {
        Row: {
          created_at: string;
          id: string;
          is_blocked: boolean;
          student_id: string;
          topic_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_blocked?: boolean;
          student_id: string;
          topic_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_blocked?: boolean;
          student_id?: string;
          topic_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_topic_access_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_topic_access_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_topic_access_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "student_topic_access_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_topic_access_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "student_topic_access_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "student_topic_access_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_topic_access_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_topic_access_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      topics: {
        Row: {
          course_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          material_url: string | null;
          name: string;
          position: number;
          status: Database["public"]["Enums"]["topic_status"];
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          material_url?: string | null;
          name: string;
          position?: number;
          status?: Database["public"]["Enums"]["topic_status"];
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          material_url?: string | null;
          name?: string;
          position?: number;
          status?: Database["public"]["Enums"]["topic_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topics_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topics_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "topics_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "topics_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_teacher_students";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
    };
    Views: {
      v_completed_session_review: {
        Row: {
          answered_at: string | null;
          completed_at: string | null;
          correct_option: string | null;
          course_id: string | null;
          explanation: string | null;
          fsrs_rating: Database["public"]["Enums"]["fsrs_rating"] | null;
          is_correct: boolean | null;
          option_a: string | null;
          option_b: string | null;
          option_c: string | null;
          option_d: string | null;
          position: number | null;
          question_id: string | null;
          response_time_ms: number | null;
          selected_option: string | null;
          selection_reason:
            | Database["public"]["Enums"]["question_selection_reason"]
            | null;
          session_id: string | null;
          session_question_id: string | null;
          statement: string | null;
          student_id: string | null;
          topic_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_teacher_students";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["topic_id"];
          },
        ];
      };
      v_export_all_data: {
        Row: {
          abandoned_at: string | null;
          access_valid_from: string | null;
          access_valid_until: string | null;
          answered_at: string | null;
          answered_questions: number | null;
          card_id: string | null;
          college_code: string | null;
          college_id: string | null;
          college_name: string | null;
          completed_at: string | null;
          correct_option: string | null;
          course_id: string | null;
          course_name: string | null;
          current_difficulty: number | null;
          current_due_at: string | null;
          current_elapsed_days: number | null;
          current_lapses: number | null;
          current_learning_steps: number | null;
          current_reps: number | null;
          current_scheduled_days: number | null;
          current_stability: number | null;
          current_state: number | null;
          difficulty_after: number | null;
          difficulty_before: number | null;
          due_after: string | null;
          due_at_snapshot: string | null;
          due_before: string | null;
          explanation: string | null;
          fsrs_rating: Database["public"]["Enums"]["fsrs_rating"] | null;
          fsrs_reviewed_at: string | null;
          is_correct: boolean | null;
          last_review_at: string | null;
          option_a: string | null;
          option_b: string | null;
          option_c: string | null;
          option_d: string | null;
          position: number | null;
          question_id: string | null;
          response_time_ms: number | null;
          scheduled_days_after: number | null;
          scheduled_days_before: number | null;
          selected_option: string | null;
          selection_reason:
            | Database["public"]["Enums"]["question_selection_reason"]
            | null;
          session_correct_count: number | null;
          session_correct_percentage: number | null;
          session_error_percentage: number | null;
          session_id: string | null;
          session_incorrect_count: number | null;
          session_question_id: string | null;
          session_status: Database["public"]["Enums"]["session_status"] | null;
          stability_after: number | null;
          stability_before: number | null;
          started_at: string | null;
          state_after: number | null;
          state_before: number | null;
          statement: string | null;
          student_code: string | null;
          student_id: string | null;
          student_name: string | null;
          teacher_code: string | null;
          teacher_id: string | null;
          teacher_name: string | null;
          topic_id: string | null;
          topic_name: string | null;
          total_questions: number | null;
        };
        Relationships: [];
      };
      v_session_results: {
        Row: {
          answered_questions: number | null;
          completed_at: string | null;
          correct_count: number | null;
          correct_percentage: number | null;
          course_id: string | null;
          course_name: string | null;
          error_percentage: number | null;
          incorrect_count: number | null;
          session_id: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["session_status"] | null;
          student_code: string | null;
          student_id: string | null;
          student_name: string | null;
          topic_id: string | null;
          topic_name: string | null;
          total_questions: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_teacher_students";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["topic_id"];
          },
        ];
      };
      v_student_course_progress: {
        Row: {
          answered_questions: number | null;
          completed_sessions: number | null;
          correct_count: number | null;
          course_correct_percentage: number | null;
          course_error_percentage: number | null;
          course_id: string | null;
          course_name: string | null;
          incorrect_count: number | null;
          last_completed_at: string | null;
          student_code: string | null;
          student_id: string | null;
          student_name: string | null;
          topics_with_data: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_teacher_students";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      v_student_topic_access_status: {
        Row: {
          course_id: string | null;
          course_name: string | null;
          is_blocked: boolean | null;
          student_code: string | null;
          student_id: string | null;
          student_name: string | null;
          topic_id: string | null;
          topic_name: string | null;
          topic_status: Database["public"]["Enums"]["topic_status"] | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "student_topic_access_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_topic_access_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_topic_access_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
      v_student_topic_progress: {
        Row: {
          answered_questions: number | null;
          completed_sessions: number | null;
          correct_count: number | null;
          correct_percentage: number | null;
          course_id: string | null;
          course_name: string | null;
          error_percentage: number | null;
          incorrect_count: number | null;
          last_completed_at: string | null;
          student_code: string | null;
          student_id: string | null;
          student_name: string | null;
          topic_id: string | null;
          topic_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "v_teacher_students";
            referencedColumns: ["course_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["topic_id"];
          },
          {
            foreignKeyName: "assessment_sessions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "v_student_topic_access_status";
            referencedColumns: ["topic_id"];
          },
        ];
      };
      v_teacher_students: {
        Row: {
          access_valid_from: string | null;
          access_valid_until: string | null;
          college_id: string | null;
          college_name: string | null;
          course_id: string | null;
          course_name: string | null;
          ended_at: string | null;
          enrolled_at: string | null;
          enrollment_status:
            | Database["public"]["Enums"]["enrollment_status"]
            | null;
          last_completed_session_at: string | null;
          student_code: string | null;
          student_id: string | null;
          student_is_active: boolean | null;
          student_name: string | null;
          teacher_code: string | null;
          teacher_id: string | null;
          teacher_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
          {
            foreignKeyName: "courses_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courses_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["college_id"];
          },
          {
            foreignKeyName: "courses_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courses_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "courses_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "v_export_all_data";
            referencedColumns: ["teacher_id"];
          },
        ];
      };
    };
    Functions: {
      admin_sync_teacher_students: {
        Args: { p_student_ids?: string[]; p_teacher_id: string };
        Returns: undefined;
      };
      edge_apply_answer: {
        Args: {
          p_card: Json;
          p_response_time_ms: number;
          p_reviewed_at: string;
          p_selected_option: string;
          p_session_question_id: string;
          p_student_id: string;
        };
        Returns: Json;
      };
      edge_complete_session: {
        Args: { p_session_id: string; p_student_id: string };
        Returns: string;
      };
      edge_submit_and_complete_session: {
        Args: { p_results: Json; p_session_id: string; p_student_id: string };
        Returns: string;
      };
      edge_find_profile_by_code: {
        Args: { p_code: string };
        Returns: {
          access_valid_from: string;
          access_valid_until: string;
          college_id: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["app_user_role"];
          user_code: string;
        }[];
      };
      edge_import_questions: {
        Args: {
          p_actor_id: string;
          p_filename: string;
          p_report: Json;
          p_rows: Json;
          p_topic_id: string;
          p_total_rows: number;
        };
        Returns: string;
      };
      edge_start_session: {
        Args: { p_limit?: number; p_student_id: string; p_topic_id: string };
        Returns: string;
      };
    };
    Enums: {
      app_user_role: "admin" | "teacher" | "student";
      course_status: "active" | "inactive" | "archived";
      enrollment_status: "active" | "inactive";
      fsrs_rating: "Again" | "Good";
      import_status: "validating" | "completed" | "failed";
      question_selection_reason: "due" | "new" | "scheduled";
      question_status: "draft" | "active" | "inactive" | "archived";
      session_status: "in_progress" | "completed" | "abandoned";
      topic_status: "draft" | "active" | "inactive" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      app_user_role: ["admin", "teacher", "student"],
      course_status: ["active", "inactive", "archived"],
      enrollment_status: ["active", "inactive"],
      fsrs_rating: ["Again", "Good"],
      import_status: ["validating", "completed", "failed"],
      question_selection_reason: ["due", "new", "scheduled"],
      question_status: ["draft", "active", "inactive", "archived"],
      session_status: ["in_progress", "completed", "abandoned"],
      topic_status: ["draft", "active", "inactive", "archived"],
    },
  },
} as const;
