export type UserRole = 'student' | 'owner' | 'admin';
export type OwnerStatus = 'pending' | 'approved' | 'rejected';
export type ListingStatus = 'pending' | 'approved' | 'rejected';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentMethod = 'pay_now' | 'pay_later';
export type PaymentStatus = 'unpaid' | 'paid';
export type GenderPolicy = 'any' | 'female' | 'male';

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
  phone: string | null;
  role: UserRole;
  city_id: string | null;
  university_id: string | null;
  owner_status: OwnerStatus;
  language: 'ar' | 'en';
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
  created_at: string;
  cities?: City;
  universities?: University | null;
  profiles?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email'>;
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
  rent_amount: number;
  commission_percent: number;
  commission_amount: number;
  created_at: string;
  apartments?: Apartment;
  profiles?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email'>;
};

export type Conversation = {
  id: string;
  apartment_id: string;
  student_id: string;
  owner_id: string;
  last_message_at: string;
  last_message: string | null;
  apartments?: Pick<Apartment, 'id' | 'title_ar' | 'title_en' | 'photos'>;
  student?: Pick<Profile, 'id' | 'full_name'>;
  owner?: Pick<Profile, 'id' | 'full_name'>;
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
