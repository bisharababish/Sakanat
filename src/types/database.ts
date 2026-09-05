export type UserRole = 'student' | 'renter' | 'owner' | 'admin';
export type PublicSignupRole = 'student' | 'renter';
export type OwnerStatus = 'pending' | 'approved' | 'rejected';
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'hidden';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentMethod = 'cash' | 'check' | 'visa' | 'pay_now' | 'pay_later';
export type PaymentStatus = 'unpaid' | 'paid';
export type GenderPolicy = 'any' | 'female' | 'male';
export type PersonGender = 'female' | 'male';
export type IdVerifyStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type City = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  lat: number;
  lng: number;
};

export type University = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  city_id: string;
  lat: number;
  lng: number;
  email_domains: string[];
  cities?: City;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  full_name_en?: string | null;
  phone: string | null;
  role: UserRole;
  city_id: string | null;
  university_id: string | null;
  owner_status: OwnerStatus;
  language: 'ar' | 'en';
  avatar_url: string | null;
  gender: PersonGender | null;
  date_of_birth: string | null;
  student_id_number: string | null;
  whatsapp: string | null;
  study_year: string | null;
  degree_level: string | null;
  major: string | null;
  home_address?: string | null;
  national_id_number?: string | null;
  national_id_url?: string | null;
  university_card_url?: string | null;
  id_verify_status?: IdVerifyStatus;
  id_verify_note?: string | null;
  id_verified_at?: string | null;
  id_verified_by?: string | null;
  emergency_name?: string | null;
  emergency_phone?: string | null;
  last_seen_ip?: string | null;
  expo_push_token?: string | null;
  account_status?: 'active' | 'suspended';
  accepted_terms_at?: string | null;
  created_at: string;
  cities?: City | null;
  universities?: University | null;
};

export type Apartment = {
  id: string;
  owner_id: string;
  city_id: string;
  nearest_university_id: string | null;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  price_month: number;
  rooms: number;
  bathrooms: number;
  area_m2: number | null;
  gender_policy: GenderPolicy;
  amenities: string[];
  photos: string[];
  lat: number;
  lng: number;
  campus_distance_km: number | null;
  status: ListingStatus;
  reject_reason?: string | null;
  review_avg?: number | null;
  review_count?: number | null;
  created_at: string;
  cities?: City;
  universities?: University | null;
  profiles?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email' | 'whatsapp'>;
};

export type Booking = {
  id: string;
  apartment_id: string;
  student_id: string;
  owner_id: string;
  start_date: string;
  months: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: BookingStatus;
  occupants: number;
  rent_amount: number;
  commission_percent: number;
  commission_amount: number;
  cancel_reason?: string | null;
  created_at: string;
  apartments?: Apartment;
  profiles?: Pick<
    Profile,
    | 'id'
    | 'full_name'
    | 'avatar_url'
    | 'phone'
    | 'email'
    | 'whatsapp'
    | 'gender'
    | 'university_id'
    | 'city_id'
    | 'role'
    | 'major'
    | 'study_year'
    | 'degree_level'
    | 'student_id_number'
    | 'date_of_birth'
    | 'home_address'
    | 'national_id_number'
    | 'national_id_url'
    | 'university_card_url'
    | 'id_verify_status'
    | 'emergency_name'
    | 'emergency_phone'
    | 'last_seen_ip'
  > & { universities?: Pick<University, 'id' | 'name_ar' | 'name_en'> | null };
  student?: Pick<
    Profile,
    | 'id'
    | 'full_name'
    | 'avatar_url'
    | 'phone'
    | 'email'
    | 'whatsapp'
    | 'gender'
    | 'university_id'
    | 'city_id'
    | 'role'
    | 'major'
    | 'study_year'
    | 'degree_level'
    | 'student_id_number'
    | 'date_of_birth'
    | 'home_address'
    | 'national_id_number'
    | 'national_id_url'
    | 'university_card_url'
    | 'id_verify_status'
    | 'emergency_name'
    | 'emergency_phone'
    | 'last_seen_ip'
  > | null;
  owner?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email'> | null;
};

export type Conversation = {
  id: string;
  apartment_id: string;
  student_id: string;
  owner_id: string;
  last_message_at: string;
  last_message: string | null;
  student_last_read_at?: string | null;
  owner_last_read_at?: string | null;
  student_delivered_at?: string | null;
  owner_delivered_at?: string | null;
  apartments?: Pick<Apartment, 'id' | 'title_ar' | 'title_en' | 'photos'>;
  student?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'email' | 'phone' | 'role'> | null;
  owner?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'email' | 'phone' | 'role'> | null;
};

export type ApartmentReview = {
  id: string;
  booking_id: string;
  apartment_id: string;
  student_id: string;
  stars: number;
  note: string;
  author_name: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type AppSettings = {
  id: number;
  commission_percent: number;
  admin_email: string;
};

export const AMENITIES = [
  'wifi',
  'furnished',
  'private_bathroom',
  'kitchen',
  'heating',
  'ac',
  'washing_machine',
  'near_transport',
  'balcony',
  'parking',
] as const;

export type Amenity = (typeof AMENITIES)[number];
